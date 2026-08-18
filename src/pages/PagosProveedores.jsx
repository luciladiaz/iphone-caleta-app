import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconWallet, IconTruck, IconUser, IconClock, IconCheck, IconCheckCircle, IconCalendar, IconCoin, IconFile, IconX, IconBox } from '../components/Icons';
import { registrarMovimientoPagoProveedor, eliminarMovimientoPagoProveedor } from '../lib/caja';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

export default function PagosProveedores() {
  const { negocioId } = useAuth();
  const base = ['negocios', negocioId];
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ganManual, setGanManual] = useState({});
  const [modalPago, setModalPago] = useState(null);
  const [formPago, setFormPago] = useState({ fecha: '', monto: '', detalle: '' });
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    if (!negocioId) return;
    const snap = await getDocs(query(collection(db, ...base, 'ventas'), orderBy('fecha', 'desc')));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.proveedor && v.costoUsd);
    setVentas(data);
    const gm = {};
    data.forEach(v => { gm[v.id] = v.ganProveedorUsd || ''; });
    setGanManual(gm);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const guardarGanancia = async (id) => {
    await updateDoc(doc(db, ...base, 'ventas', id), { ganProveedorUsd: Number(ganManual[id] || 0) });
  };

  const abrirModalPago = (v) => {
    setModalPago(v);
    setFormPago({ fecha: new Date().toISOString().split('T')[0], monto: String(Number(v.costoUsd || 0) + Number(v.ganProveedorUsd || 0)), detalle: '' });
  };

  const confirmarPago = async () => {
    if (!modalPago) return;
    setGuardando(true);
    await updateDoc(doc(db, ...base, 'ventas', modalPago.id), { pagadoProveedor: true, fechaPagoProveedor: formPago.fecha, montoPagadoProveedor: Number(formPago.monto), detallePagoProveedor: formPago.detalle });
    await registrarMovimientoPagoProveedor(negocioId, modalPago, formPago.monto, formPago.detalle);
    setModalPago(null);
    setGuardando(false);
    cargar();
  };

  const desmarcarPago = async (v) => {
    await updateDoc(doc(db, ...base, 'ventas', v.id), { pagadoProveedor: false, fechaPagoProveedor: null, montoPagadoProveedor: null, detallePagoProveedor: null });
    await eliminarMovimientoPagoProveedor(negocioId, v.id);
    cargar();
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando...</div>;

  const pendientes = ventas.filter(v => !v.pagadoProveedor);
  const pagados = ventas.filter(v => v.pagadoProveedor);
  const totalPendiente = pendientes.reduce((acc, v) => acc + Number(v.costoUsd || 0) + Number(v.ganProveedorUsd || 0), 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}><IconWallet size={22} style={{ color: 'var(--rv-accent)' }} />Pagos a Proveedores</h1>
      <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 20 }}>
        Acá se liquida costo + ganancia de equipos ya <strong>vendidos</strong>. Para ver la deuda total con cada proveedor (vendido o todavía en stock), andá a <strong>Proveedores</strong>.
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '14px 20px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 12 }}>Total pendiente</div>
          <div style={{ color: 'var(--rv-text)', fontWeight: 800, fontSize: 22 }}>USD {totalPendiente.toFixed(2)}</div>
        </div>
        <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '14px 20px' }}>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 12 }}>Pagados</div>
          <div style={{ color: 'var(--rv-text)', fontWeight: 800, fontSize: 22 }}>{pagados.length} equipos</div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><IconClock size={15} />Pendientes ({pendientes.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {pendientes.map(v => {
          const ganancia = Number(v.pvUsd || 0) - Number(v.costoUsd || 0);
          const ganProv = Number(ganManual[v.id] || v.ganProveedorUsd || 0);
          const total = Number(v.costoUsd || 0) + ganProv;
          return (
            <div key={v.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{v.modelo} {v.gb}GB {v.color}</div>
                  <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}><IconTruck size={11} />{v.proveedor} <span>· <IconUser size={11} style={{ verticalAlign: 'text-bottom' }} /> {v.cliente || '-'}</span></div>
                </div>
                <button onClick={() => abrirModalPago(v)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-accent)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><IconCheck size={13} />Registrar pago</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}><div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>COSTO USD</div><div style={{ fontWeight: 700, color: 'var(--rv-accent)' }}>USD {v.costoUsd}</div></div>
                <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}><div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>PRECIO VENTA</div><div style={{ fontWeight: 700 }}>USD {v.pvUsd}</div></div>
                <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}><div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>GANANCIA</div><div style={{ fontWeight: 700, color: 'var(--rv-text)' }}>USD {ganancia.toFixed(2)}</div></div>
                <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 4 }}>GAN. PROVEEDOR</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="number" value={ganManual[v.id]} onChange={e => setGanManual(g => ({ ...g, [v.id]: e.target.value }))} style={{ width: 65, padding: '4px 8px', background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 6, color: 'var(--rv-text)', fontSize: 13, outline: 'none' }} />
                    <button onClick={() => guardarGanancia(v.id)} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>OK</button>
                  </div>
                </div>
                <div style={{ background: 'var(--rv-accent-soft)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '8px 12px' }}><div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>TOTAL A PAGAR</div><div style={{ fontWeight: 800, color: 'var(--rv-accent)' }}>USD {total.toFixed(2)}</div></div>
              </div>
            </div>
          );
        })}
        {pendientes.length === 0 && <p style={{ color: 'var(--rv-text-dim)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 7 }}><IconCheckCircle size={14} style={{ color: 'var(--rv-accent)' }} />No hay pagos pendientes</p>}
      </div>

      {pagados.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><IconCheckCircle size={15} style={{ color: 'var(--rv-accent)' }} />Pagados ({pagados.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagados.map(v => (
              <div key={v.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>{v.modelo} {v.gb}GB · <IconTruck size={12} />{v.proveedor}</div>
                    <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {v.fechaPagoProveedor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCalendar size={11} />{new Date(v.fechaPagoProveedor).toLocaleDateString('es-AR')}</span>}
                      {v.montoPagadoProveedor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCoin size={11} />USD {v.montoPagadoProveedor}</span>}
                      {v.detallePagoProveedor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconFile size={11} />{v.detallePagoProveedor}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--rv-text-mid)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCheck size={12} />Pagado</span>
                    <button onClick={() => desmarcarPago(v)} style={{ background: 'none', border: '1px solid var(--rv-border)', color: 'var(--rv-text-dim)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Desmarcar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modalPago && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Registrar pago</h2>
              <button onClick={() => setModalPago(null)} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--rv-accent)', display: 'flex', alignItems: 'center', gap: 7 }}><IconBox size={13} />{modalPago.modelo} {modalPago.gb}GB · {modalPago.proveedor}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>Fecha de pago</label><input type="date" value={formPago.fecha} onChange={e => setFormPago({ ...formPago, fecha: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Monto pagado (USD)</label><input type="number" value={formPago.monto} onChange={e => setFormPago({ ...formPago, monto: e.target.value })} placeholder="0" style={inputStyle} /></div>
              <div><label style={labelStyle}>Detalle del pago</label><textarea value={formPago.detalle} onChange={e => setFormPago({ ...formPago, detalle: e.target.value })} rows={3} placeholder="Transferencia, efectivo, forma de pago..." style={{ ...inputStyle, resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalPago(null)} style={{ padding: '10px 18px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmarPago} disabled={guardando} style={{ padding: '10px 22px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>{guardando ? 'Guardando...' : <><IconCheck size={14} />Confirmar pago</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

