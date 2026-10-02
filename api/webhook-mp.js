import { createHmac, timingSafeEqual } from 'crypto';
import { adminDb } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;
const PLANES_VALIDOS = new Set(['promax']); // ReventApp: un solo plan pago

// Confirma que la notificación realmente vino de Mercado Pago (y no de cualquiera que
// le pegue a esta URL a mano) verificando la firma HMAC que manda en el header
// x-signature, según el algoritmo documentado por MP. Mientras no esté configurado
// MP_WEBHOOK_SECRET (falta cargarlo en Vercel con la clave secreta del webhook, que se
// obtiene desde el panel de Mercado Pago → Tus integraciones → Webhooks) esto no bloquea
// nada — se sigue confiando en que después el handler re-consulta el pago real contra la
// API de MP antes de activar cualquier plan, que es la protección de fondo.
function firmaValida(req) {
  if (!MP_WEBHOOK_SECRET) return true;
  const firma = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  const dataId = req.query?.['data.id'];
  if (!firma || !requestId || !dataId) return false;

  const partes = Object.fromEntries(firma.split(',').map(p => p.trim().split('=').map(s => s.trim())));
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const esperada = createHmac('sha256', MP_WEBHOOK_SECRET).update(manifest).digest('hex');

  const a = Buffer.from(v1, 'hex');
  const b = Buffer.from(esperada, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function fetchMP(path) {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!r.ok) throw new Error(`MP API ${r.status} — ${path}`);
  return r.json();
}

function parsearRef(externalRef) {
  if (!externalRef || !externalRef.includes('___')) return null;
  const [negocioId, plan] = externalRef.split('___');
  if (!negocioId || !PLANES_VALIDOS.has(plan)) return null;
  return { negocioId, plan };
}

// Una misma renovación real puede avisarse por más de un tipo de evento de MP a la vez
// -- confirmado en vivo con el caso de un cliente real que quedó con DOS "plan_renovado"
// el mismo día: uno vino del evento "payment" (mpId = payment_id numérico) y el otro del
// evento "subscription_preapproval" en estado "authorized" (mpId = preapproval_id,
// alfanumérico, nada que ver con el payment_id del mismo cobro). Si cada aviso dispara
// esta función sin control, cada uno además empuja vencePlan 31 días más -- en el peor
// caso un cliente podría terminar renovando gratis con cada aviso duplicado, sin que
// Mercado Pago le haya cobrado de nuevo. Como una renovación real nunca ocurre dos veces
// en la misma hora (el ciclo es mensual), alcanza con no volver a extender ni loguear si
// la activación anterior fue hace menos de 1 hora -- cualquier aviso de MP para ESA misma
// renovación, venga del tipo de evento que venga, cae en esta ventana y se ignora.
async function activarPlan(negocioId, plan, mpId) {
  const negRef = adminDb.doc(`negocios/${negocioId}`);
  const negSnap = await negRef.get();
  const ultimoPago = negSnap.exists ? negSnap.data().ultimoPago?.toDate?.() : null;
  if (ultimoPago && (Date.now() - ultimoPago.getTime()) < 60 * 60 * 1000) {
    console.log(`[Webhook MP] Plan ya se activó hace menos de 1 hora (otro aviso de MP para la misma renovación) -- no se vuelve a extender ni duplicar en el historial | negocio=${negocioId} | mpId=${mpId}`);
    return;
  }

  const vencePlan = new Date();
  vencePlan.setDate(vencePlan.getDate() + 31);

  await negRef.update({
    plan,
    estado: 'activo',
    vencePlan,
    renovacionAutomatica: true,
    ultimoPago: FieldValue.serverTimestamp(),
  });

  // Mirror del plan al doc público (el catálogo compartible lee de acá, nunca del doc completo)
  await adminDb.doc(`negocios/${negocioId}/publico/info`).set({ plan }, { merge: true });

  await adminDb.collection(`negocios/${negocioId}/pagos`).add({
    tipo: 'plan_renovado',
    plan,
    estado: 'exitoso',
    mpId: mpId || 'test',
    fecha: FieldValue.serverTimestamp(),
  });

  console.log(`[Webhook MP] ✅ Plan ${plan} activado | negocio=${negocioId} | vence=${vencePlan.toISOString()}`);
}

async function suspenderPlan(negocioId, mpId) {
  await adminDb.doc(`negocios/${negocioId}`).update({
    estado: 'suspendido',
    motivoSuspension: 'pago_fallido',
    fechaSuspension: FieldValue.serverTimestamp(),
  });

  await adminDb.collection(`negocios/${negocioId}/pagos`).add({
    tipo: 'suscripcion_cancelada',
    estado: 'cancelado_sin_pago',
    mpId: mpId || 'test',
    fecha: FieldValue.serverTimestamp(),
  });

  console.log(`[Webhook MP] 🔒 Plan suspendido | negocio=${negocioId}`);
}

// Si el negocio ya canceló voluntariamente desde la app (ver api/cancelar-suscripcion.js,
// renovacionAutomatica=false), el acceso se corta solo cuando vence vencePlan — no lo
// cortamos de golpe acá de nuevo ni lo marcamos como "pago fallido", que sería falso.
async function procesarCancelacion(negocioId, mpId) {
  const negSnap = await adminDb.doc(`negocios/${negocioId}`).get();
  const yaCanceladoPorUsuario = negSnap.exists && negSnap.data().renovacionAutomatica === false;

  if (yaCanceladoPorUsuario) {
    console.log(`[Webhook MP] Cancelación ya procesada por el usuario, no se vuelve a suspender | negocio=${negocioId}`);
    return;
  }

  // MP agotó los reintentos de cobro — esto sí es un pago realmente fallido, cortar acceso ahora
  await suspenderPlan(negocioId, mpId);
}

// cc_rejected_call_for_authorize es un "hard decline" documentado por MP: el banco
// emisor exige que el titular lo autorice personalmente llamándolo (no un problema de
// fondos ni de nuestra integración) -- ningún reintento automático de MP lo va a
// resolver nunca, a diferencia de un rechazo "blando" (fondos insuficientes, timeout)
// donde sí tiene sentido esperar el reintento. Se guarda aparte para poder ver en el
// historial de pagos que ESTE caso puntual necesita que el cliente llame a su banco,
// en vez de asumir que ya se va a solucionar solo.
const RECHAZOS_QUE_REQUIEREN_ACCION_DEL_CLIENTE = new Set(['cc_rejected_call_for_authorize']);

async function logPagoRechazado(negocioId, mpId, statusDetail) {
  const requiereAccion = RECHAZOS_QUE_REQUIEREN_ACCION_DEL_CLIENTE.has(statusDetail);
  try {
    // MP puede reenviar la misma notificación más de una vez (comportamiento normal de
    // sus webhooks), a veces con los dos avisos llegando casi al mismo tiempo -- confirmado
    // en vivo con un caso real que quedó con DOS entradas idénticas (mismo mpId, mismo
    // motivo, mismo día). Un chequeo "leer si existe, después escribir" no alcanza contra
    // eso: las dos llamadas pueden hacer la lectura ANTES de que cualquiera de las dos
    // termine de escribir, así que las dos ven "no existe" y las dos agregan su entrada.
    // La única forma de que esto sea a prueba de carrera es que el id del documento sea el
    // mpId mismo y usar create() (atómico en el servidor: falla solo si ya existe, en vez
    // de leer y confiar en que nadie escribió en el medio). 'test' se excluye a propósito:
    // en ese caso mpId no identifica un pago real, y dos intentos de prueba distintos no
    // deberían fusionarse en uno solo.
    const datos = {
      tipo: requiereAccion ? 'pago_rechazado_requiere_autorizacion_cliente' : 'pago_rechazado_reintentando',
      estado: 'reintentando',
      motivoRechazo: statusDetail || 'desconocido',
      mpId: mpId || 'test',
      fecha: FieldValue.serverTimestamp(),
    };
    if (mpId && mpId !== 'test') {
      try {
        await adminDb.doc(`negocios/${negocioId}/pagos/rechazo_${mpId}`).create(datos);
      } catch (err) {
        if (err.code === 6) { // ALREADY_EXISTS
          console.log(`[Webhook MP] Pago rechazado ya estaba registrado, no se duplica | negocio=${negocioId} | mpId=${mpId}`);
          return;
        }
        throw err;
      }
    } else {
      await adminDb.collection(`negocios/${negocioId}/pagos`).add(datos);
    }
  } catch (err) { console.error('[Webhook MP] Error logueando pago rechazado:', err); }
  if (requiereAccion) {
    console.log(`[Webhook MP] ⚠️ Pago rechazado -- requiere que el cliente autorice con su banco (${statusDetail}) | negocio=${negocioId}`);
  } else {
    console.log(`[Webhook MP] ⏳ Pago rechazado (${statusDetail || 'motivo desconocido'}), MP reintentando | negocio=${negocioId}`);
  }
}

// Reembolso o contracargo: a diferencia de un pago "rejected" (que MP va a reintentar),
// acá la plata YA había entrado y ahora se devolvió -- el negocio queda con el plan
// pagado activo indefinidamente si no se corta acá. No es lo mismo que una cancelación
// voluntaria (procesarCancelacion), por eso se loguea con su propio tipo para poder
// distinguirlo después en el historial de pagos.
async function procesarReembolso(negocioId, mpId) {
  await adminDb.doc(`negocios/${negocioId}`).update({
    estado: 'suspendido',
    motivoSuspension: 'reembolso_o_contracargo',
    fechaSuspension: FieldValue.serverTimestamp(),
  });

  await adminDb.collection(`negocios/${negocioId}/pagos`).add({
    tipo: 'pago_reembolsado',
    estado: 'reembolsado',
    mpId: mpId || 'test',
    fecha: FieldValue.serverTimestamp(),
  });

  console.log(`[Webhook MP] 💸 Pago reembolsado/contracargo — plan suspendido | negocio=${negocioId}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!firmaValida(req)) {
    console.error('[Webhook MP] Firma inválida — notificación rechazada');
    return res.status(401).json({ error: 'Firma inválida' });
  }

  const { type, data } = req.body || {};
  if (!type || !data?.id) return res.status(200).json({ ok: true, msg: 'Notificación ignorada' });

  console.log(`[Webhook MP] Recibido: type=${type} id=${data.id}`);

  try {
    // Pago individual (cobro mensual de la suscripción)
    if (type === 'payment') {
      const pago = await fetchMP(`/v1/payments/${data.id}`);
      const parsed = parsearRef(pago.external_reference);
      if (!parsed) return res.status(200).json({ ok: true });

      if (pago.status === 'approved') {
        await activarPlan(parsed.negocioId, parsed.plan, data.id);
      } else if (pago.status === 'rejected') {
        // MP va a reintentar — NUNCA bloquear por un solo pago rechazado
        await logPagoRechazado(parsed.negocioId, data.id, pago.status_detail);
      } else if (pago.status === 'refunded' || pago.status === 'charged_back') {
        await procesarReembolso(parsed.negocioId, data.id);
      }
    }

    // Cobro recurrente de una suscripción YA autorizada (cada cuota/reintento genera o
    // actualiza una "factura" -- authorized_payments). Esto es DISTINTO del evento
    // "payment" de arriba: confirmado con soporte de Mercado Pago que los reintentos de
    // un cobro recurrente notifican acá, no como eventos "payment" nuevos. Sin este
    // handler quedábamos completamente ciegos a los reintentos de un cliente ya
    // suscripto -- confirmado en vivo con el caso real de un cliente en "Intento 3 de 4"
    // que nunca generó un solo registro en Firestore porque nunca escuchábamos este tipo
    // de evento.
    if (type === 'subscription_authorized_payment') {
      const factura = await fetchMP(`/authorized_payments/${data.id}`);
      const parsed = parsearRef(factura.external_reference);
      if (!parsed) return res.status(200).json({ ok: true });

      const pago = factura.payment;
      if (pago?.status === 'approved') {
        await activarPlan(parsed.negocioId, parsed.plan, pago.id);
      } else if (pago?.status === 'rejected') {
        await logPagoRechazado(parsed.negocioId, pago.id, pago.status_detail);
      }
    }

    // Cambio de estado de la suscripción
    if (type === 'subscription_preapproval') {
      const sub = await fetchMP(`/preapproval/${data.id}`);
      const parsed = parsearRef(sub.external_reference);
      if (!parsed) return res.status(200).json({ ok: true });

      // Un negocio puede terminar con MÁS DE UN preapproval en Mercado Pago -- ej: un
      // intento de alta que falló (tarjeta rechazada) y el cliente reintentó con éxito
      // después. El viejo queda huérfano, pero sigue siendo una suscripción viva para MP,
      // que le sigue reintentando el cobro en segundo plano, totalmente aparte de la que
      // el cliente realmente usa y paga. Sin este chequeo, cuando ese preapproval viejo
      // agota sus propios reintentos y MP lo pasa a 'cancelled', procesarCancelacion()
      // suspendía la cuenta real del cliente -- aunque su suscripción de verdad (otro
      // preapproval_id, el que está guardado en negocios/{id}.preapprovalId) siguiera al
      // día. Confirmado con la captura real de Lucila: Joaquín González aparece dos veces
      // en el panel de MP, una "Al día" (14/sep) y otra "Atrasado, intento 1 de 4"
      // (30/sep) -- dos preapprovals distintos del mismo cliente. Cualquier evento que no
      // sea del preapproval que el negocio tiene guardado como el vigente se ignora acá.
      const negSnap = await adminDb.doc(`negocios/${parsed.negocioId}`).get();
      const preapprovalVigente = negSnap.exists ? negSnap.data().preapprovalId : null;
      if (sub.id !== preapprovalVigente) {
        console.log(`[Webhook MP] Evento de un preapproval viejo/huérfano, no es el vigente del negocio -- se ignora | negocio=${parsed.negocioId} | preapproval_evento=${sub.id} | preapproval_vigente=${preapprovalVigente || 'ninguno'} | status=${sub.status}`);
        return res.status(200).json({ ok: true });
      }

      // 'authorized' es el estado del MANDATO de la suscripción (el permiso para
      // cobrarle), no la prueba de que el cobro real del mes se haya efectivizado -- se
      // pone en 'authorized' ni bien se crea la suscripción y se mantiene ahí aunque el
      // cobro real venga siendo rechazado. Activar el plan acá solo por ver 'authorized'
      // le dio 31 días de acceso pagado gratis a un cliente real (caso detectado
      // 2026-09-11: cobro real rechazado 4 veces con cc_rejected_high_risk, pero el plan
      // se seguía renovando solo). Esto YA se había arreglado una vez (commit
      // "Fix critico: dejar de activar el plan solo por status=authorized") pero el
      // arreglo se revirtió 16 minutos después sin explicación en el mensaje del revert
      // -- y el mismo caso volvió a pasar con otro cliente. Un cobro real aprobado
      // siempre notifica por 'payment' o 'subscription_authorized_payment' (ver arriba),
      // que sí traen el pago real y activan el plan correctamente -- por eso sacar la
      // activación de acá no pierde ningún caso legítimo de reactivación, solo saca el
      // falso positivo.
      if (sub.status === 'paused') {
        // MP reintentando cobro — NO bloquear todavía, solo registrar
        await logPagoRechazado(parsed.negocioId, data.id);
      } else if (sub.status === 'cancelled') {
        await procesarCancelacion(parsed.negocioId, data.id);
      }
    }

    // Notificación procesada con éxito (incluye los casos ya filtrados arriba con 200
    // temprano: tipo desconocido, external_reference que no matchea un negocio).
    return res.status(200).json({ ok: true });
  } catch (err) {
    // Acá SÍ conviene que MP reintente: si fetchMP() falló (caída puntual de la API de MP)
    // o si activarPlan/suspenderPlan no pudo escribir en Firestore, devolver 200 igual
    // (como se hacía antes) le dice a MP "ya está, no hace falta que avises de nuevo" —
    // pero el cobro real nunca se refleja acá, y como MP no vuelve a avisar, ese pago queda
    // perdido para siempre sin ningún rastro. MP reintenta un webhook fallido con backoff
    // por un tiempo limitado (no "indefinidamente" de forma dañina), que es exactamente la
    // red de seguridad que hace falta para una falla transitoria.
    console.error('[Webhook MP] Error procesando notificación, MP va a reintentar:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

