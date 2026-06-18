import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const inputStyle = { width: '100%', padding: '10px 12px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

function SeccionLista({ titulo, icono, items, onAgregar, onEliminar, campo, placeholder }) {
  const [nuevo, setNuevo] = useState('');
  return (
    <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 24, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>{icono} {titulo}</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (nuevo.trim()) { onAgregar(nuevo.trim()); setNuevo(''); } } }} />
        <button onClick={() => { if (nuevo.trim()) { onAgregar(nuevo.trim()); setNuevo(''); } }} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2c2c2e', borderRadius: 8, padding: '10px 14px' }}>
            <span style={{ fontSize: 14 }}>{item[campo] || item.nombre}</span>
            <button onClick={() => onEliminar(item.id)} style={{ background: 'none', border: 'none', color: '#ff3b30', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        {items.length === 0 && <p style={{ color: '#86868b', fontSize: 13 }}>No hay {titulo.toLowerCase()} cargados</p>}
      </div>
    </div>
  );
}

export default function Configuracion() {
  const { negocioId, negocio } = useAuth();
  const base = ['negocios', negocioId];

  const [puntosVenta, setPuntosVenta] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [origenes, setOrigenes] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [tipoCambio, setTipoCambio] = useState('');
  const [savingTC, setSavingTC] = useState(false);

  const [nombreNegocio, setNombreNegocio] = useState('');
  const [savingNegocio, setSavingNegocio] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (negocio) {
      setNombreNegocio(negocio.nombre || '');
      setLogoPreview(negocio.logoUrl || null);
    }
  }, [negocio]);

  const cargar = async () => {
    if (!negocioId) return;
    const [pvSnap, vSnap, pSnap, cfgSnap] = await Promise.all([
      getDocs(collection(db, ...base, 'puntosVenta')),
      getDocs(collection(db, ...base, 'vendedores')),
      getDocs(collection(db, ...base, 'proveedores')),
      getDoc(doc(db, ...base, 'config', 'general')),
    ]);
    setPuntosVenta(pvSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setVendedores(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setProveedores(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const cfg = cfgSnap.data() || {};
    setTipoCambio(cfg.tipoCambio || '');
    setOrigenes((cfg.origenes || []).map((o, i) => ({ id: i, nombre: o })));
    const modelosDefault = ['iPhone 12','iPhone 12 Pro','iPhone 12 Pro Max','iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 14','iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max'];
    setModelos((cfg.modelos || modelosDefault).map((m, i) => ({ id: i, nombre: m })));
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const agregar = (coleccion) => async (nombre) => {
    await addDoc(collection(db, ...base, coleccion), { nombre });
    cargar();
  };

  const eliminar = (coleccion) => async (id) => {
    await deleteDoc(doc(db, ...base, coleccion, id));
    cargar();
  };

  const guardarNegocio = async () => {
    if (!nombreNegocio.trim()) return;
    setSavingNegocio(true);
    await updateDoc(doc(db, 'negocios', negocioId), { nombre: nombreNegocio.trim() });
    setSavingNegocio(false);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const storageRef = ref(storage, `logos/${negocioId}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'negocios', negocioId), { logoUrl: url });
      setLogoPreview(url);
    } catch (err) {
      alert('Error al subir el logo. Verificá que Firebase Storage esté activado.');
      console.error(err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const guardarTC = async () => {
    setSavingTC(true);
    await setDoc(doc(db, ...base, 'config', 'general'), { tipoCambio: Number(tipoCambio) }, { merge: true });
    setSavingTC(false);
  };

  const agregarEnConfig = (campo) => async (nombre) => {
    const snap = await getDoc(doc(db, ...base, 'config', 'general'));
    const actuales = snap.data()?.[campo] || [];
    await setDoc(doc(db, ...base, 'config', 'general'), { [campo]: [...actuales, nombre] }, { merge: true });
    cargar();
  };

  const eliminarDeConfig = (campo, items, setItems) => async (id) => {
    const nuevos = items.filter(o => o.id !== id).map(o => o.nombre);
    await setDoc(doc(db, ...base, 'config', 'general'), { [campo]: nuevos }, { merge: true });
    cargar();
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>⚙️ Configuración</h1>

      {/* Sección Mi Negocio */}
      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>🏪 Mi Negocio</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 96, height: 96, borderRadius: 16,
                background: '#2c2c2e', border: '2px dashed #3a3a3c',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
              }}
            >
              {logoPreview
                ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 32 }}>🏪</span>
              }
              {uploadingLogo && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff'
                }}>Subiendo...</div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              style={{ background: 'none', border: '1px solid #3a3a3c', borderRadius: 8, padding: '6px 14px', color: '#86868b', fontSize: 12, cursor: 'pointer' }}
            >
              {uploadingLogo ? 'Subiendo...' : 'Cambiar logo'}
            </button>
            <span style={{ color: '#86868b', fontSize: 11 }}>PNG, JPG · máx 2MB</span>
          </div>

          {/* Nombre */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>NOMBRE DEL NEGOCIO</label>
            <input
              value={nombreNegocio}
              onChange={e => setNombreNegocio(e.target.value)}
              placeholder="Ej: iPhone Caleta"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <button
              onClick={guardarNegocio}
              disabled={savingNegocio || !nombreNegocio.trim()}
              style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', opacity: savingNegocio ? 0.7 : 1 }}
            >
              {savingNegocio ? 'Guardando...' : 'Guardar nombre'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>💵 Tipo de cambio (ARS por USD)</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: 300 }}>
          <input type="number" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} placeholder="1430" style={inputStyle} />
          <button onClick={guardarTC} disabled={savingTC} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {savingTC ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <SeccionLista titulo="Puntos de venta" icono="📍" items={puntosVenta} onAgregar={agregar('puntosVenta')} onEliminar={eliminar('puntosVenta')} campo="nombre" placeholder="Ej: Local Caleta, Instagram..." />
      <SeccionLista titulo="Vendedores" icono="👤" items={vendedores} onAgregar={agregar('vendedores')} onEliminar={eliminar('vendedores')} campo="nombre" placeholder="Nombre del vendedor..." />
      <SeccionLista titulo="Proveedores" icono="🏭" items={proveedores} onAgregar={agregar('proveedores')} onEliminar={eliminar('proveedores')} campo="nombre" placeholder="Nombre del proveedor..." />
      <SeccionLista titulo="Orígenes de venta" icono="📣" items={origenes} onAgregar={agregarEnConfig('origenes')} onEliminar={eliminarDeConfig('origenes', origenes, setOrigenes)} campo="nombre" placeholder="Ej: Instagram, WhatsApp..." />
      <SeccionLista titulo="Modelos de iPhone" icono="📱" items={modelos} onAgregar={agregarEnConfig('modelos')} onEliminar={eliminarDeConfig('modelos', modelos, setModelos)} campo="nombre" placeholder="Ej: iPhone 18 Pro..." />
    </div>
  );
}

