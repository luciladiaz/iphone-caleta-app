const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL || 'https://iphone-caleta-app.vercel.app';

const PRECIOS = { basico: 7900, pro: 14900 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { plan, negocioId, email } = req.body;

  if (!plan || !negocioId || !email) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'MercadoPago no configurado' });
  }

  const preference = {
    items: [{
      title: `iPhone Caleta App — Plan ${plan === 'pro' ? 'Pro' : 'Básico'}`,
      quantity: 1,
      currency_id: 'ARS',
      unit_price: PRECIOS[plan] || PRECIOS.basico,
    }],
    payer: { email },
    external_reference: negocioId,
    notification_url: `${APP_URL}/api/webhook-mp`,
    back_urls: {
      success: `${APP_URL}/?pago=exitoso`,
      failure: `${APP_URL}/planes?pago=fallido`,
      pending: `${APP_URL}/planes?pago=pendiente`,
    },
    auto_return: 'approved',
    statement_descriptor: 'iPhone Caleta App',
  };

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP error:', data);
      return res.status(500).json({ error: 'Error al crear preferencia de pago' });
    }

    res.json({ init_point: data.init_point, sandbox_init_point: data.sandbox_init_point });
  } catch (err) {
    console.error('Error MercadoPago:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
