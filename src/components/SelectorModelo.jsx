import { useState, useRef, useEffect } from 'react';
import { IconSearch, IconX } from './Icons';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const VACIO = 'Universal / no aplica';

// Combobox de modelo reutilizable: busca por texto entre todos los modelos
// cargados (agrupados por categoría) en vez de un <select> gigante donde hay
// que scrollear a mano. También deja usar directamente lo que se escriba,
// por si el modelo puntual todavía no está en el catálogo.
export default function SelectorModelo({ categorias, modelosPorCategoria, value, onSeleccionar, label = 'Modelo compatible', permitirVacio = true }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClickFuera = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  const b = busqueda.trim().toLowerCase();
  const gruposFiltrados = categorias
    .map(cat => ({ cat, modelos: (modelosPorCategoria[cat] || []).filter(m => !b || m.toLowerCase().includes(b)) }))
    .filter(g => g.modelos.length > 0);
  const hayMatchExacto = categorias.some(cat => (modelosPorCategoria[cat] || []).some(m => m.toLowerCase() === b));

  const elegir = (m) => {
    onSeleccionar(m);
    setAbierto(false);
    setBusqueda('');
  };

  const quitar = (e) => {
    e.stopPropagation();
    onSeleccionar('');
    setBusqueda('');
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      {!abierto ? (
        <div onClick={() => setAbierto(true)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: value ? 'var(--rv-text)' : 'var(--rv-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value || (permitirVacio ? VACIO : 'Elegir...')}
          </span>
          {value ? (
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
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (busqueda.trim()) elegir(busqueda.trim()); } }}
            placeholder="Escribí para buscar un modelo..."
            style={inputStyle}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--rv-surface)',
            border: '1px solid var(--rv-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 50,
            maxHeight: 280, overflowY: 'auto',
          }}>
            {!b && permitirVacio && (
              <div onClick={() => elegir('')} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--rv-border)', fontSize: 13, color: 'var(--rv-text-dim)' }}>
                {VACIO}
              </div>
            )}
            {gruposFiltrados.map(g => (
              <div key={g.cat}>
                {categorias.length > 1 && (
                  <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase', background: 'var(--rv-surface-alt)' }}>{g.cat}</div>
                )}
                {g.modelos.map(m => (
                  <div key={m} onClick={() => elegir(m)} style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--rv-border)', fontSize: 13 }}>
                    {m}
                  </div>
                ))}
              </div>
            ))}
            {gruposFiltrados.length === 0 && b && (
              <div style={{ padding: '12px 14px', color: 'var(--rv-text-dim)', fontSize: 12 }}>Sin resultados en el catálogo</div>
            )}
            {b && !hayMatchExacto && (
              <div onClick={() => elegir(busqueda.trim())} style={{ padding: '10px 14px', cursor: 'pointer', color: 'var(--rv-accent)', fontSize: 13, fontWeight: 600 }}>
                Usar &quot;{busqueda.trim()}&quot;
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
