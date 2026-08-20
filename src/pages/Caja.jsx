import { useEffect, useState } from 'react';
import { collection, getDocs, getDoc, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconWallet, IconCoin, IconPlus, IconTrash, IconX, IconTrendUp, IconTrendDown, IconCalendar, IconRefresh, IconLock, IconCheckCircle, IconWarning, IconChart, IconDownload } from '../components/Icons';
import { reconciliarCaja, calcularVentasDelDia, obtenerCierre, listarCierres, cerrarCajaDelDia, fechaKey, fechaDeMovimiento, CATEGORIAS_INGRESO as CATEGORIAS_INGRESO_DEFAULT, CATEGORIAS_EGRESO as CATEGORIAS_EGRESO_DEFAULT } from '../lib/caja';
import { mesKey, mesLabel } from '../lib/fechas';
import { descargarExcel } from '../lib/excel';
import GraficoIngresosEgresos from '../components/GraficoIngresosEgresos';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const ORIGEN_LABEL = { venta: 'Venta', cuota: 'Cuota', pago_proveedor: 'Pago a proveedor', pago_proveedor_cc: 'Pago a proveedor', reparacion: 'Reparación', reparacion_costo: 'Repuesto reparación', manual: 'Otro' };

// Los movimientos automáticos ya vienen con `categoria` asignada sola; para los pocos
// movimientos manuales viejos que no la tenían todavía, se cae al label de su origen.
function categoriaDe(m) {
  return m.categoria || ORIGEN_LABEL[m.origen] || 'Otro';
}

const FILTROS_MONEDA = [
  { key: 'todas', label: 'Todas' },
  { key: 'ARS', label: 'Pesos' },
  { key: 'USD', label: 'Dólares' },
];
const FILTROS_TIPO = [
  { key: 'todos', label: 'Todos' },
  { key: 'ingreso', label: 'Ingresos' },
  { key: 'egreso', label: 'Egresos' },
];
const PERIODOS_REPORTE = [7, 14, 30, 90];

// Agrupa los movimientos de una moneda en series diarias { fecha, ingreso, egreso }
// para los últimos `dias`, completando con ceros los días sin movimientos.
function agruparPorDia(movimientos, moneda, dias) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const desde = new Date(hoy); desde.setDate(desde.getDate() - (dias - 1));
  const mapa = {};
  for (let i = 0; i < dias; i++) {
    const d = new Date(desde); d.setDate(d.getDate() + i);
    mapa[fechaKey(d)] = { fecha: fechaKey(d), ingreso: 0, egreso: 0 };
  }
  for (const m of movimientos) {
    if (m.moneda !== moneda) continue;
    const key = fechaKey(fechaDeMovimiento(m));
    if (!mapa[key]) continue;
    mapa[key][m.tipo === 'ingreso' ? 'ingreso' : 'egreso'] += Number(m.monto) || 0;
  }
  return Object.values(mapa).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Agrupa movimientos por día o por mes (según `claveDe`) en filas { periodo, cantidad,
// ingresoARS, egresoARS, netoARS, ingresoUSD, egresoUSD, netoUSD }, ordenadas de la más
// reciente a la más vieja (para revisar rápido "cómo vino el mes/el día").
function resumenPorPeriodo(movimientos, claveDe) {
  const mapa = {};
  for (const m of movimientos) {
    const periodo = claveDe(fechaDeMovimiento(m));
    if (!mapa[periodo]) mapa[periodo] = { periodo, cantidad: 0, ingresoARS: 0, egresoARS: 0, ingresoUSD: 0, egresoUSD: 0 };
    const monto = Number(m.monto) || 0;
    const esUSD = m.moneda === 'USD';
    const esIngreso = m.tipo === 'ingreso';
    mapa[periodo].cantidad++;
    mapa[periodo][`${esIngreso ? 'ingreso' : 'egreso'}${esUSD ? 'USD' : 'ARS'}`] += monto;
  }
  return Object.values(mapa)
    .map(r => ({ ...r, netoARS: r.ingresoARS - r.egresoARS, netoUSD: r.ingresoUSD - r.egresoUSD }))
    .sort((a, b) => b.periodo.localeCompare(a.periodo));
}

// Arma el Excel completo de la caja: detalle día por día (con saldo acumulado por
// moneda, calculado sobre TODOS los movimientos sin importar qué filtro esté activo
// en pantalla, para que la última fila dé siempre igual al saldo que se ve arriba) más
// un resumen por día y un resumen por mes, cada uno en su propia hoja.
function exportarCajaExcel(movimientos, negocioId) {
  const ordenados = [...movimientos].sort((a, b) => fechaDeMovimiento(a) - fechaDeMovimiento(b));

  const filasDetalle = [[
    'Fecha', 'Hora', 'Tipo', 'Categoría', 'Concepto', 'Moneda',
    'Ingreso ARS', 'Egreso ARS', 'Ingreso USD', 'Egreso USD',
    'Saldo ARS acumulado', 'Saldo USD acumulado',
    'Origen', 'Automático', 'ID de referencia',
  ]];
  let saldoARS = 0, saldoUSD = 0;
  for (const m of ordenados) {
    const monto = Number(m.monto) || 0;
    const esUSD = m.moneda === 'USD';
    const esIngreso = m.tipo === 'ingreso';
    if (esUSD) saldoUSD += esIngreso ? monto : -monto;
    else saldoARS += esIngreso ? monto : -monto;

    const fecha = fechaDeMovimiento(m);
    filasDetalle.push([
      fecha.toLocaleDateString('es-AR'),
      fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      esIngreso ? 'Ingreso' : 'Egreso',
      categoriaDe(m),
      m.concepto || '',
      esUSD ? 'USD' : 'ARS',
      !esUSD && esIngreso ? monto : '',
      !esUSD && !esIngreso ? monto : '',
      esUSD && esIngreso ? monto : '',
      esUSD && !esIngreso ? monto : '',
      saldoARS,
      saldoUSD,
      ORIGEN_LABEL[m.origen] || 'Otro',
      m.automatico ? 'Sí' : 'No',
      m.ventaId || '',
    ]);
  }

  const filasPeriodo = (resumen, etiquetaPeriodo) => [
    [etiquetaPeriodo, 'Movimientos', 'Ingreso ARS', 'Egreso ARS', 'Neto ARS', 'Ingreso USD', 'Egreso USD', 'Neto USD'],
    ...resumen.map(r => [r.periodo, r.cantidad, r.ingresoARS, r.egresoARS, r.netoARS, r.ingresoUSD, r.egresoUSD, r.netoUSD]),
  ];

  descargarExcel(`caja-${negocioId}-${fechaKey(new Date())}.xlsx`, [
    { nombre: 'Detalle', filas: filasDetalle, anchoColumnas: [11, 7, 9, 16, 40, 7, 12, 12, 12, 12, 16, 16, 16, 11, 20] },
    { nombre: 'Por día', filas: filasPeriodo(resumenPorPeriodo(movimientos, fechaKey), 'Día'), anchoColumnas: [12, 12, 12, 12, 12, 12, 12, 12] },
    { nombre: 'Por mes', filas: filasPeriodo(resumenPorPeriodo(movimientos, mesKey).map(r => ({ ...r, periodo: mesLabel(r.periodo) })), 'Mes'), anchoColumnas: [16, 12, 12, 12, 12, 12, 12, 12] },
  ]);
}

export default function Caja() {
  const { negocioId, perfil } = useAuth();
  const base = ['negocios', negocioId];
  const [movimientos, setMovimientos] = useState([]);
  const [cierreHoy, setCierreHoy] = useState(null);
  const [historialCierres, setHistorialCierres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroMoneda, setFiltroMoneda] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [vistaListado, setVistaListado] = useState('movimientos');
  const [periodoReporte, setPeriodoReporte] = useState(14);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [reconciliando, setReconciliando] = useState(false);
  const [modalCierre, setModalCierre] = useState(false);
  const [cargandoReconciliacion, setCargandoReconciliacion] = useState(false);
  const [reconciliacionCierre, setReconciliacionCierre] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const [categoriasIngreso, setCategoriasIngreso] = useState(CATEGORIAS_INGRESO_DEFAULT);
  const [categoriasEgreso, setCategoriasEgreso] = useState(CATEGORIAS_EGRESO_DEFAULT);
  const [form, setForm] = useState({ tipo: 'ingreso', categoria: CATEGORIAS_INGRESO_DEFAULT[0], moneda: 'ARS', monto: '', concepto: '', fecha: new Date().toISOString().split('T')[0] });

  const cargar = async () => {
    if (!negocioId) return;
    const hoyStr = fechaKey(new Date());
    const [snap, cierre, historial, cfgSnap] = await Promise.all([
      getDocs(query(collection(db, ...base, 'caja'), orderBy('fecha', 'desc'))),
      obtenerCierre(negocioId, hoyStr),
      listarCierres(negocioId, 8),
      getDoc(doc(db, ...base, 'config', 'general')),
    ]);
    const cfg = cfgSnap.data() || {};
    setCategoriasIngreso(cfg.categoriasIngreso?.length ? cfg.categoriasIngreso : CATEGORIAS_INGRESO_DEFAULT);
    setCategoriasEgreso(cfg.categoriasEgreso?.length ? cfg.categoriasEgreso : CATEGORIAS_EGRESO_DEFAULT);
    setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setCierreHoy(cierre);
    setHistorialCierres(historial);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const recalcular = async () => {
    setReconciliando(true);
    try {
      const creados = await reconciliarCaja(negocioId);
      await cargar();
      alert(creados > 0
        ? `Se agregaron ${creados} movimiento${creados > 1 ? 's' : ''} que faltaban en la caja.`
        : 'La caja ya estaba al día, no faltaba ningún movimiento.');
    } catch (err) {
      console.error(err);
      alert('No se pudo recalcular la caja. Revisá la consola para más detalle.');
    } finally {
      setReconciliando(false);
    }
  };

  const abrirModal = () => {
    setForm({ tipo: 'ingreso', categoria: categoriasIngreso[0] || '', moneda: 'ARS', monto: '', concepto: '', fecha: new Date().toISOString().split('T')[0] });
    setModal(true);
  };

  const cambiarTipoManual = (tipo) => {
    const categorias = tipo === 'ingreso' ? categoriasIngreso : categoriasEgreso;
    setForm(f => ({ ...f, tipo, categoria: categorias[0] || '' }));
  };

  const guardarManual = async (e) => {
    e.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) return;
    setGuardando(true);
    try {
      await addDoc(collection(db, ...base, 'caja'), {
        fecha: form.fecha ? new Date(form.fecha) : serverTimestamp(),
        tipo: form.tipo,
        categoria: form.categoria,
        moneda: form.moneda,
        monto: Number(form.monto),
        concepto: form.concepto || form.categoria,
        origen: 'manual',
        ventaId: null, cobroIdx: null, cuotaIdx: null,
        automatico: false,
      });
      setModal(false);
      cargar();
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
  };

  const eliminarMovimiento = async (m) => {
    if (!window.confirm('¿Eliminás este movimiento de caja?')) return;
    await deleteDoc(doc(db, ...base, 'caja', m.id));
    cargar();
  };

  const abrirModalCierre = async () => {
    setModalCierre(true);
    setCargandoReconciliacion(true);
    setReconciliacionCierre(null);
    try {
      const rec = await calcularVentasDelDia(negocioId, fechaKey(new Date()));
      setReconciliacionCierre(rec);
    } catch (err) { console.error(err); }
    finally { setCargandoReconciliacion(false); }
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando caja...</div>;

  const saldo = { ARS: 0, USD: 0 };
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const hoyMov = { ingresoARS: 0, egresoARS: 0, ingresoUSD: 0, egresoUSD: 0 };
  const hoyVentaMov = { ARS: 0, USD: 0 };

  for (const m of movimientos) {
    const monto = Number(m.monto) || 0;
    const signo = m.tipo === 'ingreso' ? 1 : -1;
    if (m.moneda === 'USD') saldo.USD += signo * monto; else saldo.ARS += signo * monto;

    const fechaMov = fechaDeMovimiento(m);
    if (fechaMov >= hoy) {
      const key = `${m.tipo}${m.moneda === 'USD' ? 'USD' : 'ARS'}`;
      if (hoyMov[key] !== undefined) hoyMov[key] += monto;
      if (m.origen === 'venta' && m.tipo === 'ingreso') hoyVentaMov[m.moneda === 'USD' ? 'USD' : 'ARS'] += monto;
    }
  }

  const saldoInicialARS = saldo.ARS - (hoyMov.ingresoARS - hoyMov.egresoARS);
  const saldoInicialUSD = saldo.USD - (hoyMov.ingresoUSD - hoyMov.egresoUSD);

  const coincideARS = reconciliacionCierre ? Math.abs(hoyVentaMov.ARS - reconciliacionCierre.ingresosARS) < 1 : null;
  const coincideUSD = reconciliacionCierre ? Math.abs(hoyVentaMov.USD - reconciliacionCierre.ingresosUSD) < 1 : null;
  const cierreListoParaConfirmar = reconciliacionCierre && coincideARS && coincideUSD;

  const confirmarCierre = async () => {
    setCerrando(true);
    try {
      await cerrarCajaDelDia(negocioId, fechaKey(new Date()), {
        cerradoPor: perfil?.nombre || '',
        ingresosARS: hoyMov.ingresoARS, egresosARS: hoyMov.egresoARS,
        ingresosUSD: hoyMov.ingresoUSD, egresosUSD: hoyMov.egresoUSD,
        saldoInicialARS, saldoInicialUSD,
        saldoFinalARS: saldo.ARS, saldoFinalUSD: saldo.USD,
        ventasCantidad: reconciliacionCierre?.cantidad || 0,
      });
      setModalCierre(false);
      await cargar();
    } catch (err) {
      console.error(err);
      alert(err.message || 'No se pudo cerrar la caja.');
    } finally { setCerrando(false); }
  };

  const movimientosPorMonedaYTipo = movimientos.filter(m => {
    if (filtroMoneda !== 'todas' && m.moneda !== filtroMoneda) return false;
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
    return true;
  });

  // Un total por categoría nunca puede mezclar ARS y USD, así que se arma separado
  // por moneda y se muestra uno o los dos paneles según el filtro de moneda activo.
  const totalesPorCategoria = { ARS: {}, USD: {} };
  for (const m of movimientosPorMonedaYTipo) {
    const mnd = m.moneda === 'USD' ? 'USD' : 'ARS';
    const cat = categoriaDe(m);
    totalesPorCategoria[mnd][cat] = (totalesPorCategoria[mnd][cat] || 0) + (Number(m.monto) || 0);
  }
  const desgloseArr = (mnd) => Object.entries(totalesPorCategoria[mnd]).map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
  const desgloseARS = desgloseArr('ARS');
  const desgloseUSD = desgloseArr('USD');
  const categoriasDisponibles = Array.from(new Set(movimientosPorMonedaYTipo.map(categoriaDe))).sort();

  const movimientosFiltrados = movimientosPorMonedaYTipo.filter(m => {
    if (filtroCategoria !== 'todas' && categoriaDe(m) !== filtroCategoria) return false;
    return true;
  });

  const serieARS = agruparPorDia(movimientos, 'ARS', periodoReporte);
  const serieUSD = agruparPorDia(movimientos, 'USD', periodoReporte);

  // Los resúmenes "por día"/"por mes" respetan los mismos filtros de moneda/tipo/categoría
  // que la lista de movimientos, para poder ver por ejemplo solo los egresos en dólares
  // agrupados por mes.
  const resumenDia = resumenPorPeriodo(movimientosFiltrados, fechaKey);
  const resumenMes = resumenPorPeriodo(movimientosFiltrados, mesKey);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><IconWallet size={22} style={{ color: 'var(--rv-accent)' }} />Caja</h1>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, margin: '4px 0 0' }}>Se completa sola con los pagos que cargás en Ventas, Cobros y Pagos a Proveedores.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={recalcular} disabled={reconciliando} title="Busca ventas, cuotas cobradas y pagos a proveedores que todavía no tengan su movimiento de caja y lo crea" style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-text)', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconRefresh size={14} />{reconciliando ? 'Recalculando...' : 'Recalcular desde ventas'}
          </button>
          <button onClick={() => exportarCajaExcel(movimientos, negocioId)} disabled={movimientos.length === 0} title="Descarga un Excel con el detalle completo de la caja, más resúmenes por día y por mes" style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-text)', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: movimientos.length === 0 ? 'not-allowed' : 'pointer', opacity: movimientos.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconDownload size={14} />Exportar Excel
          </button>
          <button onClick={abrirModal} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconPlus size={14} />Movimiento manual
          </button>
        </div>
      </div>

      {/* Saldos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div style={{ background: 'var(--rv-accent-soft)', border: '1px solid rgba(47,111,237,0.3)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 4 }}>Saldo en pesos</div>
          <div style={{ color: 'var(--rv-accent)', fontWeight: 800, fontSize: 26 }}>${saldo.ARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
        <div style={{ background: 'var(--rv-accent-soft)', border: '1px solid rgba(47,111,237,0.3)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 4 }}>Saldo en dólares</div>
          <div style={{ color: 'var(--rv-accent)', fontWeight: 800, fontSize: 26 }}>USD {saldo.USD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Cierre de caja del día */}
      <div style={{
        background: cierreHoy ? 'var(--rv-surface)' : 'var(--rv-surface-alt)',
        border: cierreHoy ? '1px solid var(--rv-border)' : '1px dashed var(--rv-border)',
        borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        {cierreHoy ? (
          <>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--rv-text)' }}>
                <IconLock size={14} style={{ color: 'var(--rv-accent)' }} />Caja de hoy cerrada
              </div>
              <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3 }}>
                Saldo final: ${cierreHoy.saldoFinalARS?.toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS · USD {cierreHoy.saldoFinalUSD?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                {cierreHoy.cerradoPor ? ` · Cerró ${cierreHoy.cerradoPor}` : ''}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rv-text)' }}>Todavía no cerraste la caja de hoy</div>
              <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3 }}>El cierre concilia los movimientos del día contra las ventas registradas antes de dejarte confirmar.</div>
            </div>
            <button onClick={abrirModalCierre} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              <IconLock size={13} />Cerrar caja de hoy
            </button>
          </>
        )}
      </div>

      {historialCierres.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>Últimos cierres</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historialCierres.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
                <span style={{ color: 'var(--rv-text-mid)' }}>{new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                <span style={{ color: 'var(--rv-text-dim)' }}>{c.ventasCantidad || 0} venta{c.ventasCantidad === 1 ? '' : 's'}</span>
                <span style={{ fontWeight: 700 }}>${c.saldoFinalARS?.toLocaleString('es-AR', { maximumFractionDigits: 0 })} · USD {c.saldoFinalUSD?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos de hoy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 28 }}>
        <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><IconTrendUp size={11} />Ingresos hoy (ARS)</div>
          <div style={{ fontWeight: 700 }}>${hoyMov.ingresoARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
        <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><IconTrendDown size={11} />Egresos hoy (ARS)</div>
          <div style={{ fontWeight: 700 }}>${hoyMov.egresoARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
        <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><IconTrendUp size={11} />Ingresos hoy (USD)</div>
          <div style={{ fontWeight: 700 }}>USD {hoyMov.ingresoUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
        <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><IconTrendDown size={11} />Egresos hoy (USD)</div>
          <div style={{ fontWeight: 700 }}>USD {hoyMov.egresoUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Reporte de ingresos y gastos */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><IconChart size={15} />Ingresos y gastos</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIODOS_REPORTE.map(p => (
              <button key={p} onClick={() => setPeriodoReporte(p)} style={{ background: periodoReporte === p ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: periodoReporte === p ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{p} días</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Pesos (ARS)</div>
            <GraficoIngresosEgresos datos={serieARS} moneda="ARS" />
          </div>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Dólares (USD)</div>
            <GraficoIngresosEgresos datos={serieUSD} moneda="USD" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTROS_MONEDA.map(f => (
            <button key={f.key} onClick={() => setFiltroMoneda(f.key)} style={{ background: filtroMoneda === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroMoneda === f.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTROS_TIPO.map(f => (
            <button key={f.key} onClick={() => { setFiltroTipo(f.key); setFiltroCategoria('todas'); }} style={{ background: filtroTipo === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroTipo === f.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{f.label}</button>
          ))}
        </div>
      </div>

      {categoriasDisponibles.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroCategoria('todas')} style={{ background: filtroCategoria === 'todas' ? 'var(--rv-text)' : 'var(--rv-surface-alt)', color: filtroCategoria === 'todas' ? 'var(--rv-bg)' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Todas las categorías</button>
          {categoriasDisponibles.map(cat => (
            <button key={cat} onClick={() => setFiltroCategoria(cat)} style={{ background: filtroCategoria === cat ? 'var(--rv-text)' : 'var(--rv-surface-alt)', color: filtroCategoria === cat ? 'var(--rv-bg)' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{cat}</button>
          ))}
        </div>
      )}

      {/* Desglose por categoría */}
      {(desgloseARS.length > 0 || desgloseUSD.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
          {desgloseARS.length > 0 && (
            <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Por categoría · Pesos (ARS)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {desgloseARS.map(d => (
                  <div key={d.categoria}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--rv-text-mid)' }}>{d.categoria}</span>
                      <span style={{ fontWeight: 700 }}>${d.monto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(d.monto / Math.max(1, desgloseARS[0].monto)) * 100}%`, height: '100%', background: filtroTipo === 'egreso' ? 'var(--rv-danger)' : 'var(--rv-accent)', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {desgloseUSD.length > 0 && (
            <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Por categoría · Dólares (USD)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {desgloseUSD.map(d => (
                  <div key={d.categoria}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--rv-text-mid)' }}>{d.categoria}</span>
                      <span style={{ fontWeight: 700 }}>USD {d.monto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(d.monto / Math.max(1, desgloseUSD[0].monto)) * 100}%`, height: '100%', background: filtroTipo === 'egreso' ? 'var(--rv-danger)' : 'var(--rv-accent)', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Listado */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ key: 'movimientos', label: 'Movimientos' }, { key: 'dia', label: 'Por día' }, { key: 'mes', label: 'Por mes' }].map(v => (
          <button key={v.key} onClick={() => setVistaListado(v.key)} style={{ background: vistaListado === v.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: vistaListado === v.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{v.label}</button>
        ))}
      </div>

      {(vistaListado === 'dia' || vistaListado === 'mes') && (
        <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '10px 16px', background: 'var(--rv-surface-alt)', fontSize: 11, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase' }}>
            <span>{vistaListado === 'dia' ? 'Día' : 'Mes'}</span>
            <span>Mov.</span>
            <span>Ingreso ARS</span>
            <span>Egreso ARS</span>
            <span>Neto ARS</span>
            <span>Ingreso USD</span>
            <span>Egreso USD</span>
            <span>Neto USD</span>
          </div>
          {(vistaListado === 'dia' ? resumenDia : resumenMes).map((r, i) => (
            <div key={r.periodo} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '10px 16px', fontSize: 13, alignItems: 'center', borderTop: i === 0 ? 'none' : '1px solid var(--rv-border)' }}>
              <span style={{ fontWeight: 600 }}>{vistaListado === 'dia' ? new Date(r.periodo + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' }) : mesLabel(r.periodo)}</span>
              <span style={{ color: 'var(--rv-text-dim)' }}>{r.cantidad}</span>
              <span>${r.ingresoARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
              <span>${r.egresoARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
              <span style={{ fontWeight: 700, color: r.netoARS >= 0 ? 'var(--rv-accent)' : 'var(--rv-danger)' }}>${r.netoARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
              <span>USD {r.ingresoUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
              <span>USD {r.egresoUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
              <span style={{ fontWeight: 700, color: r.netoUSD >= 0 ? 'var(--rv-accent)' : 'var(--rv-danger)' }}>USD {r.netoUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
          {(vistaListado === 'dia' ? resumenDia : resumenMes).length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--rv-text-dim)', fontSize: 13 }}>No hay movimientos con estos filtros</div>
          )}
        </div>
      )}

      {vistaListado === 'movimientos' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {movimientosFiltrados.map(m => {
          const fechaMov = fechaDeMovimiento(m);
          return (
            <div key={m.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: m.tipo === 'ingreso' ? 'var(--rv-accent-soft)' : 'var(--rv-danger-soft)',
                  color: m.tipo === 'ingreso' ? 'var(--rv-accent)' : 'var(--rv-danger)',
                }}>
                  {m.tipo === 'ingreso' ? <IconTrendUp size={15} /> : <IconTrendDown size={15} />}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.concepto}</div>
                  <div style={{ color: 'var(--rv-text-dim)', fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconCalendar size={10} />{fechaMov.toLocaleDateString('es-AR')} · {categoriaDe(m)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: m.tipo === 'ingreso' ? 'var(--rv-accent)' : 'var(--rv-danger)' }}>
                  {m.tipo === 'ingreso' ? '+' : '-'} {m.moneda === 'USD' ? 'USD' : '$'} {Number(m.monto).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </span>
                {!m.automatico && (
                  <button onClick={() => eliminarMovimiento(m)} style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', color: 'var(--rv-danger)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}>
                    <IconTrash size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {movimientosFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
            <IconCoin size={36} style={{ marginBottom: 12 }} />
            <p>No hay movimientos {movimientos.length > 0 ? 'con estos filtros' : 'todavía'}</p>
          </div>
        )}
      </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Movimiento manual</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <form onSubmit={guardarManual} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={form.tipo} onChange={e => cambiarTipoManual(e.target.value)} style={inputStyle}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Moneda</label>
                  <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })} style={inputStyle}>
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Categoría</label>
                <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={inputStyle}>
                  {(form.tipo === 'ingreso' ? categoriasIngreso : categoriasEgreso).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Monto</label>
                <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Concepto (opcional)</label>
                <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Detalle adicional" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setModal(false)} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalCierre && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><IconLock size={16} />Cerrar caja de hoy</h2>
              <button onClick={() => setModalCierre(false)} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--rv-text-dim)' }}>Saldo inicial</span><span style={{ fontWeight: 600 }}>${saldoInicialARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })} · USD {saldoInicialUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--rv-text-dim)' }}>+ Ingresos de hoy</span><span style={{ fontWeight: 600, color: 'var(--rv-accent)' }}>${hoyMov.ingresoARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })} · USD {hoyMov.ingresoUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--rv-text-dim)' }}>- Egresos de hoy</span><span style={{ fontWeight: 600, color: 'var(--rv-danger)' }}>${hoyMov.egresoARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })} · USD {hoyMov.egresoUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--rv-border)', paddingTop: 6, marginTop: 2 }}><span style={{ fontWeight: 700 }}>Saldo final</span><span style={{ fontWeight: 800 }}>${saldo.ARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })} · USD {saldo.USD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></div>
            </div>

            <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>Conciliación con Ventas</div>
              {cargandoReconciliacion ? (
                <div style={{ fontSize: 13, color: 'var(--rv-text-dim)' }}>Comparando contra las ventas del día...</div>
              ) : reconciliacionCierre ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--rv-text-mid)', marginBottom: 8 }}>{reconciliacionCierre.cantidad} venta{reconciliacionCierre.cantidad === 1 ? '' : 's'} registrada{reconciliacionCierre.cantidad === 1 ? '' : 's'} hoy</div>
                  {cierreListoParaConfirmar ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--rv-accent)', fontSize: 13, fontWeight: 600 }}>
                      <IconCheckCircle size={15} />Los ingresos de caja calzan perfecto con las ventas de hoy
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--rv-danger)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        <IconWarning size={15} />No coincide — no se puede cerrar todavía
                      </div>
                      {!coincideARS && <div style={{ fontSize: 12, color: 'var(--rv-text-dim)' }}>ARS en Ventas: ${reconciliacionCierre.ingresosARS.toLocaleString('es-AR')} · ARS en Caja: ${hoyVentaMov.ARS.toLocaleString('es-AR')}</div>}
                      {!coincideUSD && <div style={{ fontSize: 12, color: 'var(--rv-text-dim)' }}>USD en Ventas: {reconciliacionCierre.ingresosUSD.toLocaleString('es-AR')} · USD en Caja: {hoyVentaMov.USD.toLocaleString('es-AR')}</div>}
                      <button type="button" onClick={() => { setModalCierre(false); recalcular(); }} style={{ marginTop: 10, background: 'none', border: '1px solid var(--rv-accent)', color: 'var(--rv-accent)', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Recalcular desde ventas</button>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalCierre(false)} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={confirmarCierre} disabled={!cierreListoParaConfirmar || cerrando} style={{ padding: '10px 24px', background: cierreListoParaConfirmar ? 'var(--rv-accent)' : 'var(--rv-border)', border: 'none', borderRadius: 8, color: cierreListoParaConfirmar ? '#fff' : 'var(--rv-text-dim)', fontSize: 14, fontWeight: 700, cursor: cierreListoParaConfirmar ? 'pointer' : 'not-allowed' }}>
                {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
