import { adminDb } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PLANES_VALIDOS = new Set(['basico', 'pro', 'promax']);

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
    ultimoPago: FieldValue.serverTimestamp(),
  });

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

async function logPagoRechazado(negocioId, mpId) {
  try {
    await adminDb.collection(`negocios/${negocioId}/pagos`).add({
      tipo: 'pago_rechazado_reintentando',
      estado: 'reintentando',
      mpId: mpId || 'test',
      fecha: FieldValue.serverTimestamp(),
    });
  } catch {}
  console.log(`[Webhook MP] ⏳ Pago rechazado, MP reintentando | negocio=${negocioId}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const testMode = req.headers['x-test-mode'];

  // ── MODO TEST: opera con Firebase Admin sin llamar a MercadoPago ───────────
  if (testMode === 'setup') {
    const { negocioId, data } = req.body || {};
    if (!negocioId) return res.status(400).json({ error: 'Falta negocioId' });
    await adminDb.doc(`negocios/${negocioId}`).set(data || {}, { merge: false });
    return res.status(200).json({ ok: true, action: 'setup', negocioId });
  }

  if (testMode === 'read') {
    const { negocioId } = req.body || {};
    if (!negocioId) return res.status(400).json({ error: 'Falta negocioId' });
    const snap = await adminDb.doc(`negocios/${negocioId}`).get();
    if (!snap.exists) return res.status(200).json({ exists: false });
    return res.status(200).json({ exists: true, data: snap.data() });
  }

  if (testMode === 'cleanup') {
    const { negocioIds } = req.body || {};
    for (const id of (negocioIds || [])) {
      await adminDb.doc(`negocios/${id}`).delete();
    }
    return res.status(200).json({ ok: true, action: 'cleanup', deleted: negocioIds });
  }

  if (testMode === 'true') {
    const { negocioId, status, plan } = req.body || {};
    if (!negocioId || !status) return res.status(400).json({ error: 'Falta negocioId o status' });

    if (status === 'approved' || status === 'authorized') {
      await activarPlan(negocioId, plan || 'pro', 'test');
    } else if (status === 'cancelled') {
      await suspenderPlan(negocioId, 'test');
    } else if (status === 'paused' || status === 'rejected') {
      await logPagoRechazado(negocioId, 'test');
    }

    return res.status(200).json({ ok: true, testMode: true, negocioId, status });
  }

  // ── HANDLER NORMAL (producción) ────────────────────────────────────────────
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
        // MP agotó todos los reintentos → suspender acceso
        await suspenderPlan(parsed.negocioId, data.id);
      }
    }

    // SIEMPRE responder 200 a MP — si respondemos 5xx, MP reintenta el webhook indefinidamente
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Webhook MP] Error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
