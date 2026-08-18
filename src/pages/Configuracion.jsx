import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconGear, IconBox, IconCoin, IconArrowSwap, IconX, IconPin, IconUser, IconTruck, IconBell, IconTrendUp, IconTag, IconWallet } from '../components/Icons';
import { CATEGORIAS_INGRESO as CATEGORIAS_INGRESO_DEFAULT, CATEGORIAS_EGRESO as CATEGORIAS_EGRESO_DEFAULT } from '../lib/caja';
import { CATEGORIAS_STOCK, MODELOS_DEFAULT_POR_CATEGORIA } from '../lib/categoriasProducto';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

// Panel modal genérico que envuelve el contenido de cada tile de configuración —
// el título/ícono/cerrar es siempre igual, solo cambia lo de adentro.
function ModalSeccion({ titulo, Icono, onClose, children, ancho = 560 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: ancho, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}><Icono size={17} style={{ color: 'var(--rv-accent)' }} />{titulo}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Tile cuadrado del panel principal.
function Tile({ Icono, label, contador, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16,
      aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, cursor: 'pointer', padding: 12, textAlign: 'center',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--rv-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icono size={20} style={{ color: 'var(--rv-accent)' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rv-text)', lineHeight: 1.2 }}>{label}</span>
      {contador != null && <span style={{ fontSize: 10, color: 'var(--rv-text-dim)' }}>{contador}</span>}
    </button>
  );
}

function SeccionLista({ titulo, items, onAgregar, onEliminar, placeholder }) {
  const [nuevo, setNuevo] = useState('');
  return (
    <div>
      {titulo && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>{titulo}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (nuevo.trim()) { onAgregar(nuevo.trim()); setNuevo(''); } } }} />
        <button onClick={() => { if (nuevo.trim()) { onAgregar(nuevo.trim()); setNuevo(''); } }} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px' }}>
            <span style={{ fontSize: 14 }}>{item.nombre}</span>
            <button onClick={() => onEliminar(item.id)} style={{ background: 'none', border: 'none', color: 'var(--rv-danger)', cursor: 'pointer', display: 'flex' }}><IconX size={15} /></button>
          </div>
        ))}
        {items.length === 0 && <p style={{ color: 'var(--rv-text-dim)', fontSize: 13 }}>Nada cargado todavía</p>}
      </div>
    </div>
  );
}

export default function Configuracion() {
  const { negocioId, negocio } = useAuth();
  const base = ['negocios', negocioId];

  const [seccionAbierta, setSeccionAbierta] = useState(null);

  const [puntosVenta, setPuntosVenta] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [origenes, setOrigenes] = useState([]);
  const [modelosPorCategoria, setModelosPorCategoria] = useState({});
  const [categoriaModelos, setCategoriaModelos] = useState('iPhone');
  const [listaCanje, setListaCanje] = useState([]);
  const [categoriasIngreso, setCategoriasIngreso] = useState([]);
  const [categoriasEgreso, setCategoriasEgreso] = useState([]);
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
    // Legacy: antes había una sola lista plana `modelos` (todos iPhone). Si ya existe
    // la nueva `modelosPorCategoria` se usa esa; si no, se migra la vieja a iPhone.
    const porCategoria = cfg.modelosPorCategoria || {};
    const nuevoEstado = {};
    CATEGORIAS_STOCK.forEach(cat => {
      const lista = porCategoria[cat] || (cat === 'iPhone' ? cfg.modelos : null) || MODELOS_DEFAULT_POR_CATEGORIA[cat] || [];
      nuevoEstado[cat] = lista.map((m, i) => ({ id: i, nombre: m }));
    });
    setModelosPorCategoria(nuevoEstado);
    setListaCanje((cfg.listaCanje || []).map((c, i) => ({ id: i, ...c })));
    setCategoriasIngreso((cfg.categoriasIngreso || CATEGORIAS_INGRESO_DEFAULT).map((c, i) => ({ id: i, nombre: c })));
    setCategoriasEgreso((cfg.categoriasEgreso || CATEGORIAS_EGRESO_DEFAULT).map((c, i) => ({ id: i, nombre: c })));
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

  const eliminarDeConfig = (campo, items) => async (id) => {
    const nuevos = items.filter(o => o.id !== id).map(o => o.nombre);
    await setDoc(doc(db, ...base, 'config', 'general'), { [campo]: nuevos }, { merge: true });
    cargar();
  };

  const agregarModelo = (categoria) => async (nombre) => {
    const snap = await getDoc(doc(db, ...base, 'config', 'general'));
    const actuales = snap.data()?.modelosPorCategoria || {};
    const listaActual = actuales[categoria] || modelosPorCategoria[categoria]?.map(m => m.nombre) || [];
    await setDoc(doc(db, ...base, 'config', 'general'), {
      modelosPorCategoria: { ...actuales, [categoria]: [...listaActual, nombre] },
    }, { merge: true });
    cargar();
  };

  const eliminarModelo = (categoria, items) => async (id) => {
    const snap = await getDoc(doc(db, ...base, 'config', 'general'));
    const actuales = snap.data()?.modelosPorCategoria || {};
    const nuevos = items.filter(m => m.id !== id).map(m => m.nombre);
    await setDoc(doc(db, ...base, 'config', 'general'), {
      modelosPorCategoria: { ...actuales, [categoria]: nuevos },
    }, { merge: true });
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

  const TILES = [
    { key: 'negocio', label: 'Mi Negocio', Icono: IconBox },
    { key: 'tipoCambio', label: 'Tipo de cambio', Icono: IconCoin, contador: tipoCambio ? `$${tipoCambio}` : null },
    { key: 'puntosVenta', label: 'Puntos de venta', Icono: IconPin, contador: puntosVenta.length },
    { key: 'vendedores', label: 'Vendedores', Icono: IconUser, contador: vendedores.length },
    { key: 'proveedores', label: 'Proveedores', Icono: IconTruck, contador: proveedores.length },
    { key: 'origenes', label: 'Orígenes de venta', Icono: IconBell, contador: origenes.length },
    { key: 'modelos', label: 'Modelos', Icono: IconTag, contador: Object.values(modelosPorCategoria).reduce((s, l) => s + l.length, 0) },
    { key: 'canje', label: 'Plan Canje', Icono: IconArrowSwap, contador: listaCanje.length },
    { key: 'categoriasCaja', label: 'Categorías de Caja', Icono: IconWallet, contador: categoriasIngreso.length + categoriasEgreso.length },
  ];

  const cerrar = () => setSeccionAbierta(null);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}><IconGear size={22} style={{ color: 'var(--rv-accent)' }} />Configuración</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 14 }}>
        {TILES.map(t => (
          <Tile key={t.key} Icono={t.Icono} label={t.label} contador={t.contador} onClick={() => setSeccionAbierta(t.key)} />
        ))}
      </div>

      {seccionAbierta === 'negocio' && (
        <ModalSeccion titulo="Mi Negocio" Icono={IconBox} onClose={cerrar}>
          <label style={labelStyle}>NOMBRE DEL NEGOCIO</label>
          <input value={nombreNegocio} onChange={e => setNombreNegocio(e.target.value)} placeholder="Ej: iPhone Caleta" style={{ ...inputStyle, marginBottom: 12 }} />
          <label style={labelStyle}>WHATSAPP DE CONTACTO (para el catálogo público)</label>
          <input type="tel" value={telefonoNegocio} onChange={e => setTelefonoNegocio(e.target.value)} placeholder="Ej: 11 2345-6789" style={{ ...inputStyle, marginBottom: 16 }} />
          <button onClick={guardarNegocio} disabled={savingNegocio || !nombreNegocio.trim()} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', opacity: savingNegocio ? 0.7 : 1 }}>
            {savingNegocio ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </ModalSeccion>
      )}

      {seccionAbierta === 'tipoCambio' && (
        <ModalSeccion titulo="Tipo de cambio (ARS por USD)" Icono={IconCoin} onClose={cerrar}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 180 }}>
              <label style={labelStyle}>TIPO DE DÓLAR</label>
              <select value={tipoDolar} onChange={e => { setTipoDolar(e.target.value); if (e.target.value !== 'manual') fetchDolar(e.target.value); }} style={inputStyle}>
                {TIPOS_DOLAR.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <label style={labelStyle}>COTIZACIÓN ACTUAL</label>
              <input
                type="number" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} placeholder="1430"
                readOnly={tipoDolar !== 'manual'}
                style={{ ...inputStyle, color: tipoDolar !== 'manual' ? 'var(--rv-accent)' : 'var(--rv-text)', cursor: tipoDolar !== 'manual' ? 'default' : 'text' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {tipoDolar !== 'manual' && (
                <button onClick={() => fetchDolar(tipoDolar)} disabled={fetchingDolar} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: fetchingDolar ? 0.7 : 1 }}>
                  {fetchingDolar ? 'Actualizando...' : <><IconTrendUp size={13} style={{ marginRight: 6 }} />Actualizar</>}
                </button>
              )}
              {tipoDolar === 'manual' && (
                <button onClick={guardarTC} disabled={savingTC} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {savingTC ? 'Guardando...' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
          {ultimaActualizacion && tipoDolar !== 'manual' && (
            <p style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 10, marginBottom: 0 }}>
              Última actualización: {new Date(ultimaActualizacion).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
              {tipoCambio && <span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginLeft: 8 }}>${Number(tipoCambio).toLocaleString('es-AR')}</span>}
            </p>
          )}
        </ModalSeccion>
      )}

      {seccionAbierta === 'puntosVenta' && (
        <ModalSeccion titulo="Puntos de venta" Icono={IconPin} onClose={cerrar}>
          <SeccionLista items={puntosVenta} onAgregar={agregar('puntosVenta')} onEliminar={eliminar('puntosVenta')} placeholder="Ej: Local Caleta, Instagram..." />
        </ModalSeccion>
      )}

      {seccionAbierta === 'vendedores' && (
        <ModalSeccion titulo="Vendedores" Icono={IconUser} onClose={cerrar}>
          <SeccionLista items={vendedores} onAgregar={agregar('vendedores')} onEliminar={eliminar('vendedores')} placeholder="Nombre del vendedor..." />
        </ModalSeccion>
      )}

      {seccionAbierta === 'proveedores' && (
        <ModalSeccion titulo="Proveedores" Icono={IconTruck} onClose={cerrar}>
          <SeccionLista items={proveedores} onAgregar={agregar('proveedores')} onEliminar={eliminar('proveedores')} placeholder="Nombre del proveedor..." />
        </ModalSeccion>
      )}

      {seccionAbierta === 'origenes' && (
        <ModalSeccion titulo="Orígenes de venta" Icono={IconBell} onClose={cerrar}>
          <SeccionLista items={origenes} onAgregar={agregarEnConfig('origenes')} onEliminar={eliminarDeConfig('origenes', origenes)} placeholder="Ej: Instagram, WhatsApp..." />
        </ModalSeccion>
      )}

      {seccionAbierta === 'modelos' && (
        <ModalSeccion titulo="Modelos" Icono={IconTag} onClose={cerrar}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {CATEGORIAS_STOCK.map(cat => (
              <button key={cat} onClick={() => setCategoriaModelos(cat)} style={{
                background: categoriaModelos === cat ? 'var(--rv-accent)' : 'var(--rv-surface-alt)',
                color: categoriaModelos === cat ? '#fff' : 'var(--rv-text-mid)',
                border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{cat}</button>
            ))}
          </div>
          <SeccionLista
            items={modelosPorCategoria[categoriaModelos] || []}
            onAgregar={agregarModelo(categoriaModelos)}
            onEliminar={eliminarModelo(categoriaModelos, modelosPorCategoria[categoriaModelos] || [])}
            placeholder={`Ej: ${categoriaModelos === 'iPhone' ? 'iPhone 18 Pro' : categoriaModelos === 'Mac' ? 'MacBook Pro 14" M5' : categoriaModelos === 'iPad' ? 'iPad Pro 13" M5' : categoriaModelos === 'Android' ? 'Samsung Galaxy S26' : 'DJI Mini 5'}...`}
          />
        </ModalSeccion>
      )}

      {seccionAbierta === 'canje' && (
        <ModalSeccion titulo="Plan Canje" Icono={IconArrowSwap} onClose={cerrar}>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 16 }}>
            Cuánto tomás cada modelo como parte de pago. Tus clientes lo van a ver en el catálogo público para calcular cuánto les falta pagar.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <select value={nuevoCanje.modelo} onChange={e => setNuevoCanje({ ...nuevoCanje, modelo: e.target.value })} style={{ ...inputStyle, flex: '2 1 160px' }}>
              <option value="">Modelo...</option>
              {CATEGORIAS_STOCK.map(cat => (
                <optgroup key={cat} label={cat}>
                  {(modelosPorCategoria[cat] || []).map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                </optgroup>
              ))}
            </select>
            <input value={nuevoCanje.gb} onChange={e => setNuevoCanje({ ...nuevoCanje, gb: e.target.value })} placeholder="GB" style={{ ...inputStyle, flex: '1 1 70px' }} />
            <input type="number" value={nuevoCanje.valorUsd} onChange={e => setNuevoCanje({ ...nuevoCanje, valorUsd: e.target.value })} placeholder="Toma USD" style={{ ...inputStyle, flex: '1 1 100px' }} />
            <button onClick={agregarCanje} disabled={guardandoCanje} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {listaCanje.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 14 }}>{c.modelo}{c.gb ? ` ${/^\d+$/.test(String(c.gb).trim()) ? c.gb + 'GB' : c.gb}` : ''} — toma USD {c.valorUsd}</span>
                <button onClick={() => eliminarCanje(c.id)} style={{ background: 'none', border: 'none', color: 'var(--rv-danger)', cursor: 'pointer', display: 'flex' }}><IconX size={15} /></button>
              </div>
            ))}
            {listaCanje.length === 0 && <p style={{ color: 'var(--rv-text-dim)', fontSize: 13 }}>Todavía no cargaste ningún valor de toma</p>}
          </div>
        </ModalSeccion>
      )}

      {seccionAbierta === 'categoriasCaja' && (
        <ModalSeccion titulo="Categorías de Caja" Icono={IconWallet} onClose={cerrar} ancho={640}>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 20 }}>
            Estas son las categorías que aparecen para elegir al cargar un movimiento manual en Caja. Los movimientos automáticos (Venta, Cobro de cuota, Reparación, Pago a proveedor) ya tienen la suya asignada sola.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            <SeccionLista titulo="Ingresos" items={categoriasIngreso} onAgregar={agregarEnConfig('categoriasIngreso')} onEliminar={eliminarDeConfig('categoriasIngreso', categoriasIngreso)} placeholder="Ej: Alquiler cobrado..." />
            <SeccionLista titulo="Egresos" items={categoriasEgreso} onAgregar={agregarEnConfig('categoriasEgreso')} onEliminar={eliminarDeConfig('categoriasEgreso', categoriasEgreso)} placeholder="Ej: Insumos..." />
          </div>
        </ModalSeccion>
      )}
    </div>
  );
}
