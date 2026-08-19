import { adminDb } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PLANES_VALIDOS = new Set(['promax']); // ReventApp: un solo plan pago

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

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

    // SIEMPRE responder 200 a MP — si respondemos 5xx, MP reintenta el webhook indefinidamente
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Webhook MP] Error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}

