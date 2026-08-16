import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconBox, IconHash, IconCoin, IconEdit, IconCheck, IconX } from '../components/Icons';

const CATEGORIAS = ['Fundas', 'Vidrios templados', 'Cables', 'Cargadores', 'Adaptadores', 'Audio / AirPods', 'MagSafe', 'Power banks', 'Soportes', 'Otros'];

const inputStyle = {
  width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)',
  border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const labelStyle = {
  color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600,
  display: 'block', marginBottom: 4, textTransform: 'uppercase',
};

const FORM_VACIO = { nombre: '', categoria: 'Fundas', color: '', cantidad: '', precioCosto: '', precioVenta: '' };

export default function Accesorios() {
  const { negocioId } = useAuth();
  const [accesorios, setAccesorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editCantidad, setEditCantidad] = useState('');
  const [filtro, setFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = async () => {
    if (!negocioId) return;
    const snap = await getDocs(collection(db, 'negocios', negocioId, 'accesorios'));
    setAccesorios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const guardar = async () => {
    if (!form.nombre.trim() || !form.cantidad) return;
    setSaving(true);
    await addDoc(collection(db, 'negocios', negocioId, 'accesorios'), {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      color: form.color.trim(),
      cantidad: Number(form.cantidad),
      precioCosto: Number(form.precioCosto) || 0,
      precioVenta: Number(form.precioVenta) || 0,
      creadoEn: new Date(),
    });
    setForm(FORM_VACIO);
    setMostrarForm(false);
    setSaving(false);
    cargar();
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este accesorio?')) return;
    await deleteDoc(doc(db, 'negocios', negocioId, 'accesorios', id));
    cargar();
  };

  const guardarCantidad = async (id) => {
    const n = parseInt(editCantidad);
    if (isNaN(n) || n < 0) return;
    await updateDoc(doc(db, 'negocios', negocioId, 'accesorios', id), { cantidad: n });
    setEditandoId(null);
    cargar();
  };

  const filtrados = accesorios.filter(a => {
    const texto = `${a.nombre} ${a.color || ''}`.toLowerCase().includes(filtro.toLowerCase());
    const cat = categoriaFiltro === 'Todas' || a.categoria === categoriaFiltro;
    return texto && cat;
  });

  const totalUnidades = accesorios.reduce((s, a) => s + (a.cantidad || 0), 0);
  const valorStock = accesorios.reduce((s, a) => s + ((a.cantidad || 0) * (a.precioCosto || 0)), 0);

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><IconBox size={22} style={{ color: 'var(--rv-accent)' }} />Accesorios</h1>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          {mostrarForm ? 'Cancelar' : '+ Agregar accesorio'}
        </button>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Tipos', valor: accesorios.length, Icono: IconBox },
          { label: 'Unidades', valor: totalUnidades, Icono: IconHash },
          { label: 'Valor stock (costo)', valor: `$${valorStock.toLocaleString('es-AR')}`, Icono: IconCoin },
        ].map(({ label, valor, Icono }) => (
          <div key={label} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '16px 18px' }}>
            <Icono size={20} style={{ color: 'var(--rv-accent)', marginBottom: 6 }} />
            <div style={{ fontSize: 20, fontWeight: 800 }}>{valor}</div>
            <div style={{ color: 'var(--rv-text-dim)', fontSize: 12 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>Nuevo accesorio</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>NOMBRE *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Funda silicona iPhone 15" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CATEGORÍA</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                style={{ ...inputStyle }}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>COLOR / VARIANTE</label>
              <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                placeholder="Ej: Negro, Transparente" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CANTIDAD *</label>
              <input type="number" min="0" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>PRECIO COSTO ($)</label>
              <input type="number" min="0" value={form.precioCosto} onChange={e => setForm(f => ({ ...f, precioCosto: e.target.value }))}
                placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>PRECIO VENTA ($)</label>
              <input type="number" min="0" value={form.precioVenta} onChange={e => setForm(f => ({ ...f, precioVenta: e.target.value }))}
                placeholder="0" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={guardar} disabled={saving || !form.nombre.trim() || !form.cantidad}
              style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', opacity: (saving || !form.nombre.trim() || !form.cantidad) ? 0.5 : 1 }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => { setForm(FORM_VACIO); setMostrarForm(false); }}
              style={{ background: 'none', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '10px 20px', color: 'var(--rv-text-dim)', cursor: 'pointer', fontWeight: 600 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar accesorio..."
          value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 160 }}>
          <option value="Todas">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 48, textAlign: 'center', color: 'var(--rv-text-dim)' }}>
          <IconBox size={34} style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No hay accesorios cargados</div>
          <div style={{ fontSize: 13 }}>Hacé clic en "+ Agregar accesorio" para empezar</div>
        </div>
      ) : (
        <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Header tabla */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, padding: '10px 16px', background: 'var(--rv-surface-alt)', fontSize: 11, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase' }}>
            <span>Producto</span>
            <span>Categoría</span>
            <span>Stock</span>
            <span>Costo</span>
            <span>Venta</span>
            <span></span>
          </div>
          {filtrados.map((a, i) => (
            <div key={a.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
              gap: 8, padding: '12px 16px', alignItems: 'center',
              borderTop: i === 0 ? 'none' : '1px solid var(--rv-border)',
              background: i % 2 === 0 ? 'transparent' : 'var(--rv-surface-alt)',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.nombre}</div>
                {a.color && <div style={{ color: 'var(--rv-text-dim)', fontSize: 12 }}>{a.color}</div>}
              </div>
              <div>
                <span style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: 'var(--rv-text-mid)' }}>
                  {a.categoria}
                </span>
              </div>
              <div>
                {editandoId === a.id ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input type="number" min="0" value={editCantidad} onChange={e => setEditCantidad(e.target.value)}
                      style={{ ...inputStyle, width: 60, padding: '4px 8px', fontSize: 13 }}
                      onKeyDown={e => { if (e.key === 'Enter') guardarCantidad(a.id); if (e.key === 'Escape') setEditandoId(null); }}
                      autoFocus
                    />
                    <button onClick={() => guardarCantidad(a.id)} style={{ background: 'var(--rv-accent)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer', display: 'flex' }}><IconCheck size={13} /></button>
                    <button onClick={() => setEditandoId(null)} style={{ background: 'none', border: '1px solid var(--rv-border)', borderRadius: 6, padding: '4px 8px', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={13} /></button>
                  </div>
                ) : (
                  <button onClick={() => { setEditandoId(a.id); setEditCantidad(String(a.cantidad)); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--rv-text)' }}>{a.cantidad}</span>
                    <IconEdit size={12} style={{ color: 'var(--rv-text-dim)' }} />
                  </button>
                )}
              </div>
              <div style={{ color: 'var(--rv-text-dim)', fontSize: 14 }}>
                {a.precioCosto ? `$${a.precioCosto.toLocaleString('es-AR')}` : '—'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rv-accent)' }}>
                {a.precioVenta ? `$${a.precioVenta.toLocaleString('es-AR')}` : '—'}
              </div>
              <button onClick={() => eliminar(a.id)}
                style={{ background: 'none', border: 'none', color: 'var(--rv-danger)', cursor: 'pointer', padding: '0 4px', display: 'flex' }}>
                <IconX size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
