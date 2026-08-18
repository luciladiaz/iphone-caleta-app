import { useState, useRef, useEffect } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IconSearch, IconX, IconPlus } from './Icons';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const NUEVO_VACIO = { nombre: '', telefono: '', email: '', dni: '', direccion: '' };

// Combobox de cliente reutilizable: buscar entre los clientes ya cargados en la
// agenda (negocios/{id}/clientes) o crear uno nuevo sin salir del formulario. Se usa
// en cualquier solapa que registre un cliente (Ventas, Reparaciones, etc.) para que
// el criterio sea el mismo en toda la app.
export default function SelectorCliente({ negocioId, clientes, clienteId, onSeleccionar, onClienteCreado, label = 'Cliente' }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(NUEVO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const wrapRef = useRef(null);

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  useEffect(() => {
    const onClickFuera = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAbierto(false);
        setModoNuevo(false);
      }
    };
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  const filtrados = clientes.filter(c => {
    const b = busqueda.trim().toLowerCase();
    if (!b) return true;
    return c.nombre?.toLowerCase().includes(b) || c.telefono?.includes(b) || c.dni?.includes(b) || c.email?.toLowerCase().includes(b);
  });

  const elegir = (c) => {
    onSeleccionar(c);
    setAbierto(false);
    setBusqueda('');
  };

  const quitar = (e) => {
    e.stopPropagation();
    onSeleccionar(null);
    setBusqueda('');
  };

  const abrirNuevo = () => {
    setNuevoCliente({ ...NUEVO_VACIO, nombre: busqueda });
    setModoNuevo(true);
  };

  const guardarNuevo = async () => {
    if (!nuevoCliente.nombre.trim()) return;
    setGuardando(true);
    try {
      const ref = await addDoc(collection(db, 'negocios', negocioId, 'clientes'), { ...nuevoCliente });
      const creado = { id: ref.id, ...nuevoCliente };
      onClienteCreado?.(creado);
      onSeleccionar(creado);
      setModoNuevo(false);
      setAbierto(false);
      setBusqueda('');
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      {!abierto ? (
        <div onClick={() => setAbierto(true)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: clienteSeleccionado ? 'var(--rv-text)' : 'var(--rv-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {clienteSeleccionado ? `${clienteSeleccionado.nombre}${clienteSeleccionado.telefono ? ' · ' + clienteSeleccionado.telefono : ''}` : 'Buscar o elegir cliente...'}
          </span>
          {clienteSeleccionado ? (
            <button type="button" onClick={quitar} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><IconX size={14} /></button>
          ) : (
            <IconSearch size={13} style={{ color: 'var(--rv-text-dim)', flexShrink: 0 }} />
          )}
        </div>
      ) : (
        <>
          <input
            autoFocus
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
            placeholder="Escribí nombre, teléfono o DNI..."
            style={inputStyle}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--rv-surface)',
            border: '1px solid var(--rv-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 50,
            maxHeight: 260, overflowY: 'auto',
          }}>
            {!modoNuevo ? (
              <>
                {filtrados.map(c => (
                  <div key={c.id} onClick={() => elegir(c)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--rv-border)', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                    {(c.telefono || c.email) && <div style={{ color: 'var(--rv-text-dim)', fontSize: 11, marginTop: 2 }}>{[c.telefono, c.email].filter(Boolean).join(' · ')}</div>}
                  </div>
                ))}
                {filtrados.length === 0 && <div style={{ padding: '12px 14px', color: 'var(--rv-text-dim)', fontSize: 12 }}>Sin resultados</div>}
                <div onClick={abrirNuevo} style={{ padding: '10px 14px', cursor: 'pointer', color: 'var(--rv-accent)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconPlus size={12} />{busqueda ? `Crear cliente "${busqueda}"` : 'Nuevo cliente'}
                </div>
              </>
            ) : (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input value={nuevoCliente.nombre} onChange={e => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} placeholder="Nombre *" style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={nuevoCliente.telefono} onChange={e => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} placeholder="Teléfono" style={inputStyle} />
                  <input value={nuevoCliente.dni} onChange={e => setNuevoCliente({ ...nuevoCliente, dni: e.target.value })} placeholder="DNI" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setModoNuevo(false)} style={{ flex: 1, background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', color: 'var(--rv-text)' }}>Cancelar</button>
                  <button type="button" onClick={guardarNuevo} disabled={guardando || !nuevoCliente.nombre.trim()} style={{ flex: 1, background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
