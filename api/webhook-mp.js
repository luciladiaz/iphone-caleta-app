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

async function activarPlan(negocioId, plan) {
  // 31 días: el mes siguiente tiene un día de gracia para que el webhook llegue antes del bloqueo
  const vencePlan = new Date();
  vencePlan.setDate(vencePlan.getDate() + 31);

  await adminDb.doc(`negocios/${negocioId}`).update({
    plan,
    estado: 'activo',
    vencePlan,
    ultimoPago: FieldValue.serverTimestamp(),
  });

  console.log(`[Webhook MP] ✅ Plan ${plan} activado | negocio=${negocioId} | vence=${vencePlan.toISOString()}`);
}

async function desactivarPlan(negocioId, motivo) {
  await adminDb.doc(`negocios/${negocioId}`).update({
    estado: 'inactivo',
  });

  console.log(`[Webhook MP] 🔒 Plan desactivado | negocio=${negocioId} | motivo=${motivo}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, data } = req.body || {};
  if (!type || !data?.id) return res.status(200).json({ ok: true, msg: 'Notificación ignorada' });

  console.log(`[Webhook MP] Recibido: type=${type} id=${data.id}`);

  try {
    // ── Pago individual (cobro mensual de la suscripción) ──────────────────
    if (type === 'payment') {
      const pago = await fetchMP(`/v1/payments/${data.id}`);
      const parsed = parsearRef(pago.external_reference);

      if (!parsed) {
        console.log(`[Webhook MP] Pago ${data.id} sin referencia válida — ignorado`);
        return res.status(200).json({ ok: true });
      }

      if (pago.status === 'approved') {
        // Pago exitoso → activar/renovar plan por 31 días más
        await activarPlan(parsed.negocioId, parsed.plan);
      } else {
        // rejected, in_process, etc. → no hacemos nada.
        // vencePlan ya existente expira solo → bloqueo automático.
        console.log(`[Webhook MP] Pago ${data.id} status=${pago.status} — sin acción`);
      }
    }

    // ── Cambio de estado de la suscripción (cancelada, pausada) ───────────
    if (type === 'subscription_preapproval') {
      const sub = await fetchMP(`/preapproval/${data.id}`);
      const parsed = parsearRef(sub.external_reference);

      if (!parsed) {
        console.log(`[Webhook MP] Suscripción ${data.id} sin referencia válida — ignorada`);
        return res.status(200).json({ ok: true });
      }

      if (sub.status === 'cancelled' || sub.status === 'paused') {
        // Cliente canceló o MP canceló por cobros fallidos repetidos
        await desactivarPlan(parsed.negocioId, sub.status);
      } else if (sub.status === 'authorized') {
        // Suscripción reactivada (e.g., cliente actualizó tarjeta)
        await activarPlan(parsed.negocioId, parsed.plan);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Webhook MP] Error:', err.message);
    // Devolvemos 500 para que MP reintente el webhook
    return res.status(500).end();
  }
}
