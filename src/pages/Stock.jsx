import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const MODELOS_DEFAULT = ['iPhone 12','iPhone 12 Pro','iPhone 12 Pro Max','iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 14','iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max'];
const COLORES = ['Negro','Blanco','Azul','Natural','Desert','Desert Titanium','Natural Titanium','Naranja','Rosa','Verde','Morado','Rojo'];
const GBS = ['64','128','256','512','1TB'];
const TIPOS = ['consignacion','compra'];
const ESTADOS = ['disponible','asignado','vendido'];

const estadoColor = { disponible: '#30d158', asignado: '#ff9f0a', vendido: '#86868b' };

const inputStyle = {
  width: '100%', padding: '10px 12px', background: '#2c2c2e',
  border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff',
  fontSize: 14, outline: 'none', boxSizing: 'border-box'
};
const labelStyle = { color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

export default function Stock() {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const [equipos, setEquipos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [modelos, setModelos] = useState(MODELOS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [form, setForm] = useState({
    modelo: '', color: '', gb: '', bateria: '', imei: '', fechaManual: '',
    tipo: 'compra', proveedor: '', costoUsd: '', pvUsd: '',
    estado: 'disponible', puntoVenta: '', asignadoA: '', notas: ''
  });

  const cargar = async () => {
    const [eSnap, pSnap, pvSnap, vSnap, cfgSnap] = await Promise.all([
      getDocs(query(collection(db, 'stock'), orderBy('fechaIngreso', 'desc'))),
      getDocs(collection(db, 'proveedores')),
      getDocs(collection(db, 'puntosVenta')),
      getDocs(collection(db, 'vendedores')),
      getDoc(doc(db, 'config', 'general')),
    ]);
    setEquipos(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setProveedores(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPuntosVenta(pvSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setVendedores(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const cfg = cfgSnap.data() || {};
    if (cfg.modelos?.length) setModelos(cfg.modelos);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const fechaIngreso = form.fechaManual ? new Date(form.fechaManual) : serverTimestamp();
      await addDoc(collection(db, 'stock'), { ...form, fechaIngreso });
      setModal(false);
      setForm({ modelo: '', color: '', gb: '', bateria: '', imei: '', tipo: 'compra', proveedor: '', costoUsd: '', pvUsd: '', estado: 'disponible', puntoVenta: '', asignadoA: '', notas: '' });
      cargar();
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
  };

  const equiposFiltrados = equipos.filter(e =>
    `${e.modelo} ${e.color} ${e.gb} ${e.imei} ${e.puntoVenta} ${e.asignadoA}`.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando stock...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Stock</h1>
          <p style={{ color: '#86868b', fontSize: 13, margin: '4px 0 0' }}>{equipos.filter(e => e.estado === 'disponible').length} disponibles · {equipos.length} total</p>
        </div>
        {esAdmin && (
          <button onClick={() => setModal(true)} style={{
            background: '#c9a96e', color: '#000', border: 'none', borderRadius: 10,
            padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>+ Agregar equipo</button>
        )}
      </div>

      <input
        placeholder="Buscar por modelo, color, IMEI, vendedor..."
        value={filtro} onChange={e => setFiltro(e.target.value)}
        style={{ ...inputStyle, marginBottom: 20, maxWidth: 400 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {equiposFiltrados.map(eq => (
          <div key={eq.id} style={{
            background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20,
            borderTop: `3px solid ${estadoColor[eq.estado] || '#c9a96e'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{eq.modelo}</div>
                <div style={{ color: '#86868b', fontSize: 12, marginTop: 2 }}>{eq.gb}GB · {eq.color}</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase',
                background: `${estadoColor[eq.estado]}22`, color: estadoColor[eq.estado]
              }}>{eq.estado}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#ebebf5cc' }}>
              <span>🔋 Batería: {eq.bateria}%</span>
              {eq.imei && <span>📋 IMEI: {eq.imei}</span>}
              {eq.puntoVenta && <span>📍 {eq.puntoVenta}</span>}
              {eq.asignadoA && <span>👤 {eq.asignadoA}</span>}
              <span style={{ color: eq.tipo === 'consignacion' ? '#ff9f0a' : '#30d158', fontWeight: 600, marginTop: 4 }}>
                {eq.tipo === 'consignacion' ? '🤝 Consignación' : '🛒 Compra directa'}
              </span>
              {esAdmin && eq.costoUsd && <span style={{ color: '#86868b' }}>Costo: USD {eq.costoUsd}</span>}
              {eq.fechaIngreso && <span style={{ color: '#86868b' }}>📅 {eq.fechaIngreso.toDate ? eq.fechaIngreso.toDate().toLocaleDateString('es-AR') : new Date(eq.fechaIngreso).toLocaleDateString('es-AR')}</span>}
            </div>
          </div>
        ))}
      </div>

      {equiposFiltrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#86868b' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p>No hay equipos en stock</p>
        </div>
      )}

      {/* Modal agregar */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16,
            padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Agregar equipo</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Modelo</label>
                  <select value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} required style={inputStyle}>
                    <option value="">Elegir...</option>
                    {modelos.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Color</label>
                  <select value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={inputStyle}>
                    <option value="">Elegir...</option>
                    {COLORES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>GB</label>
                  <select value={form.gb} onChange={e => setForm({...form, gb: e.target.value})} style={inputStyle}>
                    <option value="">Elegir...</option>
                    {GBS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Batería %</label>
                  <input type="number" min="0" max="100" value={form.bateria} onChange={e => setForm({...form, bateria: e.target.value})} placeholder="91" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>IMEI</label>
                  <input value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} placeholder="123456789012345" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tipo de adquisición</label>
                  <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={inputStyle}>
                    {TIPOS.map(t => <option key={t} value={t}>{t === 'consignacion' ? 'Consignación' : 'Compra directa'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Proveedor</label>
                  <select value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle}>
                    <option value="">Elegir...</option>
                    {proveedores.map(p => <option key={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Costo USD</label>
                  <input type="number" value={form.costoUsd} onChange={e => setForm({...form, costoUsd: e.target.value})} placeholder="400" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Precio Venta USD</label>
                  <input type="number" value={form.pvUsd} onChange={e => setForm({...form, pvUsd: e.target.value})} placeholder="500" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Punto de venta</label>
                  <select value={form.puntoVenta} onChange={e => setForm({...form, puntoVenta: e.target.value})} style={inputStyle}>
                    <option value="">Ninguno</option>
                    {puntosVenta.map(p => <option key={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Asignado a</label>
                  <select value={form.asignadoA} onChange={e => setForm({...form, asignadoA: e.target.value})} style={inputStyle}>
                    <option value="">Ninguno</option>
                    {vendedores.map(v => <option key={v.id}>{v.nombre}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Estado</label>
                  <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} style={inputStyle}>
                    {ESTADOS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fecha de ingreso</label>
                  <input type="date" value={form.fechaManual} onChange={e => setForm({...form, fechaManual: e.target.value})} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Notas</label>
                  <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setModal(false)} style={{
                  padding: '10px 20px', background: '#2c2c2e', border: '1px solid #3a3a3c',
                  borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{
                  padding: '10px 24px', background: '#c9a96e', border: 'none',
                  borderRadius: 8, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}>{guardando ? 'Guardando...' : 'Guardar equipo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
