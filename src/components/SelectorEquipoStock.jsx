import { useState, useRef, useEffect } from 'react';
import { IconSearch, IconX, IconBox } from './Icons';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const formatCapacidad = (gb) => gb && /^\d+$/.test(String(gb).trim()) ? `${gb}GB` : gb;

// Combobox de equipo de stock reutilizable: busca por modelo, color o —sobre todo—
// IMEI/N° de serie, porque puede haber varias unidades idénticas (mismo modelo,
// misma capacidad, misma batería) que solo se distinguen por ese dato. Un <select>
// nativo no alcanza para eso.
export default function SelectorEquipoStock({ stock, equipoId, onSeleccionar, label = 'Equipo' }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const wrapRef = useRef(null);

  const seleccionado = stock.find(s => s.id === equipoId);

  useEffect(() => {
    const onClickFuera = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  const b = busqueda.trim().toLowerCase();
  const filtrados = stock.filter(s => {
    if (!b) return true;
    return `${s.categoria || ''} ${s.modelo || ''} ${s.color || ''} ${s.gb || ''} ${s.imei || ''} ${s.puntoVenta || ''}`.toLowerCase().includes(b);
  });

  const elegir = (s) => {
    onSeleccionar(s.id);
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
          <span style={{ color: seleccionado ? 'var(--rv-text)' : 'var(--rv-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seleccionado
              ? `${seleccionado.modelo}${seleccionado.gb ? ' · ' + formatCapacidad(seleccionado.gb) : ''} ${seleccionado.color || ''}${seleccionado.imei ? ` · IMEI ${seleccionado.imei}` : ''}`
              : 'Buscar por modelo, IMEI o N° de serie...'}
          </span>
          {seleccionado ? (
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
            placeholder="Escribí modelo, color o IMEI/serie..."
            style={inputStyle}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--rv-surface)',
            border: '1px solid var(--rv-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 50,
            maxHeight: 320, overflowY: 'auto',
          }}>
            {filtrados.map(s => (
              <div key={s.id} onClick={() => elegir(s)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--rv-border)', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {s.categoria && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase' }}>{s.categoria}</span>}
                  <span style={{ fontWeight: 600 }}>{s.modelo}{s.gb ? ` · ${formatCapacidad(s.gb)}` : ''} {s.color}</span>
                </div>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 11, marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.imei ? <span style={{ color: 'var(--rv-accent)', fontWeight: 600 }}>IMEI/serie {s.imei}</span> : <span style={{ color: 'var(--rv-danger)' }}>Sin IMEI/serie cargado</span>}
                  {s.bateria && <span>Bat {s.bateria}%</span>}
                  {s.puntoVenta && <span>{s.puntoVenta}</span>}
                </div>
              </div>
            ))}
            {filtrados.length === 0 && (
              <div style={{ padding: '16px 14px', color: 'var(--rv-text-dim)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconBox size={14} />Sin equipos disponibles que coincidan
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
