import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import ModalLimiteAlcanzado from '../components/ModalLimiteAlcanzado';
import { IconUser, IconX, IconEdit, IconTrash } from '../components/Icons';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const MODULOS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'stock', label: 'Stock' },
  { key: 'accesorios', label: 'Accesorios' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'cobros', label: 'Cobros' },
  { key: 'caja', label: 'Caja' },
  { key: 'reparaciones', label: 'Reparaciones' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'gerencial', label: 'Gerencial' },
  { key: 'vendedores', label: 'Rendimiento' },
  { key: 'config', label: 'Configuración' },
  { key: 'usuarios', label: 'Usuarios' },
];

const FORM_VACIO = { nombre: '', email: '', password: '', puntosVenta: [], activo: true, permisos: {} };

// Lee los puntos de venta de un usuario con fallback al campo viejo (singular,
// de antes de que se pudiera asignar más de uno).
const puntosVentaDe = (u) => u.puntosVenta?.length ? u.puntosVenta : (u.puntoVenta ? [u.puntoVenta] : []);

export default function Usuarios() {
  const { negocioId, plan, limitesPlan } = useAuth();
  const base = ['negocios', negocioId];

  const [usuarios, setUsuarios] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [modalLimite, setModalLimite] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const cargar = async () => {
    if (!negocioId) return;
    const [uSnap, pvSnap] = await Promise.all([
      getDocs(collection(db, ...base, 'usuarios')),
      getDocs(collection(db, ...base, 'puntosVenta')),
    ]);
    setUsuarios(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPuntosVenta(pvSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const togglePermiso = (key) => setForm(f => ({ ...f, permisos: { ...f.permisos, [key]: !f.permisos[key] } }));
  const togglePuntoVenta = (nombre) => setForm(f => ({
    ...f,
    puntosVenta: f.puntosVenta.includes(nombre) ? f.puntosVenta.filter(p => p !== nombre) : [...f.puntosVenta, nombre],
  }));

  const abrirNuevo = () => { setEditandoId(null); setForm(FORM_VACIO); setModal(true); };
  const abrirEditar = (u) => {
    setEditandoId(u.id);
    setForm({ nombre: u.nombre || '', email: u.email || '', password: '', puntosVenta: puntosVentaDe(u), activo: u.activo !== false, permisos: u.permisos || {} });
    setModal(true);
  };
  const cerrarModal = () => { setModal(false); setEditandoId(null); setForm(FORM_VACIO); };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (editandoId) {
        // Edición: nunca se toca el rol ni se recrea el login, solo los atributos
        // visibles acá (nombre, puntos de venta, permisos, activo).
        const cambios = { nombre: form.nombre, puntosVenta: form.puntosVenta, permisos: form.permisos, activo: form.activo };
        await updateDoc(doc(db, 'usuarios', editandoId), cambios);
        await updateDoc(doc(db, ...base, 'usuarios', editandoId), cambios);
      } else {
        // App secundaria para no cerrar la sesión del admin al crear el usuario
        const tempApp = initializeApp(firebaseConfig, `crear-usuario-${Date.now()}`);
        const tempAuth = getAuth(tempApp);
        const cred = await createUserWithEmailAndPassword(tempAuth, form.email, form.password);
        await deleteApp(tempApp);

        // Los usuarios que se crean desde acá siempre quedan como "vendedor": su acceso
        // se define 100% por los permisos de módulo elegidos abajo, nunca por un rol
        // que les de acceso total sin pasar por esos checkboxes.
        const userData = { nombre: form.nombre, email: form.email, rol: 'vendedor', puntosVenta: form.puntosVenta, activo: form.activo, permisos: form.permisos, negocioId };
        // Guardar en colección global de usuarios (para auth lookup al iniciar sesión)
        await setDoc(doc(db, 'usuarios', cred.user.uid), userData);
        // Guardar también en el negocio
        await setDoc(doc(db, ...base, 'usuarios', cred.user.uid), userData);
      }
      cerrarModal();
      cargar();
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'Ese email ya está registrado' : err.message);
    } finally { setGuardando(false); }
  };

  const toggleActivo = async (u) => {
    try {
      // setDoc con merge en vez de updateDoc: si por lo que sea uno de los dos
      // documentos (global o del negocio) no existiera, esto lo crea en vez de
      // fallar — antes un solo doc faltante dejaba el toggle trabado sin aviso.
      await setDoc(doc(db, 'usuarios', u.id), { activo: !u.activo }, { merge: true });
      await setDoc(doc(db, ...base, 'usuarios', u.id), { activo: !u.activo }, { merge: true });
      cargar();
    } catch (err) {
      console.error('Error cambiando activo/inactivo:', err);
      alert(`No se pudo cambiar el estado de ${u.nombre}: ${err.message}`);
    }
  };

  const eliminarUsuario = async (u) => {
    if (!window.confirm(`¿Eliminar a ${u.nombre} definitivamente? Esto borra su acceso y su login — no se puede deshacer. Si solo querés bloquearlo temporalmente, usá "Inactivo" en vez de esto.`)) return;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/eliminar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ uid: u.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error desconocido');
      cargar();
    } catch (err) {
      console.error('Error eliminando usuario:', err);
      alert(`No se pudo eliminar a ${u.nombre}: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><IconUser size={22} style={{ color: 'var(--rv-accent)' }} />Usuarios</h1>
        <button
          onClick={() => {
            const maxU = limitesPlan?.maxUsuarios ?? Infinity;
            if (maxU !== Infinity && usuarios.length >= maxU) { setModalLimite(true); return; }
            abrirNuevo();
          }}
          style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >+ Nuevo usuario</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'activos', label: 'Activos' },
          { key: 'inactivos', label: 'Inactivos' },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltroEstado(f.key)} style={{ background: filtroEstado === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroEstado === f.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {usuarios.filter(u => {
          if (filtroEstado === 'activos') return u.rol === 'admin' || u.activo !== false;
          if (filtroEstado === 'inactivos') return u.rol !== 'admin' && u.activo === false;
          return true;
        }).map(u => (
          <div key={u.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{u.nombre}</div>
              <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3 }}>{u.email}{puntosVentaDe(u).length ? ` · ${puntosVentaDe(u).join(', ')}` : ''}</div>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {u.rol === 'admin' ? (
                  <span style={{ fontSize: 10, background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-text-mid)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>Todos los módulos</span>
                ) : MODULOS.filter(m => u.permisos?.[m.key]).map(m => (
                  <span key={m.key} style={{ fontSize: 10, background: 'var(--rv-surface-alt)', color: 'var(--rv-text-mid)', padding: '2px 8px', borderRadius: 99 }}>{m.label}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {u.rol !== 'admin' && (
                <button onClick={() => abrirEditar(u)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-accent)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconEdit size={12} />Editar
                </button>
              )}
              {u.rol === 'admin' ? (
                <span style={{ color: 'var(--rv-text-dim)', fontSize: 12, fontWeight: 600, padding: '6px 14px' }}>Admin</span>
              ) : (
                <>
                  <button onClick={() => toggleActivo(u)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-text-mid)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => eliminarUsuario(u)} title="Eliminar definitivamente" style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', color: 'var(--rv-danger)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex' }}>
                    <IconTrash size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {usuarios.length === 0 && <p style={{ color: 'var(--rv-text-dim)' }}>No hay usuarios creados.</p>}
        {usuarios.length > 0 && usuarios.filter(u => {
          if (filtroEstado === 'activos') return u.rol === 'admin' || u.activo !== false;
          if (filtroEstado === 'inactivos') return u.rol !== 'admin' && u.activo === false;
          return true;
        }).length === 0 && <p style={{ color: 'var(--rv-text-dim)' }}>No hay usuarios {filtroEstado} en esta vista.</p>}
      </div>

      {modalLimite && (
        <ModalLimiteAlcanzado
          tipo="usuarios" planActual={plan}
          cantidadActual={usuarios.length}
          onCerrar={() => setModalLimite(false)}
        />
      )}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editandoId ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>Nombre</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required style={inputStyle} /></div>
              {!editandoId && (
                <>
                  <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={inputStyle} /></div>
                  <div><label style={labelStyle}>Contraseña</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} style={inputStyle} /></div>
                </>
              )}
              <div>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Puntos de venta</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {puntosVenta.length === 0 && <p style={{ color: 'var(--rv-text-dim)', fontSize: 12, margin: 0 }}>No hay puntos de venta cargados en Configuración.</p>}
                  {puntosVenta.map(p => {
                    const activo = form.puntosVenta.includes(p.nombre);
                    return (
                      <button key={p.id} type="button" onClick={() => togglePuntoVenta(p.nombre)} style={{ background: activo ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: activo ? '#fff' : 'var(--rv-text-mid)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {p.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: 10 }}>¿Qué pantallas puede ver?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {MODULOS.map(m => (
                    <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--rv-text-mid)' }}>
                      <input type="checkbox" checked={!!form.permisos[m.key]} onChange={() => togglePermiso(m.key)} style={{ accentColor: 'var(--rv-accent)' }} />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              {error && <div style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--rv-danger)', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {editandoId ? (guardando ? 'Guardando...' : 'Guardar cambios') : (guardando ? 'Creando...' : 'Crear usuario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

