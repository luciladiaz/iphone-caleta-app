import { adminDb } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

// URL base siempre apunta al dominio real de producción
const APP_URL = 'https://reventapp.com.ar';

// ReventApp pasó a un solo plan pago (antes básico/pro/pro max).
const PLANES_MP = {
  promax: { nombre: 'Plan Completo', monto: 29900 },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { plan, negocioId, email } = req.body || {};

  console.log('crear-suscripcion recibido:', { plan, negocioId, email: email || 'VACIO' });

  if (!plan || !negocioId || !email)
    return res.status(400).json({ error: 'Faltan datos: plan, negocioId, email' });

  if (!MP_ACCESS_TOKEN)
    return res.status(500).json({ error: 'MercadoPago no configurado en el servidor' });

  const planInfo = PLANES_MP[plan];
  if (!planInfo)
    return res.status(400).json({ error: `Plan inválido: ${plan}` });

  try {
    const mpBody = {
      reason: `ReventApp — ${planInfo.nombre}`,
      external_reference: `${negocioId}___${plan}`,
      payer_email: email,
      back_url: `${APP_URL}/planes?pago=exitoso`,
      notification_url: `${APP_URL}/api/webhook-mp`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: planInfo.monto,
        currency_id: 'ARS',
      },
      status: 'pending',
    };
    console.log('Enviando a MP:', JSON.stringify(mpBody));

    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mpBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP preapproval error:', JSON.stringify(data));
      return res.status(502).json({ error: `MP ${response.status}: ${data.message || data.error || JSON.stringify(data)}` });
    }

    // Guardar el preapprovalId en Firestore para poder verificar el pago después
    try {
      await adminDb.doc(`negocios/${negocioId}`).update({
        preapprovalId: data.id,
        planSolicitado: plan,
        ultimoCheckout: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('No se pudo guardar preapprovalId:', e.message);
    }

    return res.json({ init_point: data.init_point });
  } catch (err) {
    console.error('crear-suscripcion error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
