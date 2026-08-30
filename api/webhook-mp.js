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

async function activarPlan(negocioId, plan, mpId) {
  const vencePlan = new Date();
  vencePlan.setDate(vencePlan.getDate() + 31);

  await adminDb.doc(`negocios/${negocioId}`).update({
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

async function logPagoRechazado(negocioId, mpId) {
  try {
    await adminDb.collection(`negocios/${negocioId}/pagos`).add({
      tipo: 'pago_rechazado_reintentando',
      estado: 'reintentando',
      mpId: mpId || 'test',
      fecha: FieldValue.serverTimestamp(),
    });
  } catch (err) { console.error('[Webhook MP] Error logueando pago rechazado:', err); }
  console.log(`[Webhook MP] ⏳ Pago rechazado, MP reintentando | negocio=${negocioId}`);
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
        await logPagoRechazado(parsed.negocioId, data.id);
      } else if (pago.status === 'refunded' || pago.status === 'charged_back') {
        await procesarReembolso(parsed.negocioId, data.id);
      }
    }

    // Cambio de estado de la suscripción
    if (type === 'subscription_preapproval') {
      const sub = await fetchMP(`/preapproval/${data.id}`);
      const parsed = parsearRef(sub.external_reference);
      if (!parsed) return res.status(200).json({ ok: true });

      if (sub.status === 'authorized') {
        // Suscripción activa/reactivada (cliente actualizó tarjeta, etc.)
        await activarPlan(parsed.negocioId, parsed.plan, data.id);
      } else if (sub.status === 'paused') {
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

