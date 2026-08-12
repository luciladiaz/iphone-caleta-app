import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

function SeccionLista({ titulo, icono, items, onAgregar, onEliminar, campo, placeholder }) {
  const [nuevo, setNuevo] = useState('');
  return (
    <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>{icono} {titulo}</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (nuevo.trim()) { onAgregar(nuevo.trim()); setNuevo(''); } } }} />
        <button onClick={() => { if (nuevo.trim()) { onAgregar(nuevo.trim()); setNuevo(''); } }} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px' }}>
            <span style={{ fontSize: 14 }}>{item[campo] || item.nombre}</span>
            <button onClick={() => onEliminar(item.id)} style={{ background: 'none', border: 'none', color: 'var(--rv-danger)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        {items.length === 0 && <p style={{ color: 'var(--rv-text-dim)', fontSize: 13 }}>No hay {titulo.toLowerCase()} cargados</p>}
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
  const [listaCanje, setListaCanje] = useState([]);
  const [nuevoCanje, setNuevoCanje] = useState({ modelo: '', gb: '', valorUsd: '' });
  const [guardandoCanje, setGuardandoCanje] = useState(false);
  const [tipoCambio, setTipoCambio] = useState('');
  const [tipoDolar, setTipoDolar] = useState('blue');
  const [savingTC, setSavingTC] = useState(false);
  const [fetchingDolar, setFetchingDolar] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const [nombreNegocio, setNombreNegocio] = useState('');
  const [telefonoNegocio, setTelefonoNegocio] = useState('');
  const [savingNegocio, setSavingNegocio] = useState(false);

  useEffect(() => {
    if (negocio) {
      setNombreNegocio(negocio.nombre || '');
      setTelefonoNegocio(negocio.telefono || '');
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
    setTipoDolar(cfg.tipoDolar || 'blue');
    setUltimaActualizacion(cfg.ultimaActualizacionTC || null);
    setOrigenes((cfg.origenes || []).map((o, i) => ({ id: i, nombre: o })));
    const modelosDefault = ['iPhone 12','iPhone 12 Pro','iPhone 12 Pro Max','iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 14','iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max'];
    setModelos((cfg.modelos || modelosDefault).map((m, i) => ({ id: i, nombre: m })));
    setListaCanje((cfg.listaCanje || []).map((c, i) => ({ id: i, ...c })));
  };

  useEffect(() => { cargar(); }, [negocioId]);

  // Listener en tiempo real para el tipo de cambio y última actualización
  useEffect(() => {
    if (!negocioId) return;
    const unsub = onSnapshot(doc(db, ...base, 'config', 'general'), (snap) => {
      const cfg = snap.data() || {};
      if (cfg.tipoCambio !== undefined) setTipoCambio(String(cfg.tipoCambio));
      if (cfg.tipoDolar) setTipoDolar(cfg.tipoDolar);
      if (cfg.ultimaActualizacionTC) setUltimaActualizacion(cfg.ultimaActualizacionTC);
    });
    return () => unsub();
  }, [negocioId]);

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
    await updateDoc(doc(db, 'negocios', negocioId), { nombre: nombreNegocio.trim(), telefono: telefonoNegocio.trim() });
    // Mirror al doc público que lee el catálogo compartible (nombre + teléfono, nunca plan/pagos internos)
    await setDoc(doc(db, 'negocios', negocioId, 'publico', 'info'), {
      nombre: nombreNegocio.trim(),
      telefono: telefonoNegocio.trim(),
    }, { merge: true });
    setSavingNegocio(false);
  };

  const TIPOS_DOLAR = [
    { value: 'blue',    label: 'Dólar Blue' },
    { value: 'oficial', label: 'Dólar Oficial' },
    { value: 'mep',     label: 'Dólar MEP' },
    { value: 'manual',  label: 'Manual' },
  ];

  const fetchDolar = async (tipo) => {
    if (tipo === 'manual') return;
    setFetchingDolar(true);
    try {
      const res = await fetch(`/api/cotizacion-dolar?tipo=${tipo}`);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Respuesta inválida: ${text.substring(0, 80)}`); }
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (!data.venta) throw new Error('La API no devolvió cotización');
      const venta = data.venta;
      const ahora = new Date().toISOString();
      setTipoCambio(String(venta));
      setUltimaActualizacion(ahora);
      await setDoc(doc(db, ...base, 'config', 'general'), {
        tipoCambio: venta,
        tipoDolar: tipo,
        ultimaActualizacionTC: ahora,
      }, { merge: true });
    } catch (err) {
      alert(`No se pudo obtener la cotización: ${err.message}`);
    } finally {
      setFetchingDolar(false);
    }
  };

  const guardarTC = async () => {
    setSavingTC(true);
    await setDoc(doc(db, ...base, 'config', 'general'), {
      tipoCambio: Number(tipoCambio),
      tipoDolar,
      ultimaActualizacionTC: new Date().toISOString(),
    }, { merge: true });
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

  const agregarCanje = async () => {
    if (!nuevoCanje.modelo || !nuevoCanje.valorUsd) return;
    setGuardandoCanje(true);
    const snap = await getDoc(doc(db, ...base, 'config', 'general'));
    const actuales = snap.data()?.listaCanje || [];
    await setDoc(doc(db, ...base, 'config', 'general'), {
      listaCanje: [...actuales, { modelo: nuevoCanje.modelo, gb: nuevoCanje.gb, valorUsd: Number(nuevoCanje.valorUsd) }],
    }, { merge: true });
    setNuevoCanje({ modelo: '', gb: '', valorUsd: '' });
    setGuardandoCanje(false);
    cargar();
  };

  const eliminarCanje = async (id) => {
    const nuevos = listaCanje.filter(c => c.id !== id).map(({ modelo, gb, valorUsd }) => ({ modelo, gb, valorUsd }));
    await setDoc(doc(db, ...base, 'config', 'general'), { listaCanje: nuevos }, { merge: true });
    cargar();
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>⚙️ Configuración</h1>

      {/* Sección Mi Negocio */}
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>🏪 Mi Negocio</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Nombre y WhatsApp */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>NOMBRE DEL NEGOCIO</label>
            <input
              value={nombreNegocio}
              onChange={e => setNombreNegocio(e.target.value)}
              placeholder="Ej: iPhone Caleta"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <label style={labelStyle}>WHATSAPP DE CONTACTO (para el catálogo público)</label>
            <input
              type="tel"
              value={telefonoNegocio}
              onChange={e => setTelefonoNegocio(e.target.value)}
              placeholder="Ej: 11 2345-6789"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <button
              onClick={guardarNegocio}
              disabled={savingNegocio || !nombreNegocio.trim()}
              style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', opacity: savingNegocio ? 0.7 : 1 }}
            >
              {savingNegocio ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>💵 Tipo de cambio (ARS por USD)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>

          {/* Selector de tipo de dólar */}
          <div style={{ minWidth: 180 }}>
            <label style={labelStyle}>TIPO DE DÓLAR</label>
            <select
              value={tipoDolar}
              onChange={e => { setTipoDolar(e.target.value); if (e.target.value !== 'manual') fetchDolar(e.target.value); }}
              style={inputStyle}
            >
              {TIPOS_DOLAR.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Valor actual */}
          <div style={{ minWidth: 140 }}>
            <label style={labelStyle}>COTIZACIÓN ACTUAL</label>
            <input
              type="number"
              value={tipoCambio}
              onChange={e => setTipoCambio(e.target.value)}
              placeholder="1430"
              readOnly={tipoDolar !== 'manual'}
              style={{ ...inputStyle, color: tipoDolar !== 'manual' ? 'var(--rv-accent)' : 'var(--rv-text)', cursor: tipoDolar !== 'manual' ? 'default' : 'text' }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 8 }}>
            {tipoDolar !== 'manual' && (
              <button
                onClick={() => fetchDolar(tipoDolar)}
                disabled={fetchingDolar}
                style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: fetchingDolar ? 0.7 : 1 }}
              >
                {fetchingDolar ? 'Actualizando...' : '🔄 Actualizar'}
              </button>
            )}
            {tipoDolar === 'manual' && (
              <button onClick={guardarTC} disabled={savingTC} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {savingTC ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>
        </div>

        {/* Última actualización */}
        {ultimaActualizacion && tipoDolar !== 'manual' && (
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            Última actualización: {new Date(ultimaActualizacion).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
            {tipoCambio && <span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginLeft: 8 }}>${Number(tipoCambio).toLocaleString('es-AR')}</span>}
          </p>
        )}
      </div>

      <SeccionLista titulo="Puntos de venta" icono="📍" items={puntosVenta} onAgregar={agregar('puntosVenta')} onEliminar={eliminar('puntosVenta')} campo="nombre" placeholder="Ej: Local Caleta, Instagram..." />
      <SeccionLista titulo="Vendedores" icono="👤" items={vendedores} onAgregar={agregar('vendedores')} onEliminar={eliminar('vendedores')} campo="nombre" placeholder="Nombre del vendedor..." />
      <SeccionLista titulo="Proveedores" icono="🏭" items={proveedores} onAgregar={agregar('proveedores')} onEliminar={eliminar('proveedores')} campo="nombre" placeholder="Nombre del proveedor..." />
      <SeccionLista titulo="Orígenes de venta" icono="📣" items={origenes} onAgregar={agregarEnConfig('origenes')} onEliminar={eliminarDeConfig('origenes', origenes, setOrigenes)} campo="nombre" placeholder="Ej: Instagram, WhatsApp..." />
      <SeccionLista titulo="Modelos de iPhone" icono="📱" items={modelos} onAgregar={agregarEnConfig('modelos')} onEliminar={eliminarDeConfig('modelos', modelos, setModelos)} campo="nombre" placeholder="Ej: iPhone 18 Pro..." />

      {/* Plan Canje */}
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>💱 Plan Canje</h3>
        <p style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 16 }}>
          Cuánto tomás cada modelo como parte de pago. Tus clientes lo van a ver en el catálogo público para calcular cuánto les falta pagar.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <select value={nuevoCanje.modelo} onChange={e => setNuevoCanje({ ...nuevoCanje, modelo: e.target.value })} style={{ ...inputStyle, flex: '2 1 160px' }}>
            <option value="">Modelo...</option>
            {modelos.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
          </select>
          <input value={nuevoCanje.gb} onChange={e => setNuevoCanje({ ...nuevoCanje, gb: e.target.value })} placeholder="GB" style={{ ...inputStyle, flex: '1 1 70px' }} />
          <input type="number" value={nuevoCanje.valorUsd} onChange={e => setNuevoCanje({ ...nuevoCanje, valorUsd: e.target.value })} placeholder="Toma USD" style={{ ...inputStyle, flex: '1 1 100px' }} />
          <button onClick={agregarCanje} disabled={guardandoCanje} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {listaCanje.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 14 }}>{c.modelo} {c.gb ? `${c.gb}GB` : ''} — toma USD {c.valorUsd}</span>
              <button onClick={() => eliminarCanje(c.id)} style={{ background: 'none', border: 'none', color: 'var(--rv-danger)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          {listaCanje.length === 0 && <p style={{ color: 'var(--rv-text-dim)', fontSize: 13 }}>Todavía no cargaste ningún valor de toma</p>}
        </div>
      </div>
    </div>
  );
}

