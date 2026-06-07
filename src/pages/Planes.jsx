import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';

const WHATSAPP_SOPORTE = '5493364400111';

const BASICO_INCLUYE = [
  'Stock hasta 20 equipos',
  'Hasta 10 ventas por mes',
  'Cobros y cuotas',
  'Proveedores y pagos',
  '1 usuario',
];
const BASICO_NO_INCLUYE = [
  'Catálogo público',
  'Reportes de ganancia USD y ARS',
  'Calculadora de precio',
  'Panel de deudores con semáforo',
  'Resumen de cobros del día',
  'Exportar a Excel',
];

const PRO_INCLUYE = [
  'Stock hasta 60 equipos',
  'Hasta 30 ventas por mes',
  'Todo lo del Básico',
  'Hasta 3 usuarios con permisos',
  'Catálogo público compartible',
  'Reportes de ganancia USD y ARS',
  'Calculadora de precio con rentabilidad',
  'Panel de deudores con semáforo',
  'Resumen de cobros del día',
  'Exportar ventas y stock a Excel',
  'Soporte WhatsApp 24hs',
];
const PRO_NO_INCLUYE = [
  'Botón WhatsApp directo a deudores',
  'Reportes por vendedor',
  'Dashboard gerencial',
];

const PROMAX_INCLUYE = [
  'Stock ilimitado',
  'Ventas ilimitadas',
  'Todo lo del Pro',
  'Usuarios ilimitados',
  'Múltiples puntos de venta',
  'Botón WhatsApp directo a deudores',
  'Reportes por vendedor',
  'Dashboard gerencial',
  'Historial completo de cada equipo',
  'Soporte WhatsApp prioritario 2hs',
  'Onboarding personalizado',
];

export default function Planes() {
  const { perfil, negocioId, plan, planActivo } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const motivo = searchParams.get('motivo');
  const upgrade = searchParams.get('upgrade');
  const pago   = searchParams.get('pago');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const proRef = useRef(null);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    if (upgrade && proRef.current) {
      setTimeout(() => proRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [upgrade]);

  // Cuando el webhook activa el plan, redirigir al panel automáticamente
  useEffect(() => {
    if (pago === 'exitoso' && planActivo && plan && plan !== 'trial') {
      const t = setTimeout(() => navigate('/'), 2500);
      return () => clearTimeout(t);
    }
  }, [pago, planActivo, plan, navigate]);

  const handleContratar = async (planId) => {
    try {
      const res = await fetch('/api/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, negocioId, email: perfil?.email }),
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
      else alert('Error al crear el pago. Contactanos por WhatsApp.');
    } catch {
      alert('Error al conectar con MercadoPago. Contactanos por WhatsApp.');
    }
  };

  const handleProMax = () => handleContratar('promax');

  return (
    <div>
      {/* ── Banner: pago exitoso (redirect en curso) ───────────────────────── */}
      {pago === 'exitoso' && (
        <div style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.4)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#30d158', marginBottom: 6 }}>
            {planActivo && plan !== 'trial' ? 'Plan activado. Llevándote al panel...' : 'Pago recibido. Activando tu plan...'}
          </div>
          <div style={{ color: '#86868b', fontSize: 14 }}>
            {planActivo && plan !== 'trial'
              ? 'Tu suscripción está activa. Serás redirigido automáticamente.'
              : 'El webhook de MercadoPago está procesando el pago. Puede tardar unos segundos.'}
          </div>
        </div>
      )}

      {/* ── Banner: pago rechazado ─────────────────────────────────────────── */}
      {pago === 'fallido' && (
        <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>❌</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#ff3b30', marginBottom: 6 }}>
            El pago fue rechazado
          </div>
          <div style={{ color: '#86868b', fontSize: 14 }}>
            Verificá que tu tarjeta tenga fondos suficientes e intentá de nuevo, o contactanos por WhatsApp.
          </div>
        </div>
      )}

      {/* ── Banner: pago pendiente ─────────────────────────────────────────── */}
      {pago === 'pendiente' && (
        <div style={{ background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⏳</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#ff9f0a', marginBottom: 6 }}>
            Pago pendiente de acreditación
          </div>
          <div style={{ color: '#86868b', fontSize: 14 }}>
            Tu pago está siendo procesado. Te avisaremos cuando se confirme y tu plan se activará automáticamente.
          </div>
        </div>
      )}

      {/* ── Banner: cuenta suspendida por pago fallido ────────────────────── */}
      {motivo === 'suspendido' && !planActivo && (
        <div style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.5)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#ff3b30', marginBottom: 6 }}>
            Tu acceso fue suspendido
          </div>
          <div style={{ color: '#86868b', fontSize: 14, marginBottom: 12 }}>
            Tu último pago no pudo procesarse y MercadoPago agotó los reintentos automáticos.
            Tus datos están guardados. Actualizá tu método de pago para recuperar el acceso inmediatamente.
          </div>
          <button
            onClick={() => { const msg = encodeURIComponent('Hola, necesito actualizar mi método de pago en ReventApp'); window.open(`https://wa.me/${WHATSAPP_SOPORTE}?text=${msg}`, '_blank'); }}
            style={{ background: '#ff3b30', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Actualizar método de pago →
          </button>
        </div>
      )}

      {/* ── Banner: trial vencido ──────────────────────────────────────────── */}
      {motivo === 'vencido' && !planActivo && (
        <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⏰</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#ff3b30', marginBottom: 6 }}>
            Tu período de prueba de 7 días ha vencido
          </div>
          <div style={{ color: '#86868b', fontSize: 14 }}>
            Elegí un plan para seguir organizando tu negocio. Tus datos están guardados y seguros.
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>Planes simples, sin sorpresas</h1>
        <p style={{ color: '#86868b', fontSize: 16 }}>Elegí el plan que mejor se adapta a tu negocio</p>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', maxWidth: 1060, margin: '0 auto 40px' }}>

        {/* BÁSICO */}
        <div style={{
          order: isMobile ? 2 : 1,
          background: '#1c1c1e', border: '2px solid #2c2c2e', borderRadius: 16,
          padding: 28, display: 'flex', flexDirection: 'column', gap: 14,
          flex: isMobile ? '1 1 100%' : '1 1 260px', maxWidth: isMobile ? '100%' : 300,
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#86868b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Básico</div>
            <div style={{ fontSize: 13, color: '#86868b', marginBottom: 10 }}>Para empezar</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
              $7.900<span style={{ fontSize: 14, fontWeight: 400, color: '#86868b' }}>/mes</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {BASICO_INCLUYE.map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#ebebf5cc', alignItems: 'flex-start' }}>
                <span style={{ color: '#30d158', flexShrink: 0, marginTop: 1 }}>✓</span> {f}
              </div>
            ))}
            <div style={{ borderTop: '1px solid #2c2c2e', marginTop: 10, paddingTop: 10 }}>
              {BASICO_NO_INCLUYE.map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#86868b', alignItems: 'flex-start', marginBottom: 5 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>🔒</span>
                  <span style={{ textDecoration: 'line-through' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => handleContratar('basico')}
            style={{ background: '#2c2c2e', color: '#fff', border: '1px solid #3a3a3c', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Contratar ahora
          </button>
        </div>

        {/* PRO */}
        <div ref={proRef} style={{
          order: isMobile ? 1 : 2,
          background: 'rgba(37,99,235,0.06)', border: `2px solid ${upgrade === 'pro' ? '#ff9f0a' : '#2563EB'}`, borderRadius: 16,
          padding: isMobile ? 28 : 32, display: 'flex', flexDirection: 'column', gap: 14,
          flex: isMobile ? '1 1 100%' : '1 1 300px', maxWidth: isMobile ? '100%' : 360,
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#2563EB', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 18px', borderRadius: 99, letterSpacing: 1, whiteSpace: 'nowrap' }}>
            🔥 MÁS POPULAR
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#2563EB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Pro</div>
            <div style={{ fontSize: 13, color: '#86868b', marginBottom: 10 }}>Para crecer</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#2563EB', letterSpacing: '-1px' }}>
              $14.900<span style={{ fontSize: 14, fontWeight: 400, color: '#86868b' }}>/mes</span>
            </div>
            <div style={{ fontSize: 12, color: '#86868b', marginTop: 4 }}>= $497 ARS por día. Menos que un café.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {PRO_INCLUYE.map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#ebebf5cc', alignItems: 'flex-start' }}>
                <span style={{ color: '#30d158', flexShrink: 0, marginTop: 1 }}>✓</span> {f}
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(37,99,235,0.2)', marginTop: 10, paddingTop: 10 }}>
              {PRO_NO_INCLUYE.map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#86868b', alignItems: 'flex-start', marginBottom: 5 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>🔒</span>
                  <span style={{ textDecoration: 'line-through' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#2563EB', textAlign: 'center' }}>
            🔥 El 80% de nuestros usuarios elige este plan
          </div>
          <button onClick={() => handleContratar('pro')}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Contratar ahora
          </button>
        </div>

        {/* PRO MAX */}
        <div style={{
          order: 3,
          background: '#1c1c1e', border: `2px solid ${upgrade === 'promax' ? '#ff9f0a' : '#2c2c2e'}`, borderRadius: 16,
          padding: 28, display: 'flex', flexDirection: 'column', gap: 14,
          flex: isMobile ? '1 1 100%' : '1 1 260px', maxWidth: isMobile ? '100%' : 300,
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#86868b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Pro Max</div>
            <div style={{ fontSize: 13, color: '#86868b', marginBottom: 10 }}>Para equipos</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
              $29.900<span style={{ fontSize: 14, fontWeight: 400, color: '#86868b' }}>/mes</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {PROMAX_INCLUYE.map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#ebebf5cc', alignItems: 'flex-start' }}>
                <span style={{ color: '#30d158', flexShrink: 0, marginTop: 1 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <div style={{ background: '#2c2c2e', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#86868b', textAlign: 'center', lineHeight: 1.5 }}>
            💬 ¿Manejás más de 100 equipos por mes? Este plan es para vos
          </div>
          <button onClick={handleProMax}
            style={{ background: '#2c2c2e', color: '#fff', border: '1px solid #3a3a3c', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Contratar ahora
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#86868b', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <span>💳 Pagá con tarjeta, débito o transferencia via MercadoPago</span>
        <span>🔄 Cancelá cuando quieras · ✓ 7 días de prueba gratis al registrarte</span>
      </div>
    </div>
  );
}

