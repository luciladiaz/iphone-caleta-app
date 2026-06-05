import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import CalculadoraPrecio from '../components/CalculadoraPrecio';
import ModalLimiteAlcanzado from '../components/ModalLimiteAlcanzado';

const MODELOS_DEFAULT = ['iPhone 12','iPhone 12 Pro','iPhone 12 Pro Max','iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 14','iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max'];
const COLORES = ['Negro','Blanco','Azul','Natural','Desert','Desert Titanium','Natural Titanium','Naranja','Rosa','Verde','Morado','Rojo'];
const GBS = ['64','128','256','512','1TB'];
const TIPOS = ['compra','consignacion'];
const ESTADOS = ['disponible','asignado','vendido'];
const estadoColor = { disponible: '#30d158', asignado: '#ff9f0a', vendido: '#86868b' };

const inputStyle = { width: '100%', padding: '10px 12px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

export default function Stock() {
  const { perfil, negocioId, plan, limitesPlan, tieneFeature } = useAuth();
  const navigate = useNavigate();
  const esAdmin = perfil?.rol === 'admin';
  const base = ['negocios', negocioId];

  const [equipos, setEquipos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [modelos, setModelos] = useState(MODELOS_DEFAULT);
  const [tipoCambio, setTipoCambio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [modalCatalogo, setModalCatalogo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [modalLimite, setModalLimite] = useState(false);
  const [form, setForm] = useState({
    modelo: '', color: '', gb: '', bateria: '', imei: '',
    tipo: 'compra', proveedor: '', costoUsd: '', pvUsd: '',
    estado: 'disponible', puntoVenta: '', asignadoA: '', notas: '', fechaManual: ''
  });

  const cargar = async () => {
    if (!negocioId) return;
    const [eSnap, pSnap, pvSnap, vSnap, cfgSnap] = await Promise.all([
      getDocs(query(collection(db, ...base, 'stock'), orderBy('fechaIngreso', 'desc'))),
      getDocs(collection(db, ...base, 'proveedores')),
      getDocs(collection(db, ...base, 'puntosVenta')),
      getDocs(collection(db, ...base, 'vendedores')),
      getDoc(doc(db, ...base, 'config', 'general')),
    ]);
    setEquipos(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setProveedores(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPuntosVenta(pvSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setVendedores(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const cfg = cfgSnap.data() || {};
    if (cfg.modelos?.length) setModelos(cfg.modelos);
    if (cfg.tipoCambio) setTipoCambio(cfg.tipoCambio);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const abrirEditar = (eq) => {
    setEditandoId(eq.id);
    setForm({
      modelo: eq.modelo || '', color: eq.color || '', gb: eq.gb || '',
      bateria: eq.bateria || '', imei: eq.imei || '', tipo: eq.tipo || 'compra',
      proveedor: eq.proveedor || '', costoUsd: eq.costoUsd || '', pvUsd: eq.pvUsd || '',
      estado: eq.estado || 'disponible', puntoVenta: eq.puntoVenta || '',
      asignadoA: eq.asignadoA || '', notas: eq.notas || '', fechaManual: ''
    });
    setModal(true);
  };

  const cerrarModal = () => {
    setModal(false);
    setEditandoId(null);
    setForm({ modelo: '', color: '', gb: '', bateria: '', imei: '', tipo: 'compra', proveedor: '', costoUsd: '', pvUsd: '', estado: 'disponible', puntoVenta: '', asignadoA: '', notas: '', fechaManual: '' });
  };

  const eliminarEquipo = async (id) => {
    if (!window.confirm('¿Eliminás este equipo del stock? Esta acción no se puede deshacer.')) return;
    await deleteDoc(doc(db, ...base, 'stock', id));
    cargar();
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editandoId) {
        const { fechaManual, ...datos } = form;
        await updateDoc(doc(db, ...base, 'stock', editandoId), datos);
      } else {
        const fechaIngreso = form.fechaManual ? new Date(form.fechaManual) : serverTimestamp();
        await addDoc(collection(db, ...base, 'stock'), { ...form, fechaIngreso });
      }
      cerrarModal();
      cargar();
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
  };

  const generarFichaWA = (eq) => {
    const precioARS = eq.pvUsd && tipoCambio ? `$${(eq.pvUsd * tipoCambio).toLocaleString('es-AR')} ARS` : '';
    return `📱 *${eq.modelo} ${eq.gb}GB ${eq.color}*\n🔋 Batería: ${eq.bateria}%\n✅ Libre de operador\n${eq.pvUsd ? `💵 USD ${eq.pvUsd}` : ''}\n${precioARS ? `💵 ${precioARS}` : ''}\n📩 Consultá disponibilidad por este medio`;
  };

  const copiarFicha = (eq) => {
    navigator.clipboard.writeText(generarFichaWA(eq));
    setCopiado(eq.id);
    setTimeout(() => setCopiado(false), 2000);
  };

  const urlCatalogo = `${window.location.origin}/catalogo/${negocioId}`;
  const stockDisponible = equipos.filter(e => e.estado === 'disponible');
  const totalValorUSD = stockDisponible.reduce((acc, e) => acc + Number(e.pvUsd || 0), 0);
  const equiposFiltrados = equipos.filter(e =>
    `${e.modelo} ${e.color} ${e.gb} ${e.imei} ${e.puntoVenta} ${e.asignadoA}`.toLowerCase().includes(filtro.toLowerCase())
  );
  const maxStock = limitesPlan?.maxStock ?? Infinity;
  const limiteAlcanzado = maxStock !== Infinity && equipos.length >= maxStock;

  const handleAgregarEquipo = () => {
    if (limiteAlcanzado) { setModalLimite(true); return; }
    setModal(true);
  };

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando stock...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Stock</h1>
          <p style={{ color: '#86868b', fontSize: 13, margin: '4px 0 0' }}>
            {stockDisponible.length} disponibles · {equipos.length} total
            {esAdmin && tieneFeature('valorStockTiempoReal') && totalValorUSD > 0 && <span style={{ color: '#c9a96e', marginLeft: 8 }}>· USD {totalValorUSD.toFixed(0)} en stock</span>}
            {esAdmin && !tieneFeature('valorStockTiempoReal') && <span style={{ color: '#3a3a3c', marginLeft: 8, fontSize: 12 }}>· 🔒 Valor total · Plan Pro</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {tieneFeature('calculadoraPrecio') ? (
            <button onClick={() => setShowCalculadora(true)} style={{ background: '#2c2c2e', color: '#c9a96e', border: '1px solid #3a3a3c', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🧮 Calculadora</button>
          ) : (
            <button onClick={() => navigate('/planes')} style={{ background: '#2c2c2e', color: '#3a3a3c', border: '1px solid #2c2c2e', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔒 Calculadora</button>
          )}
          {tieneFeature('catalogoPublico') ? (
            <button onClick={() => setModalCatalogo(true)} style={{ background: '#2c2c2e', color: '#fff', border: '1px solid #3a3a3c', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔗 Catálogo</button>
          ) : (
            <button onClick={() => navigate('/planes')} style={{ background: '#2c2c2e', color: '#3a3a3c', border: '1px solid #2c2c2e', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔒 Catálogo</button>
          )}
          {esAdmin && <button onClick={handleAgregarEquipo} style={{ background: '#c9a96e', color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Agregar equipo</button>}
        </div>
      </div>

      <input placeholder="Buscar por modelo, color, IMEI, vendedor..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...inputStyle, marginBottom: 20, maxWidth: 420 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {equiposFiltrados.map(eq => (
          <div key={eq.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20, borderTop: `3px solid ${estadoColor[eq.estado] || '#c9a96e'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{eq.modelo}</div>
                <div style={{ color: '#86868b', fontSize: 12, marginTop: 2 }}>{eq.gb}GB · {eq.color}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', background: `${estadoColor[eq.estado]}22`, color: estadoColor[eq.estado] }}>{eq.estado}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#ebebf5cc', marginBottom: 12 }}>
              <span>🔋 Batería: {eq.bateria}%</span>
              {eq.imei && <span>📋 IMEI: {eq.imei}</span>}
              {eq.puntoVenta && <span>📍 {eq.puntoVenta}</span>}
              {eq.asignadoA && <span>👤 {eq.asignadoA}</span>}
              <span style={{ color: eq.tipo === 'consignacion' ? '#ff9f0a' : '#30d158', fontWeight: 600, marginTop: 4 }}>
                {eq.tipo === 'consignacion' ? '🤝 Consignación' : '🛒 Compra directa'}
              </span>
              {esAdmin && eq.costoUsd && <span style={{ color: '#86868b' }}>Costo: USD {eq.costoUsd}</span>}
              {eq.pvUsd && <span style={{ color: '#c9a96e', fontWeight: 600 }}>Venta: USD {eq.pvUsd}</span>}
              {eq.fechaIngreso && <span style={{ color: '#86868b' }}>📅 {eq.fechaIngreso.toDate ? eq.fechaIngreso.toDate().toLocaleDateString('es-AR') : new Date(eq.fechaIngreso).toLocaleDateString('es-AR')}</span>}
            </div>
            {eq.estado === 'disponible' && (
              <button onClick={() => copiarFicha(eq)} style={{ width: '100%', background: copiado === eq.id ? 'rgba(48,209,88,0.15)' : '#2c2c2e', border: `1px solid ${copiado === eq.id ? 'rgba(48,209,88,0.3)' : '#3a3a3c'}`, color: copiado === eq.id ? '#30d158' : '#c9a96e', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {copiado === eq.id ? '✓ Ficha copiada' : '📤 Compartir ficha WhatsApp'}
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => abrirEditar(eq)} style={{ flex: 1, background: '#2c2c2e', border: '1px solid #3a3a3c', color: '#c9a96e', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ Editar</button>
              {esAdmin && <button onClick={() => eliminarEquipo(eq.id)} style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', color: '#ff3b30', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>🗑️</button>}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editandoId ? '✏️ Editar equipo' : 'Agregar equipo'}</h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Modelo</label><select value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} required style={inputStyle}><option value="">Elegir...</option>{modelos.map(m => <option key={m}>{m}</option>)}</select></div>
                <div><label style={labelStyle}>Color</label><select value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={inputStyle}><option value="">Elegir...</option>{COLORES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label style={labelStyle}>GB</label><select value={form.gb} onChange={e => setForm({...form, gb: e.target.value})} style={inputStyle}><option value="">Elegir...</option>{GBS.map(g => <option key={g}>{g}</option>)}</select></div>
                <div><label style={labelStyle}>Batería %</label><input type="number" min="0" max="100" value={form.bateria} onChange={e => setForm({...form, bateria: e.target.value})} placeholder="91" style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>IMEI</label><input value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} placeholder="123456789012345" style={inputStyle} /></div>
                <div><label style={labelStyle}>Tipo de adquisición</label><select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={inputStyle}>{TIPOS.map(t => <option key={t} value={t}>{t === 'consignacion' ? 'Consignación' : 'Compra directa'}</option>)}</select></div>
                <div><label style={labelStyle}>Proveedor</label><select value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle}><option value="">Elegir...</option>{proveedores.map(p => <option key={p.id}>{p.nombre}</option>)}</select></div>
                <div><label style={labelStyle}>Costo USD</label><input type="number" value={form.costoUsd} onChange={e => setForm({...form, costoUsd: e.target.value})} placeholder="400" style={inputStyle} /></div>
                <div><label style={labelStyle}>Precio Venta USD</label><input type="number" value={form.pvUsd} onChange={e => setForm({...form, pvUsd: e.target.value})} placeholder="500" style={inputStyle} /></div>
                <div><label style={labelStyle}>Punto de venta</label><select value={form.puntoVenta} onChange={e => setForm({...form, puntoVenta: e.target.value})} style={inputStyle}><option value="">Ninguno</option>{puntosVenta.map(p => <option key={p.id}>{p.nombre}</option>)}</select></div>
                <div><label style={labelStyle}>Asignado a</label><select value={form.asignadoA} onChange={e => setForm({...form, asignadoA: e.target.value})} style={inputStyle}><option value="">Ninguno</option>{vendedores.map(v => <option key={v.id}>{v.nombre}</option>)}</select></div>
                <div><label style={labelStyle}>Estado</label><select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} style={inputStyle}>{ESTADOS.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label style={labelStyle}>Fecha de ingreso</label><input type="date" value={form.fechaManual} onChange={e => setForm({...form, fechaManual: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Notas</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: '#c9a96e', border: 'none', borderRadius: 8, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar equipo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal catálogo */}
      {modalCatalogo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🔗 Tu catálogo público</h2>
              <button onClick={() => setModalCatalogo(false)} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ color: '#86868b', fontSize: 13, marginBottom: 16 }}>Compartí este link con tus clientes. Solo muestra los equipos disponibles, sin precios de costo.</p>
            <div style={{ background: '#2c2c2e', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#c9a96e', wordBreak: 'break-all', marginBottom: 16 }}>{urlCatalogo}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { navigator.clipboard.writeText(urlCatalogo); }} style={{ flex: 1, background: '#c9a96e', color: '#000', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Copiar link</button>
              <a href={`https://wa.me/?text=Mirá mi catálogo de iPhones: ${urlCatalogo}`} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Compartir por WhatsApp</a>
            </div>
          </div>
        </div>
      )}

      {showCalculadora && <CalculadoraPrecio tipoCambio={tipoCambio} onClose={() => setShowCalculadora(false)} />}
      {modalLimite && (
        <ModalLimiteAlcanzado
          tipo="stock" planActual={plan}
          cantidadActual={equipos.length}
          onCerrar={() => setModalLimite(false)}
        />
      )}
    </div>
  );
}
