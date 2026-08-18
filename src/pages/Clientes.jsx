import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconUser, IconPhone, IconMail, IconPin, IconHash, IconEdit, IconTrash, IconX, IconPlus, IconSearch } from '../components/Icons';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const FORM_VACIO = { nombre: '', telefono: '', email: '', dni: '', direccion: '', notas: '' };

export default function Clientes() {
  const { negocioId } = useAuth();
  const base = ['negocios', negocioId];
  const [clientes, setClientes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);

  const cargar = async () => {
    if (!negocioId) return;
    const [cSnap, vSnap] = await Promise.all([
      getDocs(query(collection(db, ...base, 'clientes'), orderBy('nombre'))),
      getDocs(collection(db, ...base, 'ventas')),
    ]);
    setClientes(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setVentas(vSnap.docs.map(d => d.data()));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setModal(true); };
  const abrirEditar = (c) => { setEditando(c.id); setForm({ ...FORM_VACIO, ...c }); setModal(true); };
  const cerrarModal = () => { setModal(false); setEditando(null); setForm(FORM_VACIO); };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      if (editando) {
        await updateDoc(doc(db, ...base, 'clientes', editando), { ...form });
      } else {
        await addDoc(collection(db, ...base, 'clientes'), { ...form });
      }
      cerrarModal();
      cargar();
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
  };

  const eliminarCliente = async (c) => {
    if (!window.confirm(`¿Eliminás a ${c.nombre}? Las ventas ya registradas no se modifican.`)) return;
    await deleteDoc(doc(db, ...base, 'clientes', c.id));
    cargar();
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando clientes...</div>;

  const comprasDe = (clienteId) => ventas.filter(v => v.clienteId === clienteId).length;

  const clientesFiltrados = clientes.filter(c => {
    const b = busqueda.trim().toLowerCase();
    if (!b) return true;
    return c.nombre?.toLowerCase().includes(b) || c.telefono?.includes(b) || c.email?.toLowerCase().includes(b) || c.dni?.includes(b);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><IconUser size={22} style={{ color: 'var(--rv-accent)' }} />Clientes</h1>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, margin: '4px 0 0' }}>{clientes.length} clientes cargados</p>
        </div>
        <button onClick={abrirNuevo} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <IconPlus size={14} />Nuevo cliente
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
        <IconSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--rv-text-dim)' }} />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, teléfono, email o DNI..." style={{ ...inputStyle, paddingLeft: 34 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {clientesFiltrados.map(c => (
          <div key={c.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                {c.nombre}
                {comprasDe(c.id) > 0 && <span style={{ background: 'var(--rv-accent-soft)', color: 'var(--rv-accent)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{comprasDe(c.id)} compra{comprasDe(c.id) > 1 ? 's' : ''}</span>}
              </div>
              <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {c.telefono && <a href={`tel:${c.telefono}`} style={{ color: 'var(--rv-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPhone size={11} />{c.telefono}</a>}
                {c.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconMail size={11} />{c.email}</span>}
                {c.dni && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconHash size={11} />{c.dni}</span>}
                {c.direccion && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPin size={11} />{c.direccion}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => abrirEditar(c)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-accent)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconEdit size={13} />Editar
              </button>
              <button onClick={() => eliminarCliente(c)} style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', color: 'var(--rv-danger)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex' }}>
                <IconTrash size={13} />
              </button>
            </div>
          </div>
        ))}
        {clientesFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
            <IconUser size={36} style={{ marginBottom: 12 }} />
            <p>{clientes.length > 0 ? 'No hay clientes con esta búsqueda' : 'No hay clientes cargados todavía'}</p>
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}>{editando ? <><IconEdit size={16} />Editar cliente</> : 'Nuevo cliente'}</h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre y apellido" required autoFocus style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+54 9 11 1234-5678" type="tel" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>DNI / CUIT</label>
                  <input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} placeholder="30123456" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="cliente@mail.com" type="email" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Dirección</label>
                <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Calle 123, Ciudad" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Guardar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
