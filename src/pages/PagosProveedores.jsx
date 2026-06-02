import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

const inputStyle = { width: '100%', padding: '10px 12px', background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

export default function PagosProveedores() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ganManual, setGanManual] = useState({});
  const [modalPago, setModalPago] = useState(null); // venta a pagar
  const [formPago, setFormPago] = useState({ fecha: '', monto: '', detalle: '' });
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    const snap = await getDocs(query(collection(db, 'ventas'), orderBy('fecha', 'desc')));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.proveedor && v.costoUsd);
    setVentas(data);
    const gm = {};
    data.forEach(v => { gm[v.id] = v.ganProveedorUsd || ''; });
    setGanManual(gm);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardarGanancia = async (id) => {
    await updateDoc(doc(db, 'ventas', id), { ganProveedorUsd: Number(ganManual[v.id] || 0) });
  };

  const abrirModalPago = (v) => {
    setModalPago(v);
    setFormPago({
      fecha: new Date().toISOString().split('T')[0],
      monto: String(Number(v.costoUsd || 0) + Number(v.ganProveedorUsd || 0)),
      detalle: ''
    });
  };

  const confirmarPago = async () => {
    if (!modalPago) return;
    setGuardando(true);
    await updateDoc(doc(db, 'ventas', modalPago.id), {
      pagadoProveedor: true,
      fechaPagoProveedor: formPago.fecha,
      montoPagadoProveedor: Number(formPago.monto),
      detallePagoProveedor: formPago.detalle,
    });
    setModalPago(null);
    setGuardando(false);
    cargar();
  };

  const desmarcarPago = async (v) => {
    await updateDoc(doc(db, 'ventas', v.id), {
      pagadoProveedor: false,
      fechaPagoProveedor: null,
      montoPagadoProveedor: null,
      detallePagoProveedor: null,
    });
    cargar();
  };

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando...</div>;

  const pendientes = ventas.filter(v => !v.pagadoProveedor);
  const pagados = ventas.filter(v => v.pagadoProveedor);

  const totalPendiente = pendientes.reduce((acc, v) => {
    return acc + Number(v.costoUsd || 0) + Number(v.ganProveedorUsd || 0);
  }, 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>💰 Pagos a Proveedores</h1>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: '14px 20px' }}>
          <div style={{ color: '#86868b', fontSize: 12 }}>Total pendiente</div>
          <div style={{ color: '#ff3b30', fontWeight: 800, fontSize: 22 }}>USD {totalPendiente.toFixed(2)}</div>
        </div>
        <div style={{ background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 12, padding: '14px 20px' }}>
          <div style={{ color: '#86868b', fontSize: 12 }}>Pagados</div>
          <div style={{ color: '#30d158', fontWeight: 800, fontSize: 22 }}>{pagados.length} equipos</div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>⏳ Pendientes ({pendientes.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {pendientes.map(v => {
          const ganancia = Number(v.pvUsd || 0) - Number(v.costoUsd || 0);
          const ganProv = Number(ganManual[v.id] || v.ganProveedorUsd || 0);
          const total = Number(v.costoUsd || 0) + ganProv;
          return (
            <div key={v.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{v.modelo} {v.gb}GB {v.color}</div>
                  <div style={{ color: '#86868b', fontSize: 12, marginTop: 2 }}>🏭 {v.proveedor} · 👤 {v.cliente || '-'}</div>
                </div>
                <button onClick={() => abrirModalPago(v)} style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.3)', color: '#30d158', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ Registrar pago
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                <div style={{ background: '#2c2c2e', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#86868b', fontSize: 10, marginBottom: 2 }}>COSTO USD</div>
                  <div style={{ fontWeight: 700, color: '#c9a96e' }}>USD {v.costoUsd}</div>
                </div>
                <div style={{ background: '#2c2c2e', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#86868b', fontSize: 10, marginBottom: 2 }}>PRECIO VENTA</div>
                  <div style={{ fontWeight: 700 }}>USD {v.pvUsd}</div>
                </div>
                <div style={{ background: '#2c2c2e', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#86868b', fontSize: 10, marginBottom: 2 }}>GANANCIA</div>
                  <div style={{ fontWeight: 700, color: '#30d158' }}>USD {ganancia.toFixed(2)}</div>
                </div>
                <div style={{ background: '#2c2c2e', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#86868b', fontSize: 10, marginBottom: 4 }}>GAN. PROVEEDOR</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="number" value={ganManual[v.id]} onChange={e => setGanManual(g => ({ ...g, [v.id]: e.target.value }))}
                      style={{ width: 65, padding: '4px 8px', background: '#3a3a3c', border: '1px solid #48484a', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' }} />
                    <button onClick={async () => { await updateDoc(doc(db, 'ventas', v.id), { ganProveedorUsd: Number(ganManual[v.id] || 0) }); }} style={{ background: '#c9a96e', color: '#000', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>OK</button>
                  </div>
                </div>
                <div style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#86868b', fontSize: 10, marginBottom: 2 }}>TOTAL A PAGAR</div>
                  <div style={{ fontWeight: 800, color: '#c9a96e' }}>USD {total.toFixed(2)}</div>
                </div>
              </div>
            </div>
          );
        })}
        {pendientes.length === 0 && <p style={{ color: '#86868b', fontSize: 14 }}>No hay pagos pendientes ✅</p>}
      </div>

      {pagados.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>✅ Pagados ({pagados.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagados.map(v => (
              <div key={v.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{v.modelo} {v.gb}GB · 🏭 {v.proveedor}</div>
                    <div style={{ color: '#86868b', fontSize: 12, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {v.fechaPagoProveedor && <span>📅 {new Date(v.fechaPagoProveedor).toLocaleDateString('es-AR')}</span>}
                      {v.montoPagadoProveedor && <span>💵 USD {v.montoPagadoProveedor}</span>}
                      {v.detallePagoProveedor && <span>📝 {v.detallePagoProveedor}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#30d158', fontSize: 12, fontWeight: 600 }}>✓ Pagado</span>
                    <button onClick={() => desmarcarPago(v)} style={{ background: 'none', border: '1px solid #3a3a3c', color: '#86868b', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Desmarcar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal registrar pago */}
      {modalPago && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Registrar pago</h2>
              <button onClick={() => setModalPago(null)} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: '#2c2c2e', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#c9a96e' }}>
              📱 {modalPago.modelo} {modalPago.gb}GB · 🏭 {modalPago.proveedor}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Fecha de pago</label>
                <input type="date" value={formPago.fecha} onChange={e => setFormPago({ ...formPago, fecha: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Monto pagado (USD)</label>
                <input type="number" value={formPago.monto} onChange={e => setFormPago({ ...formPago, monto: e.target.value })} placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Detalle del pago</label>
                <textarea value={formPago.detalle} onChange={e => setFormPago({ ...formPago, detalle: e.target.value })} rows={3} placeholder="Transferencia, efectivo, forma de pago..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalPago(null)} style={{ padding: '10px 18px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmarPago} disabled={guardando} style={{ padding: '10px 22px', background: '#30d158', border: 'none', borderRadius: 8, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {guardando ? 'Guardando...' : '✓ Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
