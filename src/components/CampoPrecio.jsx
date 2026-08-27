import { convertirMoneda } from '../lib/moneda';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };
const selectMonedaStyle = { ...inputStyle, width: 74, flex: 'none', padding: '10px 4px', textAlign: 'center' };

// Input de precio que se puede cargar en ARS o en USD, con la conversión a la
// otra moneda siempre calculada con el tipo de cambio de Configuración (nunca
// un valor fijo). El monto y la moneda elegidos se guardan tal cual los cargó
// el negocio (como ya se hacía con las formas de pago de Ventas); quien lo usa
// para cálculos convierte a la moneda que necesite con convertirMoneda().
export default function CampoPrecio({ label, monto, moneda, onChange, tipoCambio, placeholder }) {
  const tc = Number(tipoCambio) || 0;
  const equivalente = tc > 0 && Number(monto) > 0
    ? convertirMoneda(monto, moneda, moneda === 'ARS' ? 'USD' : 'ARS', tc)
    : 0;

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="number" min="0" value={monto}
          onChange={e => onChange({ monto: e.target.value, moneda })}
          placeholder={placeholder}
          style={inputStyle}
        />
        <select
          value={moneda}
          onChange={e => onChange({ monto, moneda: e.target.value })}
          style={selectMonedaStyle}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </div>
      {equivalente > 0 && (
        <div style={{ fontSize: 11, color: 'var(--rv-accent)', marginTop: 4 }}>
          {/* USD con 2 decimales: redondear a entero (toFixed(0)) hacía que cualquier
              monto chico en ARS (típico en accesorios, o un pago parcial) mostrara
              "≈ USD 0" — parecía que la conversión no funcionaba. */}
          ≈ {moneda === 'ARS' ? `USD ${equivalente.toFixed(2)}` : `$${equivalente.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`}
        </div>
      )}
      {tc === 0 && Number(monto) > 0 && (
        <div style={{ fontSize: 11, color: 'var(--rv-text-dim)', marginTop: 4 }}>
          Cargá el tipo de cambio en Configuración para ver el equivalente.
        </div>
      )}
    </div>
  );
}
