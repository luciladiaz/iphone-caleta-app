import { useEffect, useState } from 'react';
import { collection, getDocs, getDoc, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import ModalLimiteAlcanzado from '../components/ModalLimiteAlcanzado';
import ComprobanteVenta from '../components/ComprobanteVenta';
import { IconUser, IconPhone, IconX, IconEdit, IconTrash, IconFile, IconWallet, IconBox, IconArrowSwap, IconCheckCircle, IconDownload } from '../components/Icons';
import { registrarMovimientosVenta, eliminarMovimientosVenta, montoCobro, fechaKey } from '../lib/caja';
import SelectorCliente from '../components/SelectorCliente';
import SelectorEquipoStock from '../components/SelectorEquipoStock';
import { CATEGORIAS_STOCK, formatCapacidad } from '../lib/categoriasProducto';
import CampoPrecio from '../components/CampoPrecio';
import { convertirMoneda, faltaTipoCambio } from '../lib/moneda';
import { mesKey, mesLabel } from '../lib/fechas';
import { descargarExcel } from '../lib/excel';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };
const estadoColor = { pendiente: 'var(--rv-text-mid)', entregado: 'var(--rv-text)', cancelado: 'var(--rv-text-dim)' };

const ORIGENES = ['Instagram ReventApp', 'WhatsApp', 'Local físico', 'Referido', 'Facebook', 'TikTok', 'Otro'];
const FORMAS_PAGO = ['Efectivo ARS', 'Efectivo USD', 'Transferencia ARS', 'Transferencia USD', 'Cuotas personales', 'Equipo como parte de pago'];

const fechaDeVenta = (v) => v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha);

// Compara si dos arrays de cobros representan la misma forma de pago real (ignora
// cuotasPagadas, que lo actualiza Cobros.jsx aparte y no debería disparar una
// regeneración de los movimientos de caja de esta venta).
function cobrosIguales(a, b) {
  const campos = ['tipo', 'monto', 'moneda', 'cuotas', 'montoCuota', 'fechaInicio'];
  const listaA = a || [], listaB = b || [];
  if (listaA.length !== listaB.length) return false;
  return listaA.every((c, i) => campos.every(k => String(c[k] ?? '') === String(listaB[i]?.[k] ?? '')));
}

// Cobrado real de una venta, separado por moneda (sin mezclar ARS y USD), más el
// crédito recibido en equipos tomados como parte de pago (siempre en su USD canónico)
// y el saldo resultante contra el precio de venta. Es la misma cuenta que ya se muestra
// en el "Resumen de pago" del formulario, reusada acá para el Excel y las tarjetas.
function resumenVenta(venta) {
  const cobros = venta.cobros || [];
  let cobradoARS = 0, cobradoUSD = 0;
  const formasPago = [];
  for (const c of cobros) {
    const monto = montoCobro(c);
    if (c.tipo === 'Equipo como parte de pago' || c.tipo === 'iPhone como parte de pago') {
      formasPago.push(c.tipo);
      continue;
    }
    if (monto <= 0) continue;
    if (c.moneda === 'USD') cobradoUSD += monto; else cobradoARS += monto;
    formasPago.push(`${c.tipo}: ${c.moneda === 'USD' ? 'USD' : '$'} ${monto}`);
  }
  const tc = Number(venta.tipoCambio) || 0;
  const partesUSD = (venta.partesDePago || []).reduce((s, p) => s + convertirMoneda(p.costoMonto, p.costoMoneda, 'USD', tc), 0);
  const totalPagadoUSD = cobradoUSD + (tc > 0 ? cobradoARS / tc : 0) + partesUSD;
  const pvUsd = Number(venta.pvUsd) || 0;
  const saldoUSD = pvUsd - totalPagadoUSD;
  const partesTexto = (venta.partesDePago || []).map(p => `${p.modelo || ''}${p.gb ? ' ' + p.gb : ''} (${p.costoMoneda === 'ARS' ? '$' : 'USD'} ${p.costoMonto})`).join('; ');
  return { cobradoARS, cobradoUSD, partesUSD, totalPagadoUSD, saldoUSD, formasPagoTexto: formasPago.join('; '), partesTexto };
}

// Excel con el detalle completo de ventas (una fila por venta, ordenadas de la más
// vieja a la más nueva) más un resumen por mes — misma lógica de agrupación que se ve
// en pantalla, para que cuadre exacto con lo que la usuaria ve arriba.
function exportarVentasExcel(ventas, negocioId) {
  const ordenadas = [...ventas].sort((a, b) => fechaDeVenta(a) - fechaDeVenta(b));

  const filasDetalle = [[
    'Fecha', 'Cliente', 'Teléfono', 'Vendedor', 'Origen', 'Estado',
    'Categoría', 'Modelo', 'Capacidad', 'Color', 'IMEI', 'Batería %',
    'Costo USD', 'Precio venta USD', 'Tipo de cambio',
    'Cobrado ARS', 'Cobrado USD', 'Crédito partes de pago USD', 'Total pagado USD', 'Saldo USD',
    'Formas de pago', 'Equipos recibidos como parte de pago', 'Notas', 'Comprobante generado',
  ]];
  for (const v of ordenadas) {
    const r = resumenVenta(v);
    filasDetalle.push([
      fechaDeVenta(v).toLocaleDateString('es-AR'),
      v.cliente || '', v.telefono || '', v.vendedor || '', v.origen || '', v.estado || '',
      v.categoria || '', v.modelo || '', v.gb ? formatCapacidad(v.gb) : '', v.color || '', v.imei || '', v.bateria || '',
      Number(v.costoUsd) || '', Number(v.pvUsd) || '', Number(v.tipoCambio) || '',
      r.cobradoARS || '', r.cobradoUSD || '', r.partesUSD || '', r.totalPagadoUSD || '', r.saldoUSD,
      r.formasPagoTexto, r.partesTexto, v.notas || '', v.comprobante ? 'Sí' : 'No',
    ]);
  }

  const porMes = {};
  for (const v of ordenadas) {
    const key = mesKey(fechaDeVenta(v));
    if (!porMes[key]) porMes[key] = { mes: key, cantidad: 0, pvUsdTotal: 0, cobradoARS: 0, cobradoUSD: 0, saldoUSD: 0 };
    const r = resumenVenta(v);
    porMes[key].cantidad++;
    porMes[key].pvUsdTotal += Number(v.pvUsd) || 0;
    porMes[key].cobradoARS += r.cobradoARS;
    porMes[key].cobradoUSD += r.cobradoUSD;
    porMes[key].saldoUSD += r.saldoUSD;
  }
  const filasMes = [
    ['Mes', 'Ventas', 'Total facturado USD', 'Cobrado ARS', 'Cobrado USD', 'Saldo pendiente USD'],
    ...Object.values(porMes).sort((a, b) => b.mes.localeCompare(a.mes))
      .map(r => [mesLabel(r.mes), r.cantidad, r.pvUsdTotal, r.cobradoARS, r.cobradoUSD, r.saldoUSD]),
  ];

  descargarExcel(`ventas-${negocioId}-${fechaKey(new Date())}.xlsx`, [
    { nombre: 'Ventas', filas: filasDetalle, anchoColumnas: [11, 18, 14, 14, 16, 11, 10, 16, 10, 10, 16, 9, 10, 14, 12, 12, 12, 16, 14, 10, 30, 30, 24, 12] },
    { nombre: 'Resumen mensual', filas: filasMes, anchoColumnas: [16, 9, 16, 14, 14, 16] },
  ]);
}

export default function Ventas() {
  const { perfil, negocioId, negocio, plan, limitesPlan } = useAuth();
  const [comprobanteDe, setComprobanteDe] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [stock, setStock] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [origenes, setOrigenes] = useState(ORIGENES);
  const [categoriasProducto, setCategoriasProducto] = useState(CATEGORIAS_STOCK);
  const [tipoCambioGlobal, setTipoCambioGlobal] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [modalLimite, setModalLimite] = useState(false);
  const [accesorios, setAccesorios] = useState([]);
  const [form, setForm] = useState({
    tipo: 'equipo', equipoId: '', accesorioId: '', cantidadAccesorio: '1',
    clienteId: '', cliente: '', telefono: '', vendedor: '', origen: '',
    estado: 'pendiente', notas: '', tipoCambio: '', pvVentaMonto: '', pvVentaMoneda: 'USD',
    cobros: [{ tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }],
    partesDePago: []
  });
  const [nuevaParte, setNuevaParte] = useState({ categoria: 'iPhone', modelo: '', gb: '', color: '', bateria: '', imei: '', costoMonto: '', costoMoneda: 'USD', pvMonto: '', pvMoneda: 'USD' });

  const cargar = async () => {
    if (!negocioId) return;
    const base = ['negocios', negocioId];
    const [vSnap, sSnap, aSnap, vendSnap, cliSnap, cfgSnap] = await Promise.all([
      getDocs(query(collection(db, ...base, 'ventas'), orderBy('fecha', 'desc'))),
      getDocs(collection(db, ...base, 'stock')),
      getDocs(collection(db, ...base, 'accesorios')),
      getDocs(collection(db, ...base, 'vendedores')),
      getDocs(query(collection(db, ...base, 'clientes'), orderBy('nombre'))),
      getDoc(doc(db, ...base, 'config', 'general')),
    ]);
    setVentas(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setStock(sSnap.docs.filter(d => d.data().estado === 'disponible').map(d => ({ id: d.id, ...d.data() })));
    setAccesorios(aSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => (a.cantidad || 0) > 0));
    setVendedores(vendSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setClientes(cliSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const cfg = cfgSnap.data() || {};
    if (cfg.origenes) setOrigenes(cfg.origenes);
    if (cfg.categoriasProducto?.length) setCategoriasProducto(cfg.categoriasProducto);
    if (cfg.tipoCambio) setTipoCambioGlobal(String(cfg.tipoCambio));
    setLoading(false);
  };

  useEffect(() => {
    if (!negocioId) return;
    cargar();
  }, [negocioId]);

  const equipoSeleccionado = stock.find(s => s.id === form.equipoId);

  // Autocompleta el precio de venta con el que ya se cargó en Stock apenas se elige un
  // equipo (no hay que volver a escribirlo). Separado del onSeleccionar del selector
  // porque ahí "stock" quedaba capturado del cierre de ese render puntual — con la lista
  // recién cargada (ej. la primera vez que se abre "Nueva venta" en la sesión) el clic
  // podía llegar a disparar el handler con un array de stock desactualizado y el precio
  // quedaba vacío. Este efecto corre con el stock y el equipoId siempre al día.
  useEffect(() => {
    if (editando || !form.equipoId) return;
    const eq = stock.find(s => s.id === form.equipoId);
    if (!eq) return;
    const monto = eq.pvMonto ?? eq.pvUsd ?? '';
    if (!monto) return;
    setForm(f => (f.equipoId === eq.id ? { ...f, pvVentaMonto: monto, pvVentaMoneda: eq.pvMoneda || 'USD' } : f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.equipoId, stock, editando]);
  const accesorioSeleccionado = accesorios.find(a => a.id === form.accesorioId);

  const seleccionarCliente = (c) => {
    setForm(f => ({ ...f, clienteId: c?.id || '', cliente: c?.nombre || '', telefono: c?.telefono || '' }));
  };

  const agregarCobro = () => setForm(f => ({ ...f, cobros: [...f.cobros, { tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }] }));
  const quitarCobro = (i) => {
    // Los movimientos de caja de una cuota se guardan con la posición (índice) del cobro
    // dentro de este array, no con un id propio. Si se borra un cobro anterior, todos los
    // que quedan después corren de índice y sus cuotas ya cobradas quedan huérfanas en
    // Caja (dejan de encontrarse). Se bloquea ese caso en vez de romper la conciliación.
    const afectaCuotasCobradas = form.cobros.some((c, idx) => idx >= i && (c.cuotasPagadas?.length > 0));
    if (afectaCuotasCobradas) {
      alert('No se puede quitar esta forma de pago: hay cuotas ya cobradas (en esta o en una posterior) cuyos movimientos de Caja quedarían desincronizados. Si necesitás corregirla, primero desmarcá esas cuotas como pagadas desde Cobros.');
      return;
    }
    setForm(f => ({ ...f, cobros: f.cobros.filter((_, idx) => idx !== i) }));
  };
  const updateCobro = (i, campo, val) => setForm(f => ({ ...f, cobros: f.cobros.map((c, idx) => idx === i ? { ...c, [campo]: val } : c) }));

  const agregarParte = () => {
    if (!nuevaParte.modelo) return;
    setForm(f => ({ ...f, partesDePago: [...f.partesDePago, { ...nuevaParte }] }));
    setNuevaParte({ categoria: 'iPhone', modelo: '', gb: '', color: '', bateria: '', imei: '', costoMonto: '', costoMoneda: 'USD', pvMonto: '', pvMoneda: 'USD' });
  };

  const abrirComprobante = async (v) => {
    // Ventas registradas antes de sumar imei/bateria al guardado: buscamos el dato
    // en el stock si el equipo todavía existe ahí, en vez de dejarlo en blanco.
    if ((!v.imei || !v.bateria) && v.equipoId) {
      try {
        const eqSnap = await getDoc(doc(db, 'negocios', negocioId, 'stock', v.equipoId));
        if (eqSnap.exists()) {
          const eq = eqSnap.data();
          v = { ...v, imei: v.imei || eq.imei || '', bateria: v.bateria || eq.bateria || '' };
        }
      } catch (err) { console.error('Error completando IMEI/batería para el comprobante:', err); }
    }
    setComprobanteDe(v);
  };

  const eliminarVenta = async (v) => {
    const nombreItem = v.tipo === 'accesorio' ? v.modelo : `${v.modelo}${v.gb ? ' ' + formatCapacidad(v.gb) : ''}`;
    if (!window.confirm(`¿Eliminás la venta de ${nombreItem}? Esta acción no se puede deshacer.`)) return;
    const base = ['negocios', negocioId];
    await deleteDoc(doc(db, ...base, 'ventas', v.id));
    // Igual criterio que con un equipo: si la venta ya estaba cancelada, el stock del
    // accesorio ya había vuelto (ver guardar() más abajo) y pudo haberse revendido en
    // otra operación — solo se repone acá si esta venta que se borra seguía vigente.
    if (v.tipo === 'accesorio') {
      if (v.accesorioId && v.estado !== 'cancelado') {
        try {
          const accRef = doc(db, ...base, 'accesorios', v.accesorioId);
          const accSnap = await getDoc(accRef);
          if (accSnap.exists()) await updateDoc(accRef, { cantidad: (Number(accSnap.data().cantidad) || 0) + (Number(v.cantidad) || 0) });
        } catch (err) { console.error('Error devolviendo el accesorio al stock:', err); }
      }
    } else if (v.equipoId && v.estado !== 'cancelado') {
      // Si la venta ya estaba cancelada, el equipo ya había vuelto a "disponible" en ese
      // momento (ver guardar() más abajo) y pudo haberse revendido después en una venta
      // real y vigente. Forzarlo acá de nuevo a "disponible" le robaría el equipo a esa
      // venta — solo se libera si esta venta que se borra todavía lo tenía como vendido.
      try { await updateDoc(doc(db, ...base, 'stock', v.equipoId), { estado: 'disponible' }); } catch (err) { console.error('Error devolviendo el equipo al stock:', err); }
    }
    try { await eliminarMovimientosVenta(negocioId, v.id); } catch (err) { console.error('Error borrando movimientos de caja de la venta:', err); }
    cargar();
  };

  const abrirEditar = (v) => {
    setEditando(v.id);
    setForm({
      tipo: v.tipo === 'accesorio' ? 'accesorio' : 'equipo',
      equipoId: v.equipoId || '',
      accesorioId: v.accesorioId || '',
      cantidadAccesorio: v.cantidad ? String(v.cantidad) : '1',
      clienteId: v.clienteId || '',
      cliente: v.cliente || '',
      telefono: v.telefono || '',
      vendedor: v.vendedor || '',
      origen: v.origen || '',
      estado: v.estado || 'pendiente',
      notas: v.notas || '',
      tipoCambio: v.tipoCambio || '',
      // El equipo de una venta ya hecha sale del stock "disponible" (queda vendido),
      // así que no aparece en `stock` para resolver el precio: se guarda acá aparte
      // para que el resumen de pago (cobrado/saldo) siga funcionando al editar. Las
      // ventas viejas solo tienen el valor ya convertido a USD (pvUsd); las nuevas
      // guardan también en qué moneda se cargó, para reabrir mostrando lo tipeado.
      pvVentaMonto: v.pvVentaMonto ?? v.pvUsd ?? '', pvVentaMoneda: v.pvVentaMoneda || 'USD',
      cobros: v.cobros || [{ tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }],
      partesDePago: v.partesDePago || [],
    });
    setModal(true);
  };

  const cerrarModal = () => {
    setModal(false);
    setEditando(null);
    setForm({
      tipo: 'equipo', equipoId: '', accesorioId: '', cantidadAccesorio: '1',
      clienteId: '', cliente: '', telefono: '', vendedor: '', origen: '',
      estado: 'pendiente', notas: '', tipoCambio: '', pvVentaMonto: '', pvVentaMoneda: 'USD',
      cobros: [{ tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }],
      partesDePago: []
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!editando) {
      if (form.tipo === 'equipo' && !form.equipoId) { alert('Elegí un equipo antes de guardar la venta.'); return; }
      if (form.tipo === 'accesorio' && (!form.accesorioId || !form.cantidadAccesorio || Number(form.cantidadAccesorio) <= 0)) {
        alert('Elegí un accesorio y una cantidad antes de guardar la venta.');
        return;
      }
    }
    const base = ['negocios', negocioId];
    const tc = Number(form.tipoCambio || tipoCambioGlobal) || 0;
    // Si el precio se cargó en pesos y no hay tipo de cambio (ni en esta venta ni en
    // Configuración), convertirMoneda() da 0 — guardar así perdería el precio sin avisar.
    // Se frena acá en vez de dejar que se guarde con USD 0. No aplica a accesorios: esos
    // no usan pvVentaMonto/tipoCambio, el monto cobrado sale directo de "cobros".
    const esVentaEquipo = (editando ? ventas.find(v => v.id === editando)?.tipo !== 'accesorio' : form.tipo === 'equipo');
    if (esVentaEquipo && faltaTipoCambio(form.pvVentaMonto, form.pvVentaMoneda, 'USD', tc)) {
      alert('Cargaste el precio de venta en pesos pero no hay tipo de cambio disponible (ni en esta venta ni en Configuración) — se perdería el valor. Cargá un tipo de cambio o ingresá el precio directamente en USD.');
      return;
    }
    // Al EDITAR una venta ya facturada, si el campo de precio queda vacío/0 (a diferencia
    // de crear una venta nueva, acá no hay un pvUsd del equipo al que volver como
    // fallback) se bloquea el guardado en vez de pisar silenciosamente el precio real por
    // USD 0 -- por ejemplo, alguien editando solo para corregir el vendedor y de paso el
    // campo de precio queda en blanco.
    if (editando && esVentaEquipo && convertirMoneda(form.pvVentaMonto, form.pvVentaMoneda, 'USD', tc) <= 0) {
      alert('El precio de venta no puede quedar vacío o en $0 — revisá el campo antes de guardar.');
      return;
    }
    if (!editando && form.tipo === 'equipo') {
      const parteConProblema = form.partesDePago.find(p =>
        faltaTipoCambio(p.costoMonto, p.costoMoneda, 'USD', tc) || faltaTipoCambio(p.pvMonto, p.pvMoneda, 'USD', tc)
      );
      if (parteConProblema) {
        alert(`El equipo recibido como parte de pago "${parteConProblema.modelo || 'sin modelo'}" está cargado en pesos sin tipo de cambio disponible — se perdería su valor. Cargá un tipo de cambio o ingresá esos montos directamente en USD.`);
        return;
      }
    }
    setGuardando(true);
    try {
      if (editando) {
        const camposComunes = {
          clienteId: form.clienteId,
          cliente: form.cliente,
          telefono: form.telefono,
          vendedor: form.vendedor,
          origen: form.origen,
          estado: form.estado,
          notas: form.notas,
          cobros: form.cobros,
        };
        // pvUsd/tipoCambio solo aplican a ventas de equipo (para el saldo restante en
        // USD) — una venta de accesorio no los usa, el monto cobrado sale de "cobros".
        await updateDoc(doc(db, ...base, 'ventas', editando), esVentaEquipo ? {
          ...camposComunes,
          // Antes no se guardaban acá: si el equipo se cargó al stock sin precio de venta,
          // la venta quedaba con pvUsd vacío para siempre y el resumen de pago (cobrado/saldo)
          // no se podía mostrar nunca, ni corrigiéndolo desde este formulario. pvUsd es el
          // valor canónico en USD; pvVentaMonto/pvVentaMoneda respaldan lo tipeado realmente.
          pvUsd: convertirMoneda(form.pvVentaMonto, form.pvVentaMoneda, 'USD', tc),
          pvVentaMonto: Number(form.pvVentaMonto) || 0,
          pvVentaMoneda: form.pvVentaMoneda,
          tipoCambio: form.tipoCambio || tipoCambioGlobal || '',
        } : camposComunes);
        // Solo se regeneran los ingresos de caja si el cobro (o el nombre del cliente,
        // que forma parte del concepto) realmente cambió — si no, cada edición de una
        // venta vieja (aunque sea corregir el vendedor o una nota) borraba y recreaba
        // el movimiento de caja con la fecha de HOY en vez de la fecha real de la venta,
        // corriendo esa plata de mes en los reportes de Caja. Cuando sí hace falta
        // regenerar, se le pasa la fecha original de la venta para que el movimiento
        // nuevo quede fechado igual que el que reemplaza.
        const ventaOriginal = ventas.find(v => v.id === editando);
        const cobrosCambiaron = !cobrosIguales(ventaOriginal?.cobros, form.cobros) || (ventaOriginal?.cliente || '') !== (form.cliente || '');
        if (cobrosCambiaron) {
          await eliminarMovimientosVenta(negocioId, editando, 'venta');
          await registrarMovimientosVenta(negocioId, editando, {
            modelo: ventaOriginal?.modelo,
            gb: ventaOriginal?.gb,
            cliente: form.cliente,
            cobros: form.cobros,
            fecha: ventaOriginal?.fecha,
          });
        }
        // Mismo criterio que con un equipo, pero sobre el stock de accesorios: cancelar
        // devuelve la cantidad vendida, descancelar la vuelve a descontar (si sigue
        // habiendo stock suficiente).
        if (ventaOriginal?.tipo === 'accesorio' && ventaOriginal.accesorioId && ventaOriginal.estado !== form.estado) {
          const accRef = doc(db, ...base, 'accesorios', ventaOriginal.accesorioId);
          const cantidadVendida = Number(ventaOriginal.cantidad) || 0;
          if (form.estado === 'cancelado' && ventaOriginal.estado !== 'cancelado') {
            try {
              const accSnap = await getDoc(accRef);
              if (accSnap.exists()) await updateDoc(accRef, { cantidad: (Number(accSnap.data().cantidad) || 0) + cantidadVendida });
            } catch (err) { console.error('Error devolviendo el accesorio al stock:', err); }
          } else if (ventaOriginal.estado === 'cancelado' && form.estado !== 'cancelado') {
            try {
              const accSnap = await getDoc(accRef);
              const cantidadActual = accSnap.exists() ? Number(accSnap.data().cantidad) || 0 : 0;
              if (cantidadActual >= cantidadVendida) {
                await updateDoc(accRef, { cantidad: cantidadActual - cantidadVendida });
              } else {
                alert('La venta se descanceló, pero no hay stock suficiente del accesorio (puede haberse vendido en otra operación mientras estaba cancelada). Revisá el stock en Accesorios.');
              }
            } catch (err) { console.error('Error volviendo a descontar el accesorio del stock:', err); }
          }
        }
        // Cancelar una venta libera el equipo de vuelta al stock (si no, desaparece del
        // negocio para siempre sin haberse vendido realmente). Si se "descancela", vuelve
        // a marcarse vendido.
        if (ventaOriginal?.equipoId && ventaOriginal.estado !== form.estado) {
          if (form.estado === 'cancelado' && ventaOriginal.estado !== 'cancelado') {
            try { await updateDoc(doc(db, ...base, 'stock', ventaOriginal.equipoId), { estado: 'disponible' }); } catch (err) { console.error('Error devolviendo el equipo al stock al cancelar:', err); }
          } else if (ventaOriginal.estado === 'cancelado' && form.estado !== 'cancelado') {
            // Al "descancelar", el equipo pudo haberse revendido mientras tanto en otra
            // venta real (quedó "vendido" u "asignado" ahí) — solo se lo vuelve a marcar
            // vendido acá si sigue "disponible"; si no, se avisa en vez de pisarlo.
            try {
              const stockRef = doc(db, ...base, 'stock', ventaOriginal.equipoId);
              const stockSnap = await getDoc(stockRef);
              if (stockSnap.exists() && stockSnap.data().estado === 'disponible') {
                await updateDoc(stockRef, { estado: 'vendido' });
              } else {
                alert('La venta se descanceló, pero el equipo ya no figura como disponible en Stock (puede que se haya vendido en otra operación mientras esta venta estaba cancelada). Revisá el estado del equipo en Stock.');
              }
            } catch (err) { console.error('Error volviendo a marcar el equipo como vendido:', err); }
          }
        }
      } else if (form.tipo === 'accesorio') {
        const cantidadNum = parseInt(form.cantidadAccesorio) || 0;
        const ventaData = {
          tipo: 'accesorio',
          accesorioId: form.accesorioId,
          // Reusa los campos categoria/modelo/color (pensados para equipos) para que la
          // venta de accesorio se vea bien en la lista y en el Excel sin duplicar columnas.
          categoria: accesorioSeleccionado?.categoria || '',
          modelo: accesorioSeleccionado?.nombre || '',
          color: [accesorioSeleccionado?.modelo, accesorioSeleccionado?.color].filter(Boolean).join(' · '),
          cantidad: cantidadNum,
          clienteId: form.clienteId,
          cliente: form.cliente,
          telefono: form.telefono,
          vendedor: form.vendedor,
          origen: form.origen,
          estado: form.estado,
          notas: form.notas,
          cobros: form.cobros,
          fecha: serverTimestamp(),
        };
        const ventaRef = doc(collection(db, ...base, 'ventas'));
        // Misma garantía que al vender un equipo: la transacción relee el stock del
        // accesorio justo antes de confirmar, así dos ventas abiertas a la vez sobre la
        // última unidad no pueden vender las dos.
        await runTransaction(db, async (transaction) => {
          const accRef = doc(db, ...base, 'accesorios', form.accesorioId);
          const accSnap = await transaction.get(accRef);
          const cantidadActual = accSnap.exists() ? Number(accSnap.data().cantidad) || 0 : 0;
          if (cantidadActual < cantidadNum) {
            throw new Error(`Solo quedan ${cantidadActual} unidades disponibles (puede que se haya vendido stock en otra operación mientras tenías esto abierto).`);
          }
          transaction.set(ventaRef, ventaData);
          transaction.update(accRef, { cantidad: cantidadActual - cantidadNum });
        });
        await registrarMovimientosVenta(negocioId, ventaRef.id, ventaData);
      } else {
        const equipo = stock.find(s => s.id === form.equipoId);
        const ventaData = {
          ...form,
          // Si se deja en blanco, se guarda el TC global vigente en vez de "" — así el
          // Dashboard Gerencial no termina recalculando esta venta con el TC de hoy
          // (que puede ser muy distinto) cuando busca convertir ARS/USD a futuro.
          tipoCambio: form.tipoCambio || tipoCambioGlobal || '',
          fecha: serverTimestamp(),
          categoria: equipo?.categoria || '',
          modelo: equipo?.modelo || '',
          gb: equipo?.gb || '',
          color: equipo?.color || '',
          imei: equipo?.imei || '',
          bateria: equipo?.bateria || '',
          proveedor: equipo?.proveedor || '',
          costoUsd: equipo?.costoUsd || '',
          pvUsd: convertirMoneda(form.pvVentaMonto, form.pvVentaMoneda, 'USD', tc) || equipo?.pvUsd || '',
          equipoId: form.equipoId,
        };
        const ventaRef = doc(collection(db, ...base, 'ventas'));
        // Transacción: relee el equipo justo antes de confirmar y solo escribe si sigue
        // "disponible". Sin esto, dos ventas abiertas a la vez sobre la última unidad de
        // un equipo podían venderse las dos (la segunda pisaba el estado sin chequear nada).
        await runTransaction(db, async (transaction) => {
          const stockRef = doc(db, ...base, 'stock', form.equipoId);
          const stockSnap = await transaction.get(stockRef);
          if (!stockSnap.exists() || stockSnap.data().estado !== 'disponible') {
            throw new Error('Este equipo ya no está disponible (puede que otra persona ya lo haya vendido). Elegí otro equipo.');
          }
          transaction.set(ventaRef, ventaData);
          transaction.update(stockRef, { estado: 'vendido' });
        });
        await registrarMovimientosVenta(negocioId, ventaRef.id, ventaData);
        const clienteQueEntrega = clientes.find(c => c.id === form.clienteId);
        for (const parte of form.partesDePago) {
          await addDoc(collection(db, ...base, 'stock'), {
            ...parte,
            tipo: 'parte_de_pago',
            estado: 'disponible',
            fechaIngreso: serverTimestamp(),
            costoUsd: convertirMoneda(parte.costoMonto, parte.costoMoneda, 'USD', tc),
            pvUsd: convertirMoneda(parte.pvMonto, parte.pvMoneda, 'USD', tc),
            origen: {
              tipo: 'parte_de_pago',
              clienteId: form.clienteId || null,
              clienteNombre: form.cliente || clienteQueEntrega?.nombre || '',
              clienteNumero: clienteQueEntrega?.numero || null,
              ventaOrigenId: ventaRef.id,
              ventaOrigenModelo: `${ventaData.modelo}${ventaData.gb ? ' ' + ventaData.gb : ''}`.trim(),
            },
          });
        }
      }
      cerrarModal();
      cargar();
    } catch (err) {
      console.error(err);
      alert(err.message || 'No se pudo guardar la venta. Probá de nuevo.');
      cargar();
    } finally { setGuardando(false); }
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando ventas...</div>;

  const tcForm = Number(form.tipoCambio || tipoCambioGlobal) || 0;
  // Al editar, el tipo lo define la venta original (no se puede cambiar después de
  // creada); al crear, lo define el toggle "Equipo / Accesorio" recién elegido.
  const ventaEnEdicion = editando ? ventas.find(v => v.id === editando) : null;
  const esVentaEquipoActual = ventaEnEdicion ? ventaEnEdicion.tipo !== 'accesorio' : form.tipo === 'equipo';

  const hoyV = new Date();
  const primerDiaMesV = new Date(hoyV.getFullYear(), hoyV.getMonth(), 1);
  const ventasMesCount = ventas.filter(v => {
    const fecha = v.fecha?.toDate?.() || new Date(v.fecha);
    return fecha >= primerDiaMesV;
  }).length;
  const maxVentasMes = limitesPlan?.maxVentasMes ?? Infinity;
  const limiteVentasAlcanzado = maxVentasMes !== Infinity && ventasMesCount >= maxVentasMes;

  const handleNuevaVenta = () => {
    if (limiteVentasAlcanzado) { setModalLimite(true); return; }
    // Limpia cualquier dato que haya quedado cargado de un intento anterior (equipo,
    // precio, cobros) — sin esto, una "Nueva venta" podía arrancar con el precio o el
    // equipo de la venta que se estaba editando o creando justo antes.
    setEditando(null);
    setForm({
      tipo: 'equipo', equipoId: '', accesorioId: '', cantidadAccesorio: '1',
      clienteId: '', cliente: '', telefono: '', vendedor: '', origen: '',
      estado: 'pendiente', notas: '', tipoCambio: '', pvVentaMonto: '', pvVentaMoneda: 'USD',
      cobros: [{ tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }],
      partesDePago: []
    });
    setModal(true);
  };

  // Ventas agrupadas por mes calendario (más reciente primero); dentro de cada mes
  // se mantiene el orden que ya trae `ventas` (más nueva primero, por la query a Firestore).
  const ventasPorMes = {};
  for (const v of ventas) {
    const key = mesKey(fechaDeVenta(v));
    (ventasPorMes[key] ||= []).push(v);
  }
  const mesesOrdenados = Object.keys(ventasPorMes).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Ventas</h1>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, margin: '4px 0 0' }}>{ventas.length} ventas registradas</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => exportarVentasExcel(ventas, negocioId)} disabled={ventas.length === 0} title="Descarga un Excel con el detalle completo de las ventas, más un resumen por mes" style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-text)', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: ventas.length === 0 ? 'not-allowed' : 'pointer', opacity: ventas.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconDownload size={14} />Exportar Excel
          </button>
          <button onClick={handleNuevaVenta} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + Nueva venta
          </button>
        </div>
      </div>

      {mesesOrdenados.map(mes => {
        const ventasDelMes = ventasPorMes[mes];
        const totalPvUsd = ventasDelMes.reduce((s, v) => s + (Number(v.pvUsd) || 0), 0);
        return (
        <div key={mes} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--rv-border)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>{mesLabel(mes)}</h2>
            <span style={{ color: 'var(--rv-text-dim)', fontSize: 12 }}>
              {ventasDelMes.length} venta{ventasDelMes.length === 1 ? '' : 's'}{totalPvUsd > 0 ? ` · USD ${totalPvUsd.toLocaleString('es-AR', { maximumFractionDigits: 0 })} facturado` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ventasDelMes.map(v => (
              <div key={v.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {v.modelo}{v.gb ? ` ${formatCapacidad(v.gb)}` : ''} {v.color}
                    {v.tipo === 'accesorio' && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--rv-accent)', background: 'var(--rv-accent-soft)', borderRadius: 6, padding: '2px 7px' }}>
                        Accesorio{v.cantidad > 1 ? ` ×${v.cantidad}` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <IconUser size={11} />{v.cliente || 'Sin cliente'}
                    {v.telefono ? (
                      <a href={`tel:${v.telefono}`} style={{ color: 'var(--rv-accent)', marginLeft: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconPhone size={11} />{v.telefono}
                      </a>
                    ) : (
                      <span title="Sin teléfono — editá la venta para agregarlo" style={{ marginLeft: 4, opacity: 0.5, cursor: 'help', display: 'inline-flex' }}><IconPhone size={11} /></span>
                    )}
                    <span>· {v.vendedor || '-'} · {v.origen || '-'}</span>
                    {v.tipoCambio && <span style={{ color: 'var(--rv-accent)', marginLeft: 6 }}>· TC ${v.tipoCambio}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, border: '1px solid var(--rv-border)', color: estadoColor[v.estado] }}>
                    {v.estado}
                  </span>
                  <button onClick={() => abrirComprobante(v)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: v.comprobante ? 'var(--rv-text)' : 'var(--rv-text-mid)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconFile size={13} />{v.comprobante ? 'Ver comprobante' : 'Comprobante'}
                  </button>
                  <button onClick={() => abrirEditar(v)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-accent)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconEdit size={13} />Editar
                  </button>
                  <button onClick={() => eliminarVenta(v)} style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', color: 'var(--rv-danger)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex' }}>
                    <IconTrash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        );
      })}
      {ventas.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
          <IconWallet size={36} style={{ marginBottom: 12 }} />
          <p>No hay ventas registradas</p>
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}>{editando ? <><IconEdit size={16} />Editar venta</> : 'Nueva venta'}</h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tipo de venta */}
              {!editando && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ key: 'equipo', label: 'Equipo' }, { key: 'accesorio', label: 'Accesorio' }].map(t => (
                    <button
                      key={t.key} type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: t.key }))}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                        border: `1px solid ${form.tipo === t.key ? 'var(--rv-accent)' : 'var(--rv-border)'}`,
                        background: form.tipo === t.key ? 'var(--rv-accent-soft)' : 'var(--rv-surface-alt)',
                        color: form.tipo === t.key ? 'var(--rv-accent)' : 'var(--rv-text-dim)',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Equipo */}
              {!editando && form.tipo === 'equipo' && (
                <SelectorEquipoStock
                  stock={stock}
                  equipoId={form.equipoId}
                  onSeleccionar={id => setForm(f => ({ ...f, equipoId: id }))}
                />
              )}
              {equipoSeleccionado && (
                <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--rv-accent)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <IconBox size={13} />{equipoSeleccionado.modelo}{equipoSeleccionado.gb ? ` · ${formatCapacidad(equipoSeleccionado.gb)}` : ''} · {equipoSeleccionado.color}{equipoSeleccionado.bateria ? ` · Bat ${equipoSeleccionado.bateria}%` : ''} · Costo USD {equipoSeleccionado.costoUsd}
                </div>
              )}

              {/* Accesorio */}
              {!editando && form.tipo === 'accesorio' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Accesorio *</label>
                    <select
                      value={form.accesorioId}
                      onChange={e => setForm(f => ({ ...f, accesorioId: e.target.value, cantidadAccesorio: '1' }))}
                      style={inputStyle}
                    >
                      <option value="">Elegir...</option>
                      {accesorios.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}{a.modelo || a.color ? ` · ${[a.modelo, a.color].filter(Boolean).join(' ')}` : ''} (stock: {a.cantidad})
                        </option>
                      ))}
                    </select>
                    {accesorios.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--rv-text-dim)', marginTop: 4 }}>No hay accesorios con stock disponible.</div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Cantidad *</label>
                    <input
                      type="number" min="1" max={accesorioSeleccionado?.cantidad || 1}
                      value={form.cantidadAccesorio}
                      onChange={e => setForm(f => ({ ...f, cantidadAccesorio: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
              {accesorioSeleccionado && (
                <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--rv-accent)' }}>
                  {accesorioSeleccionado.cantidad} unidades disponibles
                </div>
              )}

              {/* Cliente */}
              <SelectorCliente
                negocioId={negocioId}
                clientes={clientes}
                clienteId={form.clienteId}
                onSeleccionar={seleccionarCliente}
                onClienteCreado={(c) => setClientes(cs => [...cs, c].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Vendedor</label>
                  <select value={form.vendedor} onChange={e => setForm({ ...form, vendedor: e.target.value })} style={inputStyle}>
                    <option value="">Elegir...</option>
                    {vendedores.map(v => <option key={v.id}>{v.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Origen de la venta</label>
                  <select value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} style={inputStyle}>
                    <option value="">Elegir...</option>
                    {origenes.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estado</label>
                  <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={inputStyle}>
                    <option value="pendiente">Pendiente</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                {esVentaEquipoActual && (
                  <>
                    <div>
                      <label style={labelStyle}>
                        Tipo de cambio (ARS/USD)
                        {tipoCambioGlobal && <span style={{ color: 'var(--rv-text-dim)', fontWeight: 400, marginLeft: 6 }}>— Global: ${tipoCambioGlobal}</span>}
                      </label>
                      <input
                        type="number"
                        value={form.tipoCambio}
                        onChange={e => setForm({ ...form, tipoCambio: e.target.value })}
                        placeholder={tipoCambioGlobal || '1430'}
                        style={inputStyle}
                      />
                    </div>
                    <CampoPrecio
                      label="Precio de venta"
                      monto={form.pvVentaMonto} moneda={form.pvVentaMoneda}
                      onChange={({ monto, moneda }) => setForm({ ...form, pvVentaMonto: monto, pvVentaMoneda: moneda })}
                      tipoCambio={tcForm} placeholder="500"
                    />
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: 11, color: 'var(--rv-text-dim)' }}>
                        Si no modificás el TC, se usa el tipo de cambio global de configuración.
                        {' '}El precio de venta se toma del equipo elegido; si quedó vacío ahí, cargalo acá para que se calcule el saldo.
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Cobros */}
              <div style={{ borderTop: '1px solid var(--rv-border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Formas de pago</label>
                  <button type="button" onClick={agregarCobro} style={{ background: 'none', border: '1px solid var(--rv-accent)', color: 'var(--rv-accent)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>+ Agregar</button>
                </div>
                {(() => {
                  const tc = Number(form.tipoCambio || tipoCambioGlobal) || 0;
                  const pvUsd = convertirMoneda(form.pvVentaMonto, form.pvVentaMoneda, 'USD', tc) || Number(equipoSeleccionado?.pvUsd) || 0;

                  const cobradoUsd = form.cobros.reduce((sum, c) => {
                    if (c.tipo === 'Equipo como parte de pago') return sum;
                    const monto = c.tipo === 'Cuotas personales'
                      ? (Number(c.cuotas) || 0) * (Number(c.montoCuota) || 0)
                      : Number(c.monto) || 0;
                    return sum + (c.moneda === 'USD' ? monto : tc > 0 ? monto / tc : 0);
                  }, 0);
                  const partesUsd = form.partesDePago.reduce((s, p) => s + convertirMoneda(p.costoMonto, p.costoMoneda, 'USD', tc), 0);
                  const totalPagadoUsd = cobradoUsd + partesUsd;
                  const saldoUsd = pvUsd - totalPagadoUsd;
                  const saldoArs = tc > 0 ? saldoUsd * tc : 0;

                  return (
                    <>
                      {form.cobros.map((cobro, i) => (
                        <div key={i} style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ gridColumn: '1/-1' }}>
                              <label style={labelStyle}>Tipo</label>
                              <select value={cobro.tipo} onChange={e => {
                                const t = e.target.value;
                                updateCobro(i, 'tipo', t);
                                if (t.includes('USD')) updateCobro(i, 'moneda', 'USD');
                                else if (t.includes('ARS')) updateCobro(i, 'moneda', 'ARS');
                              }} style={inputStyle}>
                                {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                              </select>
                            </div>
                            {/* El "Monto" genérico es plata en mano ya cobrada -- en "Cuotas
                                personales" ese lugar lo ocupan "Monto por cuota" y "Cant.
                                cuotas" de abajo, así que se oculta acá: si se llegaba a
                                cargar algo en este campo para una seña en efectivo, quedaba
                                guardado en `cobro.monto` pero montoCobro()/caja.js lo ignoran
                                por completo para este tipo -- esa plata desaparecía de Caja y
                                de "cobrado" sin ningún aviso. La Moneda sí se mantiene, la usan
                                también las cuotas (para saber si montoCuota es ARS o USD). */}
                            {cobro.tipo !== 'Equipo como parte de pago' && cobro.tipo !== 'Cuotas personales' && (
                              <div>
                                <label style={labelStyle}>Monto</label>
                                <input type="number" value={cobro.monto} onChange={e => updateCobro(i, 'monto', e.target.value)} placeholder="0" style={inputStyle} />
                                {tc > 0 && cobro.monto > 0 && (
                                  <div style={{ fontSize: 11, color: 'var(--rv-accent)', marginTop: 4 }}>
                                    {cobro.moneda === 'ARS'
                                      ? `≈ USD ${(Number(cobro.monto) / tc).toFixed(2)}`
                                      : `≈ ARS $${(Number(cobro.monto) * tc).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`}
                                  </div>
                                )}
                              </div>
                            )}
                            {cobro.tipo !== 'Equipo como parte de pago' && (
                              <div>
                                <label style={labelStyle}>Moneda</label>
                                <select value={cobro.moneda} onChange={e => updateCobro(i, 'moneda', e.target.value)} style={inputStyle}>
                                  <option>ARS</option><option>USD</option>
                                </select>
                              </div>
                            )}
                            {cobro.tipo === 'Cuotas personales' && (
                              <>
                                <div>
                                  <label style={labelStyle}>Cant. cuotas</label>
                                  <input type="number" value={cobro.cuotas} onChange={e => updateCobro(i, 'cuotas', e.target.value)} placeholder="12" style={inputStyle} />
                                </div>
                                <div>
                                  <label style={labelStyle}>Monto por cuota</label>
                                  <input type="number" value={cobro.montoCuota} onChange={e => updateCobro(i, 'montoCuota', e.target.value)} placeholder="0" style={inputStyle} />
                                  {tc > 0 && cobro.montoCuota > 0 && cobro.cuotas > 0 && (
                                    <div style={{ fontSize: 11, color: 'var(--rv-accent)', marginTop: 4 }}>
                                      Total {cobro.cuotas} cuotas: {cobro.moneda === 'ARS'
                                        ? `$${(Number(cobro.cuotas) * Number(cobro.montoCuota)).toLocaleString('es-AR')} ≈ USD ${((Number(cobro.cuotas) * Number(cobro.montoCuota)) / tc).toFixed(2)}`
                                        : `USD ${(Number(cobro.cuotas) * Number(cobro.montoCuota)).toFixed(2)}`}
                                    </div>
                                  )}
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                  <label style={labelStyle}>Fecha primera cuota</label>
                                  <input type="date" value={cobro.fechaInicio} onChange={e => updateCobro(i, 'fechaInicio', e.target.value)} style={inputStyle} />
                                </div>
                              </>
                            )}
                          </div>
                          {form.cobros.length > 1 && (
                            <button type="button" onClick={() => quitarCobro(i)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--rv-danger)', fontSize: 12, cursor: 'pointer' }}>Quitar</button>
                          )}
                        </div>
                      ))}

                      {/* Resumen de pago */}
                      {pvUsd > 0 && tc > 0 && (
                        <div style={{ borderRadius: 10, border: '1px solid rgba(47,111,237,0.3)', background: 'var(--rv-accent-soft)', padding: 14, marginTop: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rv-text-dim)', marginBottom: 10, textTransform: 'uppercase' }}>Resumen de pago</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <span style={{ color: 'var(--rv-text-dim)' }}>Precio de venta</span>
                              <span style={{ fontWeight: 700 }}>USD {pvUsd.toFixed(2)} <span style={{ color: 'var(--rv-text-dim)', fontWeight: 400 }}>· ${(pvUsd * tc).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS</span></span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <span style={{ color: 'var(--rv-text-dim)' }}>Cobrado</span>
                              <span style={{ fontWeight: 700, color: 'var(--rv-text)' }}>USD {totalPagadoUsd.toFixed(2)} <span style={{ color: 'var(--rv-text-dim)', fontWeight: 400 }}>· ${(totalPagadoUsd * tc).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS</span></span>
                            </div>
                            <div style={{ borderTop: '1px solid var(--rv-border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                              <span style={{ fontWeight: 700 }}>Saldo restante</span>
                              <span style={{ fontWeight: 800, color: saldoUsd <= 0 ? 'var(--rv-text)' : 'var(--rv-text-mid)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {saldoUsd <= 0 ? <><IconCheckCircle size={14} style={{ color: 'var(--rv-accent)' }} />Saldado</> : `USD ${saldoUsd.toFixed(2)} · $${saldoArs.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Partes de pago (equipos recibidos) */}
              {!editando && form.tipo === 'equipo' && (
                <div style={{ borderTop: '1px solid var(--rv-border)', paddingTop: 16 }}>
                  <label style={{ ...labelStyle, marginBottom: 12 }}>Equipos recibidos como parte de pago</label>
                  {form.partesDePago.map((p, i) => (
                    <div key={i} style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: 'var(--rv-accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconArrowSwap size={13} />{p.modelo} {p.gb ? formatCapacidad(p.gb) : ''} {p.color}</span>
                        <div style={{ color: 'var(--rv-text-dim)', fontSize: 11, marginTop: 3 }}>
                          Toma: {p.costoMoneda === 'ARS' ? '$' : 'USD'} {p.costoMonto} · Venta: {p.pvMoneda === 'ARS' ? '$' : 'USD'} {p.pvMonto}
                        </div>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, partesDePago: f.partesDePago.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: 'var(--rv-danger)', cursor: 'pointer', display: 'flex' }}><IconX size={15} /></button>
                    </div>
                  ))}
                  <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div><label style={labelStyle}>Categoría</label><select value={nuevaParte.categoria} onChange={e => setNuevaParte({ ...nuevaParte, categoria: e.target.value })} style={inputStyle}>{categoriasProducto.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      <div><label style={labelStyle}>Modelo</label><input value={nuevaParte.modelo} onChange={e => setNuevaParte({ ...nuevaParte, modelo: e.target.value })} placeholder="iPhone 13" style={inputStyle} /></div>
                      <div><label style={labelStyle}>Capacidad / specs</label><input value={nuevaParte.gb} onChange={e => setNuevaParte({ ...nuevaParte, gb: e.target.value })} placeholder="128" style={inputStyle} /></div>
                      <div><label style={labelStyle}>Color</label><input value={nuevaParte.color} onChange={e => setNuevaParte({ ...nuevaParte, color: e.target.value })} placeholder="Negro" style={inputStyle} /></div>
                      <div><label style={labelStyle}>Batería %</label><input type="number" value={nuevaParte.bateria} onChange={e => setNuevaParte({ ...nuevaParte, bateria: e.target.value })} placeholder="85" style={inputStyle} /></div>
                      <div><label style={labelStyle}>IMEI / N° de serie</label><input value={nuevaParte.imei} onChange={e => setNuevaParte({ ...nuevaParte, imei: e.target.value })} style={inputStyle} /></div>
                      <div style={{ gridColumn: '1/-1', background: 'var(--rv-accent-soft)', border: '1px solid rgba(47,111,237,0.15)', borderRadius: 8, padding: 10 }}>
                        <div style={{ color: 'var(--rv-accent)', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>VALUACIÓN DEL EQUIPO RECIBIDO</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <CampoPrecio
                              label="Lo tomo a (costo)"
                              monto={nuevaParte.costoMonto} moneda={nuevaParte.costoMoneda}
                              onChange={({ monto, moneda }) => setNuevaParte({ ...nuevaParte, costoMonto: monto, costoMoneda: moneda })}
                              tipoCambio={tcForm} placeholder="200"
                            />
                            <div style={{ fontSize: 10, color: 'var(--rv-text-dim)', marginTop: 3 }}>Valor que le reconocés al cliente</div>
                          </div>
                          <div>
                            <CampoPrecio
                              label="Lo vendo a (precio venta)"
                              monto={nuevaParte.pvMonto} moneda={nuevaParte.pvMoneda}
                              onChange={({ monto, moneda }) => setNuevaParte({ ...nuevaParte, pvMonto: monto, pvMoneda: moneda })}
                              tipoCambio={tcForm} placeholder="280"
                            />
                            <div style={{ fontSize: 10, color: 'var(--rv-text-dim)', marginTop: 3 }}>Se carga en stock como precio de venta</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={agregarParte} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Agregar equipo</button>
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Guardar venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalLimite && (
        <ModalLimiteAlcanzado
          tipo="ventas" planActual={plan}
          cantidadActual={ventasMesCount}
          onCerrar={() => setModalLimite(false)}
        />
      )}
      {comprobanteDe && (
        <ComprobanteVenta
          venta={comprobanteDe}
          negocioId={negocioId}
          negocioNombre={negocio?.nombre}
          vendedorNombre={perfil?.nombre}
          onClose={() => setComprobanteDe(null)}
          onGuardado={(comprobante) => {
            setVentas(vs => vs.map(v => v.id === comprobanteDe.id ? { ...v, comprobante } : v));
            setComprobanteDe(null);
          }}
        />
      )}
    </div>
  );
}

