import { useState } from 'react';

export default function PlanCanjeModal({ equipo, listaCanje, tipoCambio, numeroWhatsapp, telefono, onClose }) {
  const [seleccion, setSeleccion] = useState('');

  const canjeElegido = listaCanje.find((c, i) => `${i}` === seleccion);
  const precioEquipo = Number(equipo.pvUsd) || 0;
  const valorToma = canjeElegido ? Number(canjeElegido.valorUsd) || 0 : null;
  const diferencia = valorToma !== null ? precioEquipo - valorToma : null;

  const wa = numeroWhatsapp(telefono);
  const mensajeWA = canjeElegido
    ? `Hola! Me interesa el ${equipo.modelo} ${equipo.gb}GB ${equipo.color} (USD ${precioEquipo}). Tengo un ${canjeElegido.modelo}${canjeElegido.gb ? ` ${canjeElegido.gb}GB` : ''} para entregar como parte de pago. ¿Confirmamos la diferencia?`
    : `Hola! Me interesa el ${equipo.modelo} ${equipo.gb}GB ${equipo.color} con Plan Canje. ¿Me ayudás a calcular la diferencia?`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, margin: 'auto', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>💱 Plan Canje</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ color: '#86868b', fontSize: 13, marginBottom: 20 }}>
          Querés: <strong style={{ color: '#fff' }}>{equipo.modelo} {equipo.gb}GB {equipo.color}</strong> — USD {precioEquipo}
        </div>

        <label style={{ color: '#86868b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
          Tu iPhone actual
        </label>
        <select
          value={seleccion}
          onChange={e => setSeleccion(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
        >
          <option value="">Elegí tu modelo...</option>
          {listaCanje.map((c, i) => (
            <option key={i} value={i}>{c.modelo}{c.gb ? ` ${c.gb}GB` : ''}</option>
          ))}
        </select>

        {canjeElegido && (
          <div style={{ background: diferencia > 0 ? '#2c2c2e' : 'rgba(48,209,88,0.1)', border: `1px solid ${diferencia > 0 ? '#3a3a3c' : 'rgba(48,209,88,0.3)'}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
            {diferencia > 0 ? (
              <>
                <div style={{ fontSize: 12, color: '#86868b', marginBottom: 4 }}>DIFERENCIA A PAGAR</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#2563EB' }}>USD {diferencia}</div>
                {tipoCambio > 0 && <div style={{ fontSize: 14, color: '#86868b', marginTop: 2 }}>${(diferencia * tipoCambio).toLocaleString('es-AR')} ARS</div>}
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#30d158', marginBottom: 4 }}>¡TU EQUIPO VALE MÁS!</div>
                <div style={{ fontSize: 15, color: '#ebebf5cc' }}>Se te devolvería la diferencia de USD {Math.abs(diferencia)} — consultanos.</div>
              </>
            )}
          </div>
        )}

        <div style={{ color: '#86868b', fontSize: 11, lineHeight: 1.6, marginBottom: 20 }}>
          Valor de toma estimado, sujeto a revisión del equipo en persona (batería, pantalla y estado general).
        </div>

        {wa ? (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(mensajeWA)}`}
            target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#25D366', color: '#fff', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
          >
            Consultar por WhatsApp
          </a>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#86868b', padding: '10px' }}>
            Este negocio no cargó un WhatsApp de contacto
          </div>
        )}
      </div>
    </div>
  );
}
