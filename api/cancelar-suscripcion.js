import { adminDb, usuarioDeRequest } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const APP_URL = 'https://reventapp.com.ar';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { negocioId } = req.body || {};
  if (!negocioId) return res.status(400).json({ error: 'Falta negocioId' });
  if (!MP_ACCESS_TOKEN) return res.status(500).json({ error: 'MercadoPago no configurado en el servidor' });

  // El negocioId es visible en cualquier link de catálogo público, así que no alcanza
  // con que el cliente lo mande — sin esto, cualquiera podía cancelarle la suscripción
  // paga a otro negocio con solo saber su negocioId.
  const usuario = await usuarioDeRequest(req);
  if (!usuario || usuario.negocioId !== negocioId)
    return res.status(403).json({ error: 'No autorizado para este negocio' });

  try {
    const negSnap = await adminDb.doc(`negocios/${negocioId}`).get();
    if (!negSnap.exists) return res.status(404).json({ error: 'Negocio no encontrado' });

    const negData = negSnap.data();
    const preapprovalId = negData.preapprovalId;
    if (!preapprovalId) return res.status(400).json({ error: 'No encontramos una suscripción activa para cancelar' });

    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    if (!mpRes.ok) {
      const err = await mpRes.text();
      console.error('[cancelar-suscripcion] Error MP:', err);
      return res.status(502).json({ error: 'No pudimos cancelar la suscripción en MercadoPago. Intentá de nuevo o contactanos por WhatsApp.' });
    }

    // No tocamos estado ni vencePlan: el acceso sigue activo hasta la fecha ya pagada.
    // renovacionAutomatica=false le dice al webhook que no vuelva a suspender de golpe
    // cuando MP notifique la cancelación (ver webhook-mp.js).
    await adminDb.doc(`negocios/${negocioId}`).update({
      renovacionAutomatica: false,
      fechaCancelacion: FieldValue.serverTimestamp(),
    });

    await adminDb.collection(`negocios/${negocioId}/pagos`).add({
      tipo: 'suscripcion_cancelada_por_usuario',
      estado: 'cancelado_voluntario',
      mpId: preapprovalId,
      fecha: FieldValue.serverTimestamp(),
    });

    console.log(`[cancelar-suscripcion] Cancelada por el usuario | negocio=${negocioId} | preapproval=${preapprovalId}`);

    return res.status(200).json({ ok: true, vencePlan: negData.vencePlan || null });
  } catch (err) {
    console.error('[cancelar-suscripcion] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
