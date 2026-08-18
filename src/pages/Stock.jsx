import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import CalculadoraPrecio from '../components/CalculadoraPrecio';
import ModalLimiteAlcanzado from '../components/ModalLimiteAlcanzado';
import { IconCalculator, IconLink, IconShare, IconEdit, IconTrash, IconCheck, IconX, IconBox } from '../components/Icons';
import { CATEGORIAS_STOCK, MODELOS_DEFAULT_POR_CATEGORIA, ETIQUETA_ID_POR_CATEGORIA, SUGERENCIAS_CAPACIDAD_POR_CATEGORIA, EMOJI_POR_CATEGORIA } from '../lib/categoriasProducto';

const COLORES = ['Negro','Blanco','Azul','Natural','Desert','Desert Titanium','Natural Titanium','Naranja','Rosa','Verde','Morado','Rojo','Gris','Plata','Dorado'];
const TIPOS = ['compra','consignacion'];
const ESTADOS = ['disponible','asignado','vendido'];
const estadoColor = { disponible: 'var(--rv-accent)', asignado: 'var(--rv-text-mid)', vendido: 'var(--rv-text-dim)' };

// Los teléfonos guardan la capacidad como número plano ("128") y necesitan el
// sufijo GB; Mac/Drone suelen cargar specs libres ("16GB RAM / 512GB SSD") que
// ya vienen con unidad y no hay que duplicar.
const formatCapacidad = (gb) => /^\d+$/.test(String(gb).trim()) ? `${gb}GB` : gb;

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

export default function Stock() {
  const { perfil, negocioId, plan, limitesPlan } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const base = ['negocios', negocioId];

  const [equipos, setEquipos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [modelosPorCategoria, setModelosPorCategoria] = useState(MODELOS_DEFAULT_POR_CATEGORIA);
  const [tipoCambio, setTipoCambio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('activos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [modalCatalogo, setModalCatalogo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [modalLimite, setModalLimite] = useState(false);
  const FORM_VACIO = {
    categoria: 'iPhone', modelo: '', color: '', gb: '', bateria: '', imei: '',
    tipo: 'compra', proveedor: '', costoUsd: '', pvUsd: '',
    estado: 'disponible', puntoVenta: '', asignadoA: '', notas: '', fechaManual: ''
  };
  const [form, setForm] = useState(FORM_VACIO);

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
    if (cfg.modelosPorCategoria) {
      const combinado = {};
      CATEGORIAS_STOCK.forEach(cat => { combinado[cat] = cfg.modelosPorCategoria[cat]?.length ? cfg.modelosPorCategoria[cat] : MODELOS_DEFAULT_POR_CATEGORIA[cat]; });
      setModelosPorCategoria(combinado);
    } else if (cfg.modelos?.length) {
      setModelosPorCategoria({ ...MODELOS_DEFAULT_POR_CATEGORIA, iPhone: cfg.modelos });
    }
    if (cfg.tipoCambio) setTipoCambio(cfg.tipoCambio);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const abrirEditar = (eq) => {
    setEditandoId(eq.id);
    setForm({
      categoria: eq.categoria || 'iPhone', modelo: eq.modelo || '', color: eq.color || '', gb: eq.gb || '',
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
    setForm(FORM_VACIO);
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
        if (fechaManual) datos.fechaIngreso = new Date(fechaManual);
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
    const emoji = EMOJI_POR_CATEGORIA[eq.categoria] || '📱';
    const specs = [eq.gb ? formatCapacidad(eq.gb) : '', eq.color].filter(Boolean).join(' ');
    const bateriaLinea = eq.bateria ? `🔋 Batería: ${eq.bateria}%\n` : '';
    return `${emoji} *${eq.modelo}${specs ? ' ' + specs : ''}*\n${bateriaLinea}✅ Libre de operador\n${eq.pvUsd ? `💵 USD ${eq.pvUsd}` : ''}\n${precioARS ? `💵 ${precioARS}` : ''}\n📩 Consultá disponibilidad por este medio`;
  };

  const copiarFicha = (eq) => {
    navigator.clipboard.writeText(generarFichaWA(eq));
    setCopiado(eq.id);
    setTimeout(() => setCopiado(false), 2000);
  };

  const urlCatalogo = `${window.location.origin}/catalogo/${negocioId}`;
  const stockDisponible = equipos.filter(e => e.estado === 'disponible');
  const stockVendido = equipos.filter(e => e.estado === 'vendido');
  const totalValorUSD = stockDisponible.reduce((acc, e) => acc + Number(e.pvUsd || 0), 0);
  const equiposFiltrados = equipos
    .filter(e => {
      if (filtroEstado === 'activos') return e.estado !== 'vendido';
      if (filtroEstado === 'vendido') return e.estado === 'vendido';
      return true;
    })
    .filter(e => filtroCategoria === 'todas' || e.categoria === filtroCategoria)
    .filter(e =>
      `${e.categoria} ${e.modelo} ${e.color} ${e.gb} ${e.imei} ${e.puntoVenta} ${e.asignadoA}`.toLowerCase().includes(filtro.toLowerCase())
    );
  const categoriasConStock = CATEGORIAS_STOCK.filter(cat => equipos.some(e => e.categoria === cat));
  const maxStock = limitesPlan?.maxStock ?? Infinity;
  const limiteAlcanzado = maxStock !== Infinity && equipos.length >= maxStock;

  const handleAgregarEquipo = () => {
    if (limiteAlcanzado) { setModalLimite(true); return; }
    setModal(true);
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando stock...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Stock</h1>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, margin: '4px 0 0' }}>
            {stockDisponible.length} disponibles · {stockVendido.length} vendidos · {equipos.length} total
            {esAdmin && totalValorUSD > 0 && <span style={{ color: 'var(--rv-accent)', marginLeft: 8 }}>· USD {totalValorUSD.toFixed(0)} en stock</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowCalculadora(true)} style={{ background: 'var(--rv-surface-alt)', color: 'var(--rv-accent)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><IconCalculator size={15} />Calculadora</button>
          <button onClick={() => setModalCatalogo(true)} style={{ background: 'var(--rv-surface-alt)', color: 'var(--rv-text)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><IconLink size={15} />Catálogo</button>
          {esAdmin && <button onClick={handleAgregarEquipo} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Agregar equipo</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {[{ key: 'activos', label: 'En stock' }, { key: 'vendido', label: 'Vendidos' }, { key: 'todos', label: 'Todos' }].map(f => (
          <button key={f.key} onClick={() => setFiltroEstado(f.key)} style={{ background: filtroEstado === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroEstado === f.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{f.label}</button>
        ))}
      </div>

      {categoriasConStock.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroCategoria('todas')} style={{ background: filtroCategoria === 'todas' ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroCategoria === 'todas' ? '#fff' : 'var(--rv-text-dim)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Todas las categorías</button>
          {categoriasConStock.map(cat => (
            <button key={cat} onClick={() => setFiltroCategoria(cat)} style={{ background: filtroCategoria === cat ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroCategoria === cat ? '#fff' : 'var(--rv-text-dim)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{cat}</button>
          ))}
        </div>
      )}

      <input placeholder="Buscar por modelo, color, IMEI/serie, vendedor..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...inputStyle, marginBottom: 20, maxWidth: 420 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {equiposFiltrados.map(eq => (
          <div key={eq.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 20, borderTop: `3px solid ${estadoColor[eq.estado] || 'var(--rv-accent)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--rv-text-dim)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{eq.categoria || 'iPhone'}</span>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{eq.modelo}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', border: '1px solid var(--rv-border)', color: estadoColor[eq.estado] }}>{eq.estado}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--rv-text-mid)', marginBottom: 12 }}>
              {eq.gb && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{formatCapacidad(eq.gb)}</span>}
              {eq.color && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{eq.color}</span>}
              {eq.bateria && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>Batería {eq.bateria}%</span>}
              {eq.imei && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{ETIQUETA_ID_POR_CATEGORIA[eq.categoria] || 'IMEI'} {eq.imei}</span>}
              <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{eq.tipo === 'consignacion' ? 'Consignación' : 'Compra directa'}</span>
              {eq.puntoVenta && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{eq.puntoVenta}</span>}
              {eq.asignadoA && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{eq.asignadoA}</span>}
              {esAdmin && eq.costoUsd && <span style={{ color: 'var(--rv-text-dim)', marginTop: 4 }}>Costo: USD {eq.costoUsd}</span>}
              {eq.pvUsd && <span style={{ color: 'var(--rv-accent)', fontWeight: 600 }}>Venta: USD {eq.pvUsd}</span>}
              {eq.fechaIngreso && <span style={{ color: 'var(--rv-text-dim)' }}>{eq.fechaIngreso.toDate ? eq.fechaIngreso.toDate().toLocaleDateString('es-AR') : new Date(eq.fechaIngreso).toLocaleDateString('es-AR')}</span>}
            </div>
            {eq.estado === 'disponible' && (
              <button onClick={() => copiarFicha(eq)} style={{ width: '100%', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: copiado === eq.id ? 'var(--rv-text)' : 'var(--rv-accent)', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {copiado === eq.id ? <><IconCheck size={13} />Ficha copiada</> : <><IconShare size={13} />Compartir ficha WhatsApp</>}
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => abrirEditar(eq)} style={{ flex: 1, background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-accent)', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><IconEdit size={13} />Editar</button>
              {esAdmin && <button onClick={() => eliminarEquipo(eq.id)} style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', color: 'var(--rv-danger)', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconTrash size={14} /></button>}
            </div>
          </div>
        ))}
      </div>

      {equiposFiltrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
          <IconBox size={36} style={{ marginBottom: 12 }} />
          <p>{filtroEstado === 'vendido' ? 'Todavía no vendiste ningún equipo' : filtro ? 'No hay equipos que coincidan con la búsqueda' : 'No hay equipos en stock'}</p>
        </div>
      )}

      {/* Modal agregar */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}>{editandoId ? <><IconEdit size={16} />Editar equipo</> : 'Agregar equipo'}</h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Categoría</label><select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value, modelo: ''})} style={inputStyle}>{CATEGORIAS_STOCK.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={labelStyle}>Modelo</label><select value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} required style={inputStyle}><option value="">Elegir...</option>{(modelosPorCategoria[form.categoria] || []).map(m => <option key={m}>{m}</option>)}</select></div>
                <div><label style={labelStyle}>Color</label><select value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={inputStyle}><option value="">Elegir...</option>{COLORES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div>
                  <label style={labelStyle}>Capacidad / specs</label>
                  <input list="sugerencias-capacidad" value={form.gb} onChange={e => setForm({...form, gb: e.target.value})} placeholder={form.categoria === 'Mac' ? '16GB RAM / 512GB SSD' : form.categoria === 'Drone' ? 'Opcional' : '128'} style={inputStyle} />
                  <datalist id="sugerencias-capacidad">{(SUGERENCIAS_CAPACIDAD_POR_CATEGORIA[form.categoria] || []).map(g => <option key={g} value={g} />)}</datalist>
                </div>
                <div><label style={labelStyle}>Batería %</label><input type="number" min="0" max="100" value={form.bateria} onChange={e => setForm({...form, bateria: e.target.value})} placeholder="91" style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>{ETIQUETA_ID_POR_CATEGORIA[form.categoria] || 'IMEI'}</label><input value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} placeholder={form.categoria === 'Mac' || form.categoria === 'Drone' ? 'Número de serie' : '123456789012345'} style={inputStyle} /></div>
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
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar equipo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal catálogo */}
      {modalCatalogo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}><IconLink size={16} />Tu catálogo público</h2>
              <button onClick={() => setModalCatalogo(false)} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 16 }}>Compartí este link con tus clientes. Solo muestra los equipos disponibles, sin precios de costo.</p>
            <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--rv-accent)', wordBreak: 'break-all', marginBottom: 16 }}>{urlCatalogo}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { navigator.clipboard.writeText(urlCatalogo); }} style={{ flex: 1, background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Copiar link</button>
              <a href={`https://wa.me/?text=Mirá mi catálogo: ${urlCatalogo}`} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Compartir por WhatsApp</a>
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

