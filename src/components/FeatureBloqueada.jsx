import { useNavigate } from 'react-router-dom';
import { PLANES } from '../config/planes';

const PRECIO_PLAN = { pro: '$14.900', promax: '$29.900' };

export default function FeatureBloqueada({ feature, planRequerido = 'pro', descripcion }) {
  const navigate = useNavigate();
  const nombrePlan = PLANES[planRequerido]?.nombre || 'Pro';
  const precio = PRECIO_PLAN[planRequerido] || '';

  return (
    <div style={{
      background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14,
      padding: '40px 24px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
      }}>
        🔒
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
          Esta función requiere el Plan {nombrePlan}
        </div>
        {descripcion && (
          <div style={{ color: '#86868b', fontSize: 14, lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
            {descripcion}
          </div>
        )}
      </div>
      <button
        onClick={() => navigate(`/planes?upgrade=${planRequerido}`)}
        style={{
          background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10,
          padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Actualizar a {nombrePlan}{precio ? ` → ${precio}/mes` : ''}
      </button>
      <button
        onClick={() => navigate('/planes')}
        style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 13, cursor: 'pointer' }}
      >
        Ver comparación de planes
      </button>
    </div>
  );
}

