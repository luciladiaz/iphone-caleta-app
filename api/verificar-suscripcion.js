import { adminDb } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PLANES_VALIDOS = new Set(['basico', 'pro', 'promax']);

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
    tipo: 'plan_activado_verificacion',
    plan,
    estado: 'exitoso',
    mpId: mpId || 'verificacion',
    fecha: FieldValue.serverTimestamp(),
  });

  console.log(`[verificar-suscripcion] ✅ Plan ${plan} activado | negocio=${negocioId}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { negocioId } = req.body || {};
  if (!negocioId) return res.status(400).json({ error: 'Falta negocioId' });

  try {
    // Leer el preapprovalId guardado en Firestore cuando se inició el checkout
    const negSnap = await adminDb.doc(`negocios/${negocioId}`).get();
    if (!negSnap.exists) return res.status(404).json({ error: 'Negocio no encontrado' });

    const negData = negSnap.data();
    const preapprovalId = negData.preapprovalId;
    const planSolicitado = negData.planSolicitado;

    if (!preapprovalId) {
      return res.status(200).json({ activado: false, motivo: 'Sin preapprovalId' });
    }

    if (!PLANES_VALIDOS.has(planSolicitado)) {
      return res.status(200).json({ activado: false, motivo: 'Plan inválido' });
    }

    // Consultar estado real de la suscripción en MP
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!mpRes.ok) {
      const err = await mpRes.text();
      console.error('[verificar-suscripcion] Error MP:', err);
      return res.status(200).json({ activado: false, motivo: `MP ${mpRes.status}` });
    }

    const sub = await mpRes.json();
    console.log(`[verificar-suscripcion] negocio=${negocioId} status=${sub.status} plan=${planSolicitado}`);

    if (sub.status === 'authorized') {
      // Ya lo activó el webhook → verificar si ya está activo en Firestore
      if (negData.plan === planSolicitado && negData.estado === 'activo') {
        return res.status(200).json({ activado: true, yaEstaba: true });
      }
      // El webhook falló → activar ahora como respaldo
      await activarPlan(negocioId, planSolicitado, preapprovalId);
      return res.status(200).json({ activado: true, fuente: 'verificacion_respaldo' });
    }

    return res.status(200).json({ activado: false, status: sub.status });
  } catch (err) {
    console.error('[verificar-suscripcion] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
