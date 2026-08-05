import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';

const WHATSAPP_SOPORTE = '5493364400111';

const PLAN_INCLUYE = [
  'Stock y ventas ilimitadas',
  'Multi-moneda ARS/USD en tiempo real',
  'Cobros, cuotas y saldos pendientes',
  'Proveedores y pagos',
  'Usuarios ilimitados con permisos',
  'Catálogo público compartible por WhatsApp',
  'Reportes de ganancia en USD y ARS',
  'Calculadora de precio con rentabilidad',
  'Panel de deudores con semáforo de atraso',
  'Botón WhatsApp directo a deudores',
  'Resumen de cobros del día',
  'Exportar ventas y stock a Excel',
  'Múltiples puntos de venta',
  'Reportes por vendedor',
  'Dashboard gerencial',
  'Historial completo de cada equipo',
  'Soporte WhatsApp prioritario',
];

export default function Planes() {
  const { user, perfil, negocioId, plan, planActivo } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const motivo = searchParams.get('motivo');
  const upgrade = searchParams.get('upgrade');
  const pago   = searchParams.get('pago');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [verificando, setVerificando] = useState(false);
  const proRef = useRef(null);
  const verificacionRef = useRef(null);

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

  const PRECIO_PLAN = { promax: 29900 };

  // Redirigir al panel cuando el plan ya está activo
  useEffect(() => {
    if (pago === 'exitoso' && planActivo && plan && plan !== 'trial') {
      if (typeof fbq !== 'undefined') fbq('track', 'Purchase', { value: PRECIO_PLAN[plan] ?? 0, currency: 'ARS' });
      clearInterval(verificacionRef.current);
      const t = setTimeout(() => navigate('/'), 2500);
      return () => clearTimeout(t);
    }
  }, [pago, planActivo, plan, navigate]);

  // Verificación activa: consulta el estado de la suscripción directamente con MP
  // como respaldo si el webhook de MercadoPago no llega a tiempo
  useEffect(() => {
    if (pago !== 'exitoso' || !negocioId || planActivo) return;

    let intentos = 0;
    const MAX_INTENTOS = 10;

    const verificar = async () => {
      if (planActivo) {
        clearInterval(verificacionRef.current);
        return;
      }
      intentos++;
      try {
        setVerificando(true);
        const res = await fetch('/api/verificar-suscripcion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ negocioId }),
        });
        const data = await res.json();
        if (data.activado) {
          // Firestore onSnapshot en AuthContext detectará el cambio y actualizará planActivo
          clearInterval(verificacionRef.current);
        }
      } catch {
        // ignorar errores silenciosamente, el siguiente intento reintentará
      } finally {
        if (intentos >= MAX_INTENTOS) {
          clearInterval(verificacionRef.current);
          setVerificando(false);
        }
      }
    };

    verificar(); // primer intento inmediato
    verificacionRef.current = setInterval(verificar, 4000);

    return () => {
      clearInterval(verificacionRef.current);
      setVerificando(false);
    };
  }, [pago, negocioId]);

  const handleContratar = async (planId) => {
if (typeof fbq !== 'undefined') fbq('track', 'InitiateCheckout', { value: PRECIO_PLAN[planId] ?? 0, currency: 'ARS' });
    try {
      const res = await fetch('/api/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, negocioId, email: user?.email || perfil?.email }),
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
      else alert('No pudimos procesar el pago. Verificá que tu cuenta esté registrada con un email real y válido, o contactanos por WhatsApp.');
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
          <div style={{ fontSize: 20, marginBottom: 6 }}>{planActivo && plan !== 'trial' ? '✅' : '⏳'}</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#30d158', marginBottom: 6 }}>
            {planActivo && plan !== 'trial' ? 'Plan activado. Llevándote al panel...' : 'Pago recibido. Activando tu plan...'}
          </div>
          <div style={{ color: '#86868b', fontSize: 14 }}>
            {planActivo && plan !== 'trial'
              ? 'Tu suscripción está activa. Serás redirigido automáticamente.'
              : verificando
                ? 'Verificando el estado del pago con MercadoPago...'
                : 'Esperando confirmación de MercadoPago. Puede tardar unos segundos.'}
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
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>Un solo plan. Todo incluido.</h1>
        <p style={{ color: '#86868b', fontSize: 16 }}>Sin letra chica, sin funciones bloqueadas por precio.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', maxWidth: 1060, margin: '0 auto 40px' }}>
        <div ref={proRef} style={{
          background: 'rgba(37,99,235,0.06)', border: `2px solid ${upgrade ? '#ff9f0a' : '#2563EB'}`, borderRadius: 16,
          padding: isMobile ? 28 : 36, display: 'flex', flexDirection: 'column', gap: 16,
          flex: '1 1 100%', maxWidth: 420, position: 'relative',
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#2563EB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Completo</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#2563EB', letterSpacing: '-1px' }}>
              $29.900<span style={{ fontSize: 14, fontWeight: 400, color: '#86868b' }}>/mes</span>
            </div>
            <div style={{ fontSize: 12, color: '#86868b', marginTop: 4 }}>= $997 ARS por día.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PLAN_INCLUYE.map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#ebebf5cc', alignItems: 'flex-start' }}>
                <span style={{ color: '#30d158', flexShrink: 0, marginTop: 1 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <button onClick={handleProMax}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
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

