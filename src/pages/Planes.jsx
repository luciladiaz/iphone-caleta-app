import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { IconCheckCircle, IconClock, IconXCircle, IconWarning } from '../components/Icons';

const WHATSAPP_SOPORTE = '5493364400111';

const PLAN_INCLUYE = [
  { categoria: 'Ventas y catálogo', items: [
    'Catálogo público compartible por WhatsApp',
    'Plan Canje: calculadora de diferencia para tu cliente',
    'Comprobante de venta con checklist y firma digital',
    'Stock y ventas ilimitadas',
    'Múltiples puntos de venta',
  ]},
  { categoria: 'Cobros y proveedores', items: [
    'Cobros, cuotas y saldos pendientes',
    'Panel de deudores con semáforo de atraso',
    'Botón WhatsApp directo a deudores',
    'Resumen de cobros del día',
    'Proveedores y pagos',
  ]},
  { categoria: 'Ganancias y reportes', items: [
    'Multi-moneda ARS/USD en tiempo real',
    'Reportes de ganancia en USD y ARS',
    'Calculadora de precio con rentabilidad',
    'Dashboard gerencial',
    'Reportes por vendedor',
    'Exportar ventas y stock a Excel',
  ]},
  { categoria: 'Usuarios y equipos', items: [
    'Usuarios ilimitados con permisos',
    'Historial completo de cada equipo',
  ]},
];

export default function Planes() {
  const { user, perfil, negocioId, negocio, plan, planActivo } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const motivo = searchParams.get('motivo');
  const upgrade = searchParams.get('upgrade');
  const pago   = searchParams.get('pago');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [verificando, setVerificando] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelError, setCancelError] = useState('');
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

  const handleCancelar = async () => {
    setCancelando(true);
    setCancelError('');
    try {
      const res = await fetch('/api/cancelar-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocioId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCancelError(data.error || 'No pudimos cancelar la suscripción. Intentá de nuevo o contactanos por WhatsApp.');
        setCancelando(false);
        return;
      }
      // Firestore onSnapshot en AuthContext va a reflejar renovacionAutomatica=false solo
      setModalCancelar(false);
      setCancelando(false);
    } catch {
      setCancelError('Error de conexión. Intentá de nuevo o contactanos por WhatsApp.');
      setCancelando(false);
    }
  };

  const fechaVencePlan = negocio?.vencePlan ? (negocio.vencePlan?.toDate?.() || new Date(negocio.vencePlan)) : null;
  const canceladoConGracia = negocio?.renovacionAutomatica === false && planActivo && plan !== 'trial';
  const puedeCancel = plan !== 'trial' && planActivo && negocio?.renovacionAutomatica !== false;

  return (
    <div>
      {/* ── Banner: pago exitoso (redirect en curso) ───────────────────────── */}
      {pago === 'exitoso' && (
        <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ marginBottom: 6 }}>{planActivo && plan !== 'trial' ? <IconCheckCircle size={20} style={{ color: 'var(--rv-accent)' }} /> : <IconClock size={20} />}</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--rv-text)', marginBottom: 6 }}>
            {planActivo && plan !== 'trial' ? 'Plan activado. Llevándote al panel...' : 'Pago recibido. Activando tu plan...'}
          </div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 14 }}>
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
        <div style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ marginBottom: 6 }}><IconXCircle size={20} style={{ color: 'var(--rv-danger)' }} /></div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--rv-danger)', marginBottom: 6 }}>
            El pago fue rechazado
          </div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 14 }}>
            Verificá que tu tarjeta tenga fondos suficientes e intentá de nuevo, o contactanos por WhatsApp.
          </div>
        </div>
      )}

      {/* ── Banner: pago pendiente ─────────────────────────────────────────── */}
      {pago === 'pendiente' && (
        <div style={{ background: 'var(--rv-accent-soft)', border: '1px solid rgba(47,111,237,0.3)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ marginBottom: 6 }}><IconClock size={20} style={{ color: 'var(--rv-accent)' }} /></div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--rv-accent)', marginBottom: 6 }}>
            Pago pendiente de acreditación
          </div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 14 }}>
            Tu pago está siendo procesado. Te avisaremos cuando se confirme y tu plan se activará automáticamente.
          </div>
        </div>
      )}

      {/* ── Banner: cuenta suspendida por pago fallido ────────────────────── */}
      {motivo === 'suspendido' && !planActivo && (
        <div style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.5)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ marginBottom: 6 }}><IconWarning size={20} style={{ color: 'var(--rv-danger)' }} /></div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--rv-danger)', marginBottom: 6 }}>
            Tu acceso fue suspendido
          </div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 14, marginBottom: 12 }}>
            Tu último pago no pudo procesarse y MercadoPago agotó los reintentos automáticos.
            Tus datos están guardados. Actualizá tu método de pago para recuperar el acceso inmediatamente.
          </div>
          <button
            onClick={() => { const msg = encodeURIComponent('Hola, necesito actualizar mi método de pago en ReventApp'); window.open(`https://wa.me/${WHATSAPP_SOPORTE}?text=${msg}`, '_blank'); }}
            style={{ background: 'var(--rv-danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Actualizar método de pago →
          </button>
        </div>
      )}

      {/* ── Banner: cancelado por el usuario, todavía con acceso hasta que venza lo pagado ── */}
      {canceladoConGracia && (
        <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ marginBottom: 6 }}><IconClock size={20} /></div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--rv-text)', marginBottom: 6 }}>
            Tu plan fue cancelado
          </div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 14 }}>
            No se te va a cobrar de nuevo. Vas a seguir teniendo acceso completo
            {fechaVencePlan ? ` hasta el ${fechaVencePlan.toLocaleDateString('es-AR')}` : ' hasta el final del período ya pagado'}.
          </div>
        </div>
      )}

      {/* ── Banner: trial vencido ──────────────────────────────────────────── */}
      {motivo === 'vencido' && !planActivo && (
        <div style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⏰</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--rv-danger)', marginBottom: 6 }}>
            Tu período de prueba de 7 días ha vencido
          </div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 14 }}>
            Elegí un plan para seguir organizando tu negocio. Tus datos están guardados y seguros.
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>Un solo plan. Todo incluido.</h1>
        <p style={{ color: 'var(--rv-text-dim)', fontSize: 16 }}>Sin letra chica, sin funciones bloqueadas por precio.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', maxWidth: 1060, margin: '0 auto 40px' }}>
        <div ref={proRef} style={{
          background: 'var(--rv-accent-soft)', border: '2px solid var(--rv-accent)', borderRadius: 16,
          padding: isMobile ? 28 : 36, display: 'flex', flexDirection: 'column', gap: 16,
          flex: '1 1 100%', maxWidth: 420, position: 'relative',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--rv-accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Completo</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--rv-accent)', letterSpacing: '-1px' }}>
              $29.900<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--rv-text-dim)' }}>/mes</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--rv-text-dim)', marginTop: 4 }}>= $997 ARS por día.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PLAN_INCLUYE.map(grupo => (
              <div key={grupo.categoria}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--rv-accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{grupo.categoria}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {grupo.items.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--rv-text-mid)', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--rv-accent)', flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {puedeCancel ? (
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--rv-text-dim)' }}>
              Ya tenés este plan activo.
              <button onClick={() => setModalCancelar(true)}
                style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', textDecoration: 'underline', fontSize: 13, cursor: 'pointer', padding: 0, marginLeft: 6 }}>
                Cancelar suscripción
              </button>
            </div>
          ) : (
            <button onClick={handleProMax}
              style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Contratar ahora
            </button>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--rv-text-dim)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <span>Pagá con tarjeta, débito o transferencia via MercadoPago</span>
        <span>Cancelá cuando quieras · 7 días de prueba gratis al registrarte</span>
      </div>

      {/* ── Modal: confirmar cancelación ────────────────────────────────────── */}
      {modalCancelar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>¿Cancelar tu suscripción?</h2>
            <p style={{ color: 'var(--rv-text-dim)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              No se te va a cobrar de nuevo. Vas a seguir teniendo acceso completo
              {fechaVencePlan ? ` hasta el ${fechaVencePlan.toLocaleDateString('es-AR')}` : ' hasta el final del período que ya pagaste'},
              y después tu cuenta queda en pausa (tus datos se guardan) hasta que reactives un plan.
            </p>
            {cancelError && (
              <div style={{ background: 'var(--rv-danger-soft)', color: 'var(--rv-danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                {cancelError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalCancelar(false)} disabled={cancelando}
                style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>
                Volver
              </button>
              <button onClick={handleCancelar} disabled={cancelando}
                style={{ padding: '10px 20px', background: 'var(--rv-danger)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

