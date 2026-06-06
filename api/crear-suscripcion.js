const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL || 'https://iphone-caleta-app.vercel.app';

const PLANES_MP = {
  basico:  { nombre: 'Plan Básico',   monto: 7900  },
  pro:     { nombre: 'Plan Pro',      monto: 14900 },
  promax:  { nombre: 'Plan Pro Max',  monto: 29900 },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { plan, negocioId, email } = req.body || {};

  if (!plan || !negocioId || !email)
    return res.status(400).json({ error: 'Faltan datos: plan, negocioId, email' });

  if (!MP_ACCESS_TOKEN)
    return res.status(500).json({ error: 'MercadoPago no configurado en el servidor' });

  const planInfo = PLANES_MP[plan];
  if (!planInfo)
    return res.status(400).json({ error: `Plan inválido: ${plan}. Valores permitidos: basico, pro, promax` });

  try {
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: `RevendApp — ${planInfo.nombre}`,
        // negocioId___plan — el webhook lo parsea para saber qué actualizar
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
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP preapproval error:', JSON.stringify(data));
      return res.status(502).json({ error: 'Error al crear suscripción en MercadoPago' });
    }

    return res.json({ init_point: data.init_point });
  } catch (err) {
    console.error('crear-suscripcion error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
