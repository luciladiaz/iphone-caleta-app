import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';

const inputStyle = { width: '100%', padding: '10px 12px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const MODULOS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'stock', label: 'Stock' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'cobros', label: 'Cobros' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'pagos', label: 'Pagos Proveedores' },
  { key: 'config', label: 'Configuración' },
  { key: 'usuarios', label: 'Usuarios' },
];

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'vendedor', puntoVenta: '', activo: true, permisos: {} });

  const cargar = async () => {
    const [uSnap, pvSnap] = await Promise.all([
      getDocs(collection(db, 'usuarios')),
      getDocs(collection(db, 'puntosVenta')),
    ]);
    setUsuarios(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPuntosVenta(pvSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { cargar(); }, []);

  const togglePermiso = (key) => setForm(f => ({ ...f, permisos: { ...f.permisos, [key]: !f.permisos[key] } }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nombre: form.nombre, email: form.email,
        rol: form.rol, puntoVenta: form.puntoVenta,
        activo: form.activo, permisos: form.permisos,
      });
      setModal(false);
      setForm({ nombre: '', email: '', password: '', rol: 'vendedor', puntoVenta: '', activo: true, permisos: {} });
      cargar();
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'Ese email ya está registrado' : err.message);
    } finally { setGuardando(false); }
  };

  const toggleActivo = async (u) => {
    await updateDoc(doc(db, 'usuarios', u.id), { activo: !u.activo });
    cargar();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>👥 Usuarios</h1>
        <button onClick={() => setModal(true)} style={{ background: '#c9a96e', color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Nuevo usuario</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {usuarios.map(u => (
          <div key={u.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{u.nombre}</div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 3 }}>{u.email} · {u.rol} {u.puntoVenta ? `· ${u.puntoVenta}` : ''}</div>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {u.rol === 'admin' ? (
                  <span style={{ fontSize: 10, background: 'rgba(201,169,110,0.15)', color: '#c9a96e', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>Todos los módulos</span>
                ) : MODULOS.filter(m => u.permisos?.[m.key]).map(m => (
                  <span key={m.key} style={{ fontSize: 10, background: '#2c2c2e', color: '#ebebf5cc', padding: '2px 8px', borderRadius: 99 }}>{m.label}</span>
                ))}
              </div>
            </div>
            <button onClick={() => toggleActivo(u)} style={{
              background: u.activo ? 'rgba(48,209,88,0.1)' : 'rgba(255,59,48,0.1)',
              border: `1px solid ${u.activo ? 'rgba(48,209,88,0.3)' : 'rgba(255,59,48,0.3)'}`,
              color: u.activo ? '#30d158' : '#ff3b30',
              borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>{u.activo ? 'Activo' : 'Inactivo'}</button>
          </div>
        ))}
        {usuarios.length === 0 && <p style={{ color: '#86868b' }}>No hay usuarios creados.</p>}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nuevo usuario</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>Nombre</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required style={inputStyle} /></div>
              <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={inputStyle} /></div>
              <div><label style={labelStyle}>Contraseña</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Rol</label>
                  <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} style={inputStyle}>
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Punto de venta</label>
                  <select value={form.puntoVenta} onChange={e => setForm({ ...form, puntoVenta: e.target.value })} style={inputStyle}>
                    <option value="">Ninguno</option>
                    {puntosVenta.map(p => <option key={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>

              {form.rol === 'vendedor' && (
                <div>
                  <label style={{ ...labelStyle, marginBottom: 10 }}>Permisos de módulos</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {MODULOS.map(m => (
                      <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#ebebf5cc' }}>
                        <input type="checkbox" checked={!!form.permisos[m.key]} onChange={() => togglePermiso(m.key)} style={{ accentColor: '#c9a96e' }} />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 8, padding: '10px 14px', color: '#ff3b30', fontSize: 13 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setModal(false)} style={{ padding: '10px 20px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: '#c9a96e', border: 'none', borderRadius: 8, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {guardando ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
