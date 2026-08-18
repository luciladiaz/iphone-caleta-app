import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, getDoc, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Formas de pago que no representan efectivo/transferencia recibida en el momento
// (una cuota se cobra a futuro, un equipo de parte de pago no es dinero). Se
// mantiene el string viejo 'iPhone como parte de pago' para no dejar de detectar
// ventas históricas que ya lo tenían guardado así.
const TIPOS_SIN_CAJA = ['Cuotas personales', 'Equipo como parte de pago', 'iPhone como parte de pago'];

// Categorías elegibles a mano en un movimiento manual (ingreso o egreso). Los
// movimientos automáticos (venta, cuota, reparación, pago a proveedor) llevan su
// categoría fija asignada solos, sin que el usuario tenga que elegir nada.
export const CATEGORIAS_INGRESO = ['Venta', 'Cobro de cuota', 'Reparación', 'Aporte de capital', 'Otro ingreso'];
export const CATEGORIAS_EGRESO = ['Pago a proveedor', 'Repuesto de reparación', 'Alquiler', 'Sueldos', 'Servicios', 'Impuestos', 'Retiro', 'Otro gasto'];

const CATEGORIA_POR_ORIGEN = {
  venta: 'Venta',
  cuota: 'Cobro de cuota',
  reparacion: 'Reparación',
  pago_proveedor: 'Pago a proveedor',
  pago_proveedor_cc: 'Pago a proveedor',
  reparacion_costo: 'Repuesto de reparación',
};

function labelVenta(venta) {
  return `${venta.modelo || ''} ${venta.gb || ''}GB`.trim();
}

// Clave de día en horario local (no UTC), usada como id de cierre y para agrupar
// movimientos por fecha en los gráficos.
export function fechaKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fechaDeMovimiento(m) {
  return m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha);
}

async function movimientosDeVenta(negocioId, ventaId) {
  const base = ['negocios', negocioId];
  const snap = await getDocs(query(collection(db, ...base, 'caja'), where('ventaId', '==', ventaId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Crea un ingreso de caja por cada forma de pago "en mano" (efectivo/transferencia) de la venta.
export async function registrarMovimientosVenta(negocioId, ventaId, venta) {
  const base = ['negocios', negocioId];
  const cobros = venta.cobros || [];
  for (let i = 0; i < cobros.length; i++) {
    const cobro = cobros[i];
    if (TIPOS_SIN_CAJA.includes(cobro.tipo)) continue;
    const monto = Number(cobro.monto) || 0;
    if (monto <= 0) continue;
    await addDoc(collection(db, ...base, 'caja'), {
      fecha: serverTimestamp(),
      tipo: 'ingreso',
      moneda: cobro.moneda === 'USD' ? 'USD' : 'ARS',
      monto,
      concepto: `${cobro.tipo} · ${labelVenta(venta)}${venta.cliente ? ' · ' + venta.cliente : ''}`,
      origen: 'venta',
      categoria: CATEGORIA_POR_ORIGEN.venta,
      ventaId,
      cobroIdx: i,
      cuotaIdx: null,
      automatico: true,
    });
  }
}

// Borra los movimientos automáticos ligados a una venta. Si se pasa `origen`, solo esos.
export async function eliminarMovimientosVenta(negocioId, ventaId, origen = null) {
  const base = ['negocios', negocioId];
  const movs = await movimientosDeVenta(negocioId, ventaId);
  const dels = origen ? movs.filter(m => m.origen === origen) : movs;
  await Promise.all(dels.map(m => deleteDoc(doc(db, ...base, 'caja', m.id))));
}

export async function registrarMovimientoCuota(negocioId, ventaId, venta, cobroIdx, cuotaIdx, cobro) {
  const base = ['negocios', negocioId];
  const monto = Number(cobro.montoCuota) || 0;
  if (monto <= 0) return;
  await addDoc(collection(db, ...base, 'caja'), {
    fecha: serverTimestamp(),
    tipo: 'ingreso',
    moneda: cobro.moneda === 'USD' ? 'USD' : 'ARS',
    monto,
    concepto: `Cuota ${cuotaIdx + 1}/${cobro.cuotas} · ${labelVenta(venta)}${venta.cliente ? ' · ' + venta.cliente : ''}`,
    origen: 'cuota',
    categoria: CATEGORIA_POR_ORIGEN.cuota,
    ventaId,
    cobroIdx,
    cuotaIdx,
    automatico: true,
  });
}

export async function eliminarMovimientoCuota(negocioId, ventaId, cobroIdx, cuotaIdx) {
  const base = ['negocios', negocioId];
  const movs = await movimientosDeVenta(negocioId, ventaId);
  const dels = movs.filter(m => m.origen === 'cuota' && m.cobroIdx === cobroIdx && m.cuotaIdx === cuotaIdx);
  await Promise.all(dels.map(m => deleteDoc(doc(db, ...base, 'caja', m.id))));
}

export async function registrarMovimientoPagoProveedor(negocioId, venta, monto, detalle) {
  const base = ['negocios', negocioId];
  const montoNum = Number(monto) || 0;
  if (montoNum <= 0) return;
  await addDoc(collection(db, ...base, 'caja'), {
    fecha: serverTimestamp(),
    tipo: 'egreso',
    moneda: 'USD',
    monto: montoNum,
    concepto: `Pago a ${venta.proveedor || 'proveedor'} · ${labelVenta(venta)}${detalle ? ' · ' + detalle : ''}`,
    origen: 'pago_proveedor',
    categoria: CATEGORIA_POR_ORIGEN.pago_proveedor,
    ventaId: venta.id,
    cobroIdx: null,
    cuotaIdx: null,
    automatico: true,
  });
}

export async function eliminarMovimientoPagoProveedor(negocioId, ventaId) {
  await eliminarMovimientosVenta(negocioId, ventaId, 'pago_proveedor');
}

// Pago de la cuenta corriente de un proveedor (independiente de una venta puntual):
// puede ser parcial, en ARS o USD, con su forma de pago. Cada pago registrado en
// negocios/{id}/pagosProveedores dispara este egreso en caja, en la moneda real en la
// que se pagó (no siempre USD, a diferencia del viejo mecanismo por venta).
export async function registrarPagoProveedorCC(negocioId, pagoId, pago) {
  const base = ['negocios', negocioId];
  const monto = Number(pago.monto) || 0;
  if (monto <= 0) return;
  await addDoc(collection(db, ...base, 'caja'), {
    fecha: pago.fecha ? new Date(pago.fecha) : serverTimestamp(),
    tipo: 'egreso',
    moneda: pago.moneda === 'ARS' ? 'ARS' : 'USD',
    monto,
    concepto: `Pago a ${pago.proveedor || 'proveedor'}${pago.formaPago ? ' · ' + pago.formaPago : ''}${pago.nota ? ' · ' + pago.nota : ''}`,
    origen: 'pago_proveedor_cc',
    categoria: CATEGORIA_POR_ORIGEN.pago_proveedor_cc,
    ventaId: pagoId,
    cobroIdx: null,
    cuotaIdx: null,
    automatico: true,
  });
}

export async function eliminarMovimientoPagoProveedorCC(negocioId, pagoId) {
  await eliminarMovimientosVenta(negocioId, pagoId, 'pago_proveedor_cc');
}

// El monto que el cliente ya pagó por una reparación entra a caja como ingreso en USD
// (las reparaciones se presupuestan solo en dólares). Se reusa el campo `ventaId` como
// id genérico del documento de origen para poder reutilizar eliminarMovimientosVenta.
export async function registrarMovimientoReparacion(negocioId, reparacionId, reparacion) {
  const base = ['negocios', negocioId];
  const monto = Number(reparacion.montoPagado) || 0;
  if (monto <= 0) return;
  await addDoc(collection(db, ...base, 'caja'), {
    fecha: serverTimestamp(),
    tipo: 'ingreso',
    moneda: 'USD',
    monto,
    concepto: `Reparación${reparacion.modelo ? ' · ' + reparacion.modelo : ''}${reparacion.cliente ? ' · ' + reparacion.cliente : ''}`,
    origen: 'reparacion',
    categoria: CATEGORIA_POR_ORIGEN.reparacion,
    ventaId: reparacionId,
    cobroIdx: null,
    cuotaIdx: null,
    automatico: true,
  });
}

// Egreso por el costo del repuesto/insumo usado en la reparación (solo si se cargó
// el campo, que es admin-only en el form). Origen distinto del ingreso para poder
// borrar y regenerar cada uno de forma independiente.
export async function registrarEgresoRepuestoReparacion(negocioId, reparacionId, reparacion) {
  const base = ['negocios', negocioId];
  const monto = Number(reparacion.costoRepuestoUsd) || 0;
  if (monto <= 0) return;
  await addDoc(collection(db, ...base, 'caja'), {
    fecha: serverTimestamp(),
    tipo: 'egreso',
    moneda: 'USD',
    monto,
    concepto: `Repuesto reparación${reparacion.modelo ? ' · ' + reparacion.modelo : ''}${reparacion.cliente ? ' · ' + reparacion.cliente : ''}`,
    origen: 'reparacion_costo',
    categoria: CATEGORIA_POR_ORIGEN.reparacion_costo,
    ventaId: reparacionId,
    cobroIdx: null,
    cuotaIdx: null,
    automatico: true,
  });
}

// Borra TODOS los movimientos de caja ligados a una reparación (el ingreso del cobro
// y el egreso del repuesto), sin filtrar por origen — se usa antes de regenerarlos.
export async function eliminarMovimientosReparacion(negocioId, reparacionId) {
  await eliminarMovimientosVenta(negocioId, reparacionId);
}

// Reconstruye los movimientos de caja faltantes a partir de las ventas ya cargadas:
// ventas registradas antes de tener Caja, cuotas ya marcadas como pagadas y pagos a
// proveedores ya confirmados. No duplica: cada movimiento automático se identifica por
// ventaId + origen + cobroIdx + cuotaIdx y solo se crea si todavía no existe.
export async function reconciliarCaja(negocioId) {
  const base = ['negocios', negocioId];
  const [cajaSnap, ventasSnap, reparacionesSnap, pagosProveedorSnap] = await Promise.all([
    getDocs(collection(db, ...base, 'caja')),
    getDocs(collection(db, ...base, 'ventas')),
    getDocs(collection(db, ...base, 'reparaciones')),
    getDocs(collection(db, ...base, 'pagosProveedores')),
  ]);

  const existentes = new Set(
    cajaSnap.docs
      .map(d => d.data())
      .filter(m => m.automatico)
      .map(m => `${m.origen}:${m.ventaId}:${m.cobroIdx ?? ''}:${m.cuotaIdx ?? ''}`)
  );

  let creados = 0;
  for (const ventaDoc of ventasSnap.docs) {
    const venta = { id: ventaDoc.id, ...ventaDoc.data() };
    const cobros = venta.cobros || [];

    for (let i = 0; i < cobros.length; i++) {
      const cobro = cobros[i];
      if (TIPOS_SIN_CAJA.includes(cobro.tipo)) {
        if (cobro.tipo === 'Cuotas personales') {
          for (const cuotaIdx of cobro.cuotasPagadas || []) {
            const key = `cuota:${venta.id}:${i}:${cuotaIdx}`;
            if (existentes.has(key)) continue;
            await registrarMovimientoCuota(negocioId, venta.id, venta, i, cuotaIdx, cobro);
            existentes.add(key);
            creados++;
          }
        }
        continue;
      }
      const key = `venta:${venta.id}:${i}:`;
      if (existentes.has(key)) continue;
      const monto = Number(cobro.monto) || 0;
      if (monto <= 0) continue;
      await addDoc(collection(db, ...base, 'caja'), {
        fecha: venta.fecha || serverTimestamp(),
        tipo: 'ingreso',
        moneda: cobro.moneda === 'USD' ? 'USD' : 'ARS',
        monto,
        concepto: `${cobro.tipo} · ${labelVenta(venta)}${venta.cliente ? ' · ' + venta.cliente : ''}`,
        origen: 'venta',
        categoria: CATEGORIA_POR_ORIGEN.venta,
        ventaId: venta.id,
        cobroIdx: i,
        cuotaIdx: null,
        automatico: true,
      });
      existentes.add(key);
      creados++;
    }

    if (venta.pagadoProveedor && venta.montoPagadoProveedor > 0) {
      const key = `pago_proveedor:${venta.id}::`;
      if (!existentes.has(key)) {
        await registrarMovimientoPagoProveedor(negocioId, venta, venta.montoPagadoProveedor, venta.detallePagoProveedor);
        existentes.add(key);
        creados++;
      }
    }
  }

  for (const repDoc of reparacionesSnap.docs) {
    const reparacion = { id: repDoc.id, ...repDoc.data() };

    const keyIngreso = `reparacion:${reparacion.id}::`;
    if (!existentes.has(keyIngreso) && Number(reparacion.montoPagado) > 0) {
      await registrarMovimientoReparacion(negocioId, reparacion.id, reparacion);
      existentes.add(keyIngreso);
      creados++;
    }

    const keyEgreso = `reparacion_costo:${reparacion.id}::`;
    if (!existentes.has(keyEgreso) && Number(reparacion.costoRepuestoUsd) > 0) {
      await registrarEgresoRepuestoReparacion(negocioId, reparacion.id, reparacion);
      existentes.add(keyEgreso);
      creados++;
    }
  }

  for (const pagoDoc of pagosProveedorSnap.docs) {
    const pago = { id: pagoDoc.id, ...pagoDoc.data() };
    const key = `pago_proveedor_cc:${pago.id}::`;
    if (existentes.has(key)) continue;
    if (!(Number(pago.monto) > 0)) continue;
    await registrarPagoProveedorCC(negocioId, pago.id, pago);
    existentes.add(key);
    creados++;
  }

  return creados;
}

// Lo que "deberían" sumar los ingresos en efectivo/transferencia de las ventas
// registradas en un día puntual, calculado directo desde `ventas` (no desde `caja`).
// Se usa para chequear que el cierre del día calce perfecto con las ventas cargadas.
export async function calcularVentasDelDia(negocioId, fechaStr) {
  const base = ['negocios', negocioId];
  const snap = await getDocs(collection(db, ...base, 'ventas'));
  let cantidad = 0, ingresosARS = 0, ingresosUSD = 0;
  for (const d of snap.docs) {
    const venta = d.data();
    if (!venta.fecha) continue;
    const f = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
    if (fechaKey(f) !== fechaStr) continue;
    cantidad++;
    for (const cobro of venta.cobros || []) {
      if (TIPOS_SIN_CAJA.includes(cobro.tipo)) continue;
      const monto = Number(cobro.monto) || 0;
      if (monto <= 0) continue;
      if (cobro.moneda === 'USD') ingresosUSD += monto; else ingresosARS += monto;
    }
  }
  return { cantidad, ingresosARS, ingresosUSD };
}

export async function obtenerCierre(negocioId, fechaStr) {
  const base = ['negocios', negocioId];
  const snap = await getDoc(doc(db, ...base, 'cierresCaja', fechaStr));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listarCierres(negocioId, cantidad = 30) {
  const base = ['negocios', negocioId];
  const snap = await getDocs(query(collection(db, ...base, 'cierresCaja'), orderBy('fecha', 'desc'), limit(cantidad)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Cierra la caja de un día puntual dejando una foto fija de los totales. No se puede
// cerrar dos veces el mismo día (el id del doc es la fecha, y se chequea antes de crear).
export async function cerrarCajaDelDia(negocioId, fechaStr, resumen) {
  const base = ['negocios', negocioId];
  const ref = doc(db, ...base, 'cierresCaja', fechaStr);
  const existente = await getDoc(ref);
  if (existente.exists()) throw new Error('La caja de ese día ya está cerrada.');
  await setDoc(ref, { ...resumen, fecha: fechaStr, cerradoEn: serverTimestamp() });
}
