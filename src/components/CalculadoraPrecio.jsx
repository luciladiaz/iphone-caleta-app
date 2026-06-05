import { useState } from 'react';

const inputStyle = { width: '100%', padding: '12px 14px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' };

export default function CalculadoraPrecio({ tipoCambio: tcInicial, onClose }) {
  const [costo, setCosto] = useState('');
  const [pv, setPv] = useState('');
  const [tc, setTc] = useState(tcInicial || '');

  const costoN = Number(costo) || 0;
  const pvN = Number(pv) || 0;
  const tcN = Number(tc) || 1;

  const gananciaUSD = pvN - costoN;
  const gananciaARS = gananciaUSD * tcN;
  const margen = pvN > 0 ? (gananciaUSD / pvN) * 100 : 0;
  const pvARS = pvN * tcN;

  const semaforo = margen < 10 ? { color: '#ff3b30', bg: 'rgba(255,59,48,0.1)', label: 'Muy ajustado', icon: '🔴' }
    : margen < 20 ? { color: '#ff9f0a', bg: 'rgba(255,159,10,0.1)', label: 'Rentable', icon: '🟡' }
    : { color: '#30d158', bg: 'rgba(48,209,88,0.1)', label: 'Excelente', icon: '🟢' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🧮 Calculadora</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>Precio de compra (USD)</label>
            <input type="number" value={costo} onChange={e => setCosto(e.target.value)} placeholder="400" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Precio de venta deseado (USD)</label>
            <input type="number" value={pv} onChange={e => setPv(e.target.value)} placeholder="500" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Tipo de cambio (ARS por USD)</label>
            <input type="number" value={tc} onChange={e => setTc(e.target.value)} placeholder={tcInicial || '1430'} style={inputStyle} />
          </div>
        </div>

        {costoN > 0 && pvN > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: semaforo.bg, border: `1px solid ${semaforo.color}44`, borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: semaforo.color, fontWeight: 700, fontSize: 15 }}>{semaforo.icon} {semaforo.label}</span>
              <span style={{ color: semaforo.color, fontWeight: 800, fontSize: 20 }}>{margen.toFixed(1)}%</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#2c2c2e', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ color: '#86868b', fontSize: 10, marginBottom: 4 }}>GANANCIA USD</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: gananciaUSD > 0 ? '#30d158' : '#ff3b30' }}>
                  {gananciaUSD > 0 ? '+' : ''}USD {gananciaUSD.toFixed(2)}
                </div>
              </div>
              <div style={{ background: '#2c2c2e', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ color: '#86868b', fontSize: 10, marginBottom: 4 }}>GANANCIA ARS</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: gananciaARS > 0 ? '#30d158' : '#ff3b30' }}>
                  ${gananciaARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div style={{ background: '#2c2c2e', borderRadius: 10, padding: '12px 14px', gridColumn: '1/-1' }}>
                <div style={{ color: '#86868b', fontSize: 10, marginBottom: 4 }}>PRECIO DE VENTA EN ARS</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#c9a96e' }}>
                  ${pvARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        )}

        {(!costoN || !pvN) && (
          <div style={{ textAlign: 'center', color: '#86868b', fontSize: 13, padding: '20px 0' }}>
            Ingresá el costo y el precio de venta para ver el análisis
          </div>
        )}
      </div>
    </div>
  );
}
