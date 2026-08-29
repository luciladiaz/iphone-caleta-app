import { useState } from 'react';
import { CardNumber, SecurityCode, ExpirationDate, createCardToken } from '@mercadopago/sdk-react';
import { IconLock } from './Icons';

const TIPOS_DOC = ['DNI', 'CI', 'LC', 'LE', 'Pasaporte'];

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };
// Los Secure Fields son iframes que Mercado Pago mete adentro de este div. Sin un
// tamaño explícito (acá y en el `style` que se les pasa más abajo) el iframe puede
// renderizar más grande que la caja y quedar tapando visualmente los campos de abajo —
// aunque se "vea" bien, los clics/foco terminan yendo al campo equivocado. overflow:
// hidden + position: relative fuerza que quede contenido exactamente en su caja.
const secureFieldBox = {
  padding: '0 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)',
  borderRadius: 8, height: 42, boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
  display: 'flex', alignItems: 'center', width: '100%',
};

// Los Secure Fields (CardNumber/SecurityCode/ExpirationDate) renderizan en iframes de
// Mercado Pago — no heredan las variables CSS de esta página (son otro origen), así que
// el color hay que pasárselo ya resuelto, no como var(--rv-text).
function colorResuelto(variable, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v || fallback;
}

// Formulario de tarjeta propio (no redirige a Mercado Pago): tokeniza la tarjeta acá
// mismo con el SDK oficial y solo manda el token resultante al backend — el número de
// tarjeta viaja encriptado directo a Mercado Pago, nunca toca nuestros servidores.
export default function FormularioTarjetaMP({ onToken, onCancelar, procesando, error }) {
  const [nombre, setNombre] = useState('');
  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [numeroDoc, setNumeroDoc] = useState('');
  const [tokenizando, setTokenizando] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');

  // width/height explícitos: sin esto el iframe interno puede tomar un tamaño propio
  // que no coincide con secureFieldBox y termina desbordándose sobre los campos vecinos.
  const secureFieldStyle = {
    color: colorResuelto('--rv-text', '#16202f'),
    fontSize: '14px',
    fontFamily: 'Manrope, sans-serif',
    placeholderColor: colorResuelto('--rv-text-dim', '#6b7686'),
    height: '20px',
    width: '100%',
  };

  const ocupado = tokenizando || procesando;

  const submit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !numeroDoc.trim()) {
      setErrorLocal('Completá el nombre y el documento del titular de la tarjeta.');
      return;
    }
    setErrorLocal('');
    setTokenizando(true);
    try {
      const resultado = await createCardToken({
        cardholderName: nombre.trim(),
        identificationType: tipoDoc,
        identificationNumber: numeroDoc.trim(),
      });
      if (!resultado?.id) throw new Error('No pudimos procesar la tarjeta. Revisá los datos e intentá de nuevo.');
      await onToken(resultado.id);
    } catch (err) {
      setErrorLocal(err.message || 'No pudimos procesar la tarjeta. Revisá los datos e intentá de nuevo.');
    } finally {
      setTokenizando(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Número de tarjeta</label>
        <div style={secureFieldBox}><CardNumber placeholder="0000 0000 0000 0000" style={secureFieldStyle} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Vencimiento</label>
          <div style={secureFieldBox}><ExpirationDate placeholder="MM/AA" style={secureFieldStyle} /></div>
        </div>
        <div>
          <label style={labelStyle}>Código de seguridad</label>
          <div style={secureFieldBox}><SecurityCode placeholder="CVV" style={secureFieldStyle} /></div>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Nombre del titular (como figura en la tarjeta)</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Pérez" style={inputStyle} required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Tipo doc.</label>
          <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} style={inputStyle}>
            {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>N° de documento del titular</label>
          <input value={numeroDoc} onChange={e => setNumeroDoc(e.target.value)} placeholder="30123456" style={inputStyle} required />
        </div>
      </div>

      {(errorLocal || error) && (
        <div style={{ background: 'var(--rv-danger-soft)', color: 'var(--rv-danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          {errorLocal || error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--rv-text-dim)', fontSize: 11.5 }}>
        <IconLock size={12} /> Tus datos de tarjeta viajan encriptados directo a Mercado Pago, nunca pasan por nuestros servidores.
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancelar} disabled={ocupado} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button type="submit" disabled={ocupado} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: ocupado ? 0.7 : 1 }}>
          {ocupado ? 'Procesando...' : 'Confirmar suscripción'}
        </button>
      </div>
    </form>
  );
}
