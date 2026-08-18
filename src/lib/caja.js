import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Formas de pago que no representan efectivo/transferencia recibida en el momento
// (una cuota se cobra a futuro, un iPhone de parte de pago no es dinero).
const TIPOS_SIN_CAJA = ['Cuotas personales', 'iPhone como parte de pago'];

function labelVenta(venta) {
  return `${venta.modelo || ''} ${venta.gb || ''}GB`.trim();
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
    ventaId: venta.id,
    cobroIdx: null,
    cuotaIdx: null,
    automatico: true,
  });
}

export async function eliminarMovimientoPagoProveedor(negocioId, ventaId) {
  await eliminarMovimientosVenta(negocioId, ventaId, 'pago_proveedor');
}

// Reconstruye los movimientos de caja faltantes a partir de las ventas ya cargadas:
// ventas registradas antes de tener Caja, cuotas ya marcadas como pagadas y pagos a
// proveedores ya confirmados. No duplica: cada movimiento automático se identifica por
// ventaId + origen + cobroIdx + cuotaIdx y solo se crea si todavía no existe.
export async function reconciliarCaja(negocioId) {
  const base = ['negocios', negocioId];
  const [cajaSnap, ventasSnap] = await Promise.all([
    getDocs(collection(db, ...base, 'caja')),
    getDocs(collection(db, ...base, 'ventas')),
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

  return creados;
}
