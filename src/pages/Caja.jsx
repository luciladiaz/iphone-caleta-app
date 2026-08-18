import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconWallet, IconCoin, IconPlus, IconTrash, IconX, IconTrendUp, IconTrendDown, IconCalendar, IconRefresh } from '../components/Icons';
import { reconciliarCaja } from '../lib/caja';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const ORIGEN_LABEL = { venta: 'Venta', cuota: 'Cuota', pago_proveedor: 'Pago a proveedor', manual: 'Manual' };

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

export default function Caja() {
  const { negocioId } = useAuth();
  const base = ['negocios', negocioId];
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroMoneda, setFiltroMoneda] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [reconciliando, setReconciliando] = useState(false);
  const [form, setForm] = useState({ tipo: 'ingreso', moneda: 'ARS', monto: '', concepto: '', fecha: new Date().toISOString().split('T')[0] });

  const cargar = async () => {
    if (!negocioId) return;
    const snap = await getDocs(query(collection(db, ...base, 'caja'), orderBy('fecha', 'desc')));
    setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    setForm({ tipo: 'ingreso', moneda: 'ARS', monto: '', concepto: '', fecha: new Date().toISOString().split('T')[0] });
    setModal(true);
  };

  const guardarManual = async (e) => {
    e.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) return;
    setGuardando(true);
    try {
      await addDoc(collection(db, ...base, 'caja'), {
        fecha: form.fecha ? new Date(form.fecha) : serverTimestamp(),
        tipo: form.tipo,
        moneda: form.moneda,
        monto: Number(form.monto),
        concepto: form.concepto || (form.tipo === 'ingreso' ? 'Ingreso manual' : 'Egreso manual'),
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

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando caja...</div>;

  const saldo = { ARS: 0, USD: 0 };
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const hoyMov = { ingresoARS: 0, egresoARS: 0, ingresoUSD: 0, egresoUSD: 0 };

  for (const m of movimientos) {
    const monto = Number(m.monto) || 0;
    const signo = m.tipo === 'ingreso' ? 1 : -1;
    if (m.moneda === 'USD') saldo.USD += signo * monto; else saldo.ARS += signo * monto;

    const fechaMov = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha);
    if (fechaMov >= hoy) {
      const key = `${m.tipo}${m.moneda === 'USD' ? 'USD' : 'ARS'}`;
      if (hoyMov[key] !== undefined) hoyMov[key] += monto;
    }
  }

  const movimientosFiltrados = movimientos.filter(m => {
    if (filtroMoneda !== 'todas' && m.moneda !== filtroMoneda) return false;
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
    return true;
  });

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
          <button onClick={abrirModal} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconPlus size={14} />Movimiento manual
          </button>
        </div>
      </div>

      {/* Saldos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'var(--rv-accent-soft)', border: '1px solid rgba(47,111,237,0.3)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 4 }}>Saldo en pesos</div>
          <div style={{ color: 'var(--rv-accent)', fontWeight: 800, fontSize: 26 }}>${saldo.ARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
        <div style={{ background: 'var(--rv-accent-soft)', border: '1px solid rgba(47,111,237,0.3)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 4 }}>Saldo en dólares</div>
          <div style={{ color: 'var(--rv-accent)', fontWeight: 800, fontSize: 26 }}>USD {saldo.USD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

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

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTROS_MONEDA.map(f => (
            <button key={f.key} onClick={() => setFiltroMoneda(f.key)} style={{ background: filtroMoneda === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroMoneda === f.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTROS_TIPO.map(f => (
            <button key={f.key} onClick={() => setFiltroTipo(f.key)} style={{ background: filtroTipo === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroTipo === f.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Listado */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {movimientosFiltrados.map(m => {
          const fechaMov = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha);
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
                    <IconCalendar size={10} />{fechaMov.toLocaleDateString('es-AR')} · {ORIGEN_LABEL[m.origen] || 'Movimiento'}
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
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
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
                <label style={labelStyle}>Monto</label>
                <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Concepto</label>
                <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder={form.tipo === 'ingreso' ? 'Ej: Aporte de capital' : 'Ej: Retiro, alquiler, insumos'} style={inputStyle} />
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
    </div>
  );
}
