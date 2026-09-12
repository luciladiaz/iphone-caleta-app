import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { IconX } from '../components/Icons';
import FormularioTarjetaMP from '../components/FormularioTarjetaMP';

const WHATSAPP_SOPORTE = '5493364400111';

// Mismos 4 tonos semánticos que ya usa el panel de superadmin (SuperAdmin.jsx, objeto
// SALUD) -- reusados acá tal cual para que el color signifique lo mismo en los dos
// lugares de la app.
const TONOS = {
  info:    { bg: 'rgba(47,111,237,0.1)',  color: '#2f6fed' },
  aviso:   { bg: 'rgba(200,121,10,0.12)', color: '#c8790a' },
  ok:      { bg: 'rgba(26,156,107,0.12)', color: '#1a9c6b' },
  peligro: { bg: 'rgba(212,61,61,0.1)',   color: '#d43d3d' },
};

export default function Planes() {
  const { user, perfil, negocioId, negocio, plan, planActivo, diasRestantesTrial } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pago   = searchParams.get('pago');
  const comprar = searchParams.get('comprar');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [verificando, setVerificando] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [modalTarjeta, setModalTarjeta] = useState(false);
  const [creandoSuscripcion, setCreandoSuscripcion] = useState(false);
  const [errorTarjeta, setErrorTarjeta] = useState('');
  const [modalActualizarTarjeta, setModalActualizarTarjeta] = useState(false);
  const [actualizandoTarjeta, setActualizandoTarjeta] = useState(false);
  const [errorActualizarTarjeta, setErrorActualizarTarjeta] = useState('');
  const [tarjetaActualizada, setTarjetaActualizada] = useState(false);
  const [suscripcionRecienCreada, setSuscripcionRecienCreada] = useState(false);
  const verificacionRef = useRef(null);
  const comprarDisparadoRef = useRef(false);

  // Protege contra una segunda suscripción real cobrando por separado: `ultimoCheckout`
  // lo graba el backend SOLO cuando crear-suscripcion.js ya creó la suscripción en MP con
  // éxito (no en un intento fallido, ver comentario ahí) -- si eso pasó hace poco y el
  // plan todavía no pasó a "promax" (falta la confirmación del webhook/verificación),
  // significa que ya hay una suscripción real recién creada esperando activarse. Sin este
  // chequeo, "Contratar ahora" seguía clickeable durante esa espera -- un click doble, o un
  // refresh que reabre el checkout solo por `?comprar=1`, podía crear una SEGUNDA
  // suscripción real. Pasados 10 minutos se vuelve a habilitar como salvavidas, por si la
  // confirmación real nunca llega.
  const msUltimoCheckout = negocio?.ultimoCheckout?.toMillis?.() ?? (negocio?.ultimoCheckout ? new Date(negocio.ultimoCheckout).getTime() : 0);
  const checkoutPendienteReciente = plan !== 'promax' && msUltimoCheckout > 0 && (Date.now() - msUltimoCheckout) < 10 * 60 * 1000;

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const PRECIO_PLAN = { promax: 29900 };

  // Redirigir al panel cuando el plan ya está activo.
  // Si el email todavía no está verificado (ej: compra directa sin pasar por el
  // trial), PrivateRoute lo va a rebotar a /login sin explicación — mejor no
  // navegar y mostrar el aviso de "verificá tu email" en el banner de abajo.
  useEffect(() => {
    if (suscripcionRecienCreada && planActivo && plan && plan !== 'trial') {
      if (typeof fbq !== 'undefined') fbq('track', 'Purchase', { value: PRECIO_PLAN[plan] ?? 0, currency: 'ARS' });
      clearInterval(verificacionRef.current);
      if (!user?.emailVerified) return;
      const t = setTimeout(() => navigate('/'), 2500);
      return () => clearTimeout(t);
    }
  }, [suscripcionRecienCreada, planActivo, plan, navigate, user]);

  // Verificación activa: consulta el estado de la suscripción directamente con MP como
  // respaldo si el webhook de Mercado Pago no llega a tiempo. Antes se disparaba con
  // ?pago=exitoso (venía del redirect al checkout hosteado); ahora la suscripción se crea
  // ya autorizada en el momento (ver confirmarConToken), así que arranca apenas eso pasa.
  useEffect(() => {
    if (!suscripcionRecienCreada || !negocioId || planActivo) return;

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
        const idToken = await user.getIdToken();
        const res = await fetch('/api/verificar-suscripcion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
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
  }, [suscripcionRecienCreada, negocioId]);

  const handleProMax = () => {
    if (checkoutPendienteReciente) return;
    if (typeof fbq !== 'undefined') fbq('track', 'InitiateCheckout', { value: PRECIO_PLAN.promax ?? 0, currency: 'ARS' });
    setErrorTarjeta('');
    setModalTarjeta(true);
  };

  // El formulario de tarjeta ya tokenizó la tarjeta (ver FormularioTarjetaMP) — acá se
  // manda el token al backend, que crea la suscripción directamente autorizada.
  const confirmarConToken = async (cardTokenId, deviceId) => {
    setCreandoSuscripcion(true);
    setErrorTarjeta('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ plan: 'promax', negocioId, email: user?.email || perfil?.email, cardTokenId, deviceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorTarjeta(data.error || 'No pudimos activar tu suscripción. Verificá los datos de la tarjeta o contactanos por WhatsApp.');
        return;
      }
      setModalTarjeta(false);
      setSuscripcionRecienCreada(true);
    } catch {
      setErrorTarjeta('Error al conectar con Mercado Pago. Contactanos por WhatsApp.');
    } finally {
      setCreandoSuscripcion(false);
    }
  };

  // Actualiza la tarjeta de una suscripción ya existente (PUT /preapproval/{id}) --
  // disponible para cualquier suscriptor con preapprovalId, esté al día o con el cobro
  // fallando, sin distinguir un caso del otro (a diferencia de confirmarConToken, esto
  // NO crea una suscripción nueva).
  const actualizarConToken = async (cardTokenId) => {
    setActualizandoTarjeta(true);
    setErrorActualizarTarjeta('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/crear-suscripcion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ negocioId, cardTokenId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorActualizarTarjeta(data.error || 'No pudimos actualizar tu tarjeta. Verificá los datos o contactanos por WhatsApp.');
        return;
      }
      setModalActualizarTarjeta(false);
      setTarjetaActualizada(true);
    } catch {
      setErrorActualizarTarjeta('Error al conectar con Mercado Pago. Contactanos por WhatsApp.');
    } finally {
      setActualizandoTarjeta(false);
    }
  };

  // Compra directa desde la landing (?comprar=1): salta el trial y abre el formulario de
  // tarjeta apenas el negocio recién creado está disponible. No usar planActivo como
  // guarda: el trial recién creado también cuenta como "activo", así que bloquearía esto.
  useEffect(() => {
    if (comprar !== '1' || comprarDisparadoRef.current || !negocioId || plan === 'promax' || checkoutPendienteReciente) return;
    comprarDisparadoRef.current = true;
    setModalTarjeta(true);
  }, [comprar, negocioId, plan, checkoutPendienteReciente]);

  const handleCancelar = async () => {
    setCancelando(true);
    setCancelError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/cancelar-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
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
  const puedeCancel = plan !== 'trial' && planActivo && negocio?.renovacionAutomatica !== false;

  // Un solo estado por vez para la tarjeta de "Tu plan" -- reemplaza la pila de banners
  // que había antes (7 casos posibles apilándose) por un único mensaje + botón, calculado
  // en base a datos reales de Firestore (plan/estado/renovacionAutomatica/vencePlan vía
  // AuthContext), no del query param `?motivo=` de la URL -- ese dependía de que el
  // redirect de PrivateRoute lo pusiera ahí, así que si alguien entraba directo a
  // /planes (favorito, link de otra pestaña) el estado real podía no coincidir con lo
  // que mostraba el banner.
  let estado;
  if (pago === 'fallido') estado = 'pago_qs_fallido';
  else if (pago === 'pendiente') estado = 'pago_qs_pendiente';
  else if (suscripcionRecienCreada) estado = 'recien_creada';
  else if (tarjetaActualizada) estado = 'tarjeta_actualizada';
  else if (plan === 'trial') estado = planActivo ? 'trial_activo' : 'trial_vencido';
  else if (negocio?.renovacionAutomatica === false) estado = planActivo ? 'cancelado_gracia' : 'cancelado_vencido';
  else if (!planActivo) estado = 'pago_fallido';
  else estado = 'activo';

  const fechaFmt = fechaVencePlan ? fechaVencePlan.toLocaleDateString('es-AR') : null;
  const abrirNuevaSuscripcion = () => { setErrorTarjeta(''); handleProMax(); };
  const abrirActualizarTarjeta = () => { setErrorActualizarTarjeta(''); setModalActualizarTarjeta(true); };

  const CONFIG = {
    pago_qs_fallido: {
      tono: 'peligro',
      texto: 'El pago fue rechazado. Verificá que tu tarjeta tenga fondos suficientes e intentá de nuevo.',
      boton: { texto: 'Pagar seguro', accion: abrirNuevaSuscripcion },
    },
    pago_qs_pendiente: {
      tono: 'info',
      texto: 'Tu pago está siendo procesado. Te avisamos cuando se confirme.',
      boton: null,
    },
    recien_creada: {
      tono: planActivo && plan !== 'trial' ? 'ok' : 'info',
      texto: planActivo && plan !== 'trial'
        ? (user?.emailVerified ? 'Plan activado. Llevándote al panel...' : `Pago confirmado. Verificá tu email (${user?.email || 'tu casilla'}) para poder ingresar.`)
        : (verificando ? 'Verificando el pago con MercadoPago...' : 'Pago recibido, activando tu plan...'),
      boton: null,
    },
    tarjeta_actualizada: {
      tono: 'ok',
      texto: 'Tu método de pago fue actualizado. Si tenías el acceso cortado por un pago rechazado, se reactiva solo apenas se acredite.',
      boton: null,
    },
    trial_activo: {
      tono: 'aviso',
      texto: `Estás en la prueba gratis — te quedan ${diasRestantesTrial ?? 0} día${diasRestantesTrial === 1 ? '' : 's'}.`,
      boton: { texto: 'Suscribirme ahora', accion: abrirNuevaSuscripcion },
    },
    trial_vencido: {
      tono: 'peligro',
      texto: 'Tu prueba gratis venció.',
      boton: { texto: 'Suscribirme ahora', accion: abrirNuevaSuscripcion },
    },
    activo: {
      tono: 'ok',
      texto: `Tu pago está al día${fechaFmt ? ` — próximo cobro el ${fechaFmt}` : ''}.`,
      boton: null,
    },
    cancelado_gracia: {
      tono: 'aviso',
      texto: `Cancelaste tu plan. Tenés acceso${fechaFmt ? ` hasta el ${fechaFmt}` : ' hasta el final del período ya pagado'}.`,
      boton: null,
    },
    cancelado_vencido: {
      tono: 'peligro',
      texto: 'Tu plan cancelado ya venció.',
      boton: { texto: 'Suscribirme ahora', accion: abrirNuevaSuscripcion },
    },
    pago_fallido: {
      tono: 'peligro',
      texto: 'Tu último pago no se pudo procesar y se agotaron los reintentos automáticos. Tus datos están guardados.',
      boton: { texto: 'Pagar seguro', accion: abrirActualizarTarjeta },
    },
  };

  const cfg = CONFIG[estado];
  const tono = TONOS[cfg.tono];

  return (
    <div style={{ minHeight: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 20, padding: isMobile ? 26 : 34, width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Tu plan</h1>

        <div style={{ background: tono.bg, color: tono.color, borderRadius: 10, padding: '12px 16px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, marginBottom: 22 }}>
          {cfg.texto}
        </div>

        <div style={{ border: '1px solid var(--rv-border)', borderRadius: 14, padding: 20, marginBottom: 22 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--rv-text)', letterSpacing: '-0.5px' }}>
            $29.900<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--rv-text-dim)' }}>/mes</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--rv-text-dim)', marginTop: 4 }}>Stock, ventas, cobros y usuarios ilimitados.</div>
        </div>

        {checkoutPendienteReciente ? (
          <div style={{ fontSize: 13, color: 'var(--rv-text-dim)' }}>
            Ya iniciaste un pago hace instantes — esperando la confirmación. Si no se activa en unos minutos, escribinos por WhatsApp.
          </div>
        ) : cfg.boton && (
          <button onClick={cfg.boton.accion}
            style={{ width: '100%', background: tono.color, color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {cfg.boton.texto}
          </button>
        )}

        {estado === 'pago_fallido' && (
          <button
            onClick={() => { const msg = encodeURIComponent('Hola, necesito actualizar mi método de pago en ReventApp'); window.open(`https://wa.me/${WHATSAPP_SOPORTE}?text=${msg}`, '_blank'); }}
            style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--rv-text-dim)', textDecoration: 'underline', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
            O escribinos por WhatsApp
          </button>
        )}

        {puedeCancel && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--rv-text-dim)' }}>
            <button onClick={abrirActualizarTarjeta}
              style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', textDecoration: 'underline', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
              Actualizar método de pago
            </button>
            {' · '}
            <button onClick={() => setModalCancelar(true)}
              style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', textDecoration: 'underline', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
              Cancelar suscripción
            </button>
          </div>
        )}
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

      {/* ── Modal: formulario de tarjeta (tokeniza acá mismo, sin redirigir a MP) ──── */}
      {modalTarjeta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Plan Completo — $29.900/mes</h2>
                <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, margin: '4px 0 0' }}>Cancelás cuando quieras.</p>
              </div>
              <button onClick={() => setModalTarjeta(false)} disabled={creandoSuscripcion}
                style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}>
                <IconX size={18} />
              </button>
            </div>
            <div style={{ marginTop: 20 }}>
              <FormularioTarjetaMP
                email={user?.email || perfil?.email}
                onToken={confirmarConToken}
                onCancelar={() => setModalTarjeta(false)}
                procesando={creandoSuscripcion}
                error={errorTarjeta}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: actualizar tarjeta de una suscripción ya existente (no crea una nueva) ── */}
      {modalActualizarTarjeta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Actualizar método de pago</h2>
                <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, margin: '4px 0 0' }}>Cargá una tarjeta nueva para tu suscripción.</p>
              </div>
              <button onClick={() => setModalActualizarTarjeta(false)} disabled={actualizandoTarjeta}
                style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}>
                <IconX size={18} />
              </button>
            </div>
            <div style={{ marginTop: 20 }}>
              <FormularioTarjetaMP
                email={user?.email || perfil?.email}
                onToken={actualizarConToken}
                onCancelar={() => setModalActualizarTarjeta(false)}
                procesando={actualizandoTarjeta}
                error={errorActualizarTarjeta}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

