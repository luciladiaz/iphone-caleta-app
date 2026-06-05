const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, data } = req.body;

  if (type !== 'payment') return res.status(200).end();

  try {
    // Obtener detalles del pago desde MP
    const pagoRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const pago = await pagoRes.json();

    if (pago.status !== 'approved') return res.status(200).end();

    const negocioId = pago.external_reference;
    const plan = pago.additional_info?.items?.[0]?.title?.includes('Pro') ? 'pro' : 'basico';

    // Actualizar Firestore via REST API (sin SDK en serverless)
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'app-iphone-61c85';
    const vence = new Date();
    vence.setDate(vence.getDate() + 30);

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/suscripciones/${negocioId}`;

    await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          plan: { stringValue: plan },
          estado: { stringValue: 'activo' },
          vence: { timestampValue: vence.toISOString() },
          pagoId: { stringValue: String(data.id) },
          monto: { doubleValue: pago.transaction_amount },
        }
      }),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).end();
  }
}
