import { useAuth } from '../context/AuthContext';

const BASICO = [
  'Stock ilimitado', 'Ventas ilimitadas', 'Parte de pago / permuta',
  'Multi-moneda ARS/USD', 'Hasta 2 usuarios', 'Catálogo público compartible',
];
const PRO = [
  ...BASICO,
  'Usuarios ilimitados', 'Reportes de ganancia avanzados',
  'Valor del stock en tiempo real', 'Soporte prioritario por WhatsApp',
  'Nuevas funciones primero',
];

function PlanCard({ nombre, precio, features, destacado, onContratar }) {
  return (
    <div style={{
      background: destacado ? 'rgba(201,169,110,0.06)' : '#1c1c1e',
      border: `2px solid ${destacado ? '#c9a96e' : '#2c2c2e'}`,
      borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 20,
      position: 'relative', flex: 1, minWidth: 260,
    }}>
      {destacado && (
        <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#c9a96e', color: '#000', fontSize: 11, fontWeight: 800, padding: '4px 16px', borderRadius: 99, letterSpacing: 1, whiteSpace: 'nowrap' }}>
          MÁS POPULAR
        </div>
      )}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#86868b', marginBottom: 6 }}>Plan {nombre}</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: destacado ? '#c9a96e' : '#fff', letterSpacing: '-1px' }}>
          ${precio.toLocaleString('es-AR')}
          <span style={{ fontSize: 14, fontWeight: 400, color: '#86868b' }}>/mes</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#ebebf5cc' }}>
            <span style={{ color: '#30d158', flexShrink: 0, marginTop: 1 }}>✓</span> {f}
          </div>
        ))}
      </div>
      <button onClick={() => onContratar(nombre.toLowerCase())} style={{
        background: destacado ? '#c9a96e' : '#2c2c2e',
        color: destacado ? '#000' : '#fff',
        border: destacado ? 'none' : '1px solid #3a3a3c',
        borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
      }}>
        Empezar con {nombre}
      </button>
    </div>
  );
}

export default function Planes() {
  const { perfil, negocioId } = useAuth();

  const handleContratar = async (plan) => {
    try {
      const res = await fetch('/api/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, negocioId, email: perfil?.email }),
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
      else alert('Error al crear el pago. Contactanos por WhatsApp.');
    } catch {
      alert('Error al conectar con MercadoPago. Contactanos por WhatsApp.');
    }
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>Planes simples, sin sorpresas</h1>
        <p style={{ color: '#86868b', fontSize: 16 }}>Elegí el plan que mejor se adapta a tu negocio</p>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720, margin: '0 auto 40px' }}>
        <PlanCard nombre="Básico" precio={7900} features={BASICO} destacado={false} onContratar={handleContratar} />
        <PlanCard nombre="Pro" precio={14900} features={PRO} destacado={true} onContratar={handleContratar} />
      </div>

      <div style={{ textAlign: 'center', color: '#86868b', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <span>💳 Pagá con tarjeta, débito o transferencia via MercadoPago</span>
        <span>🔄 Cancelá en cualquier momento, sin compromisos</span>
      </div>
    </div>
  );
}
