import { adminDb, usuarioDeRequest } from './_firebase.js';
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

  const { plan, negocioId, email, cardTokenId } = req.body || {};

  console.log('crear-suscripcion recibido:', { plan, negocioId, email: email || 'VACIO', cardTokenId: cardTokenId ? 'OK' : 'FALTA' });

  if (!plan || !negocioId || !email || !cardTokenId)
    return res.status(400).json({ error: 'Faltan datos: plan, negocioId, email, cardTokenId' });

  // El negocioId es visible en cualquier link de catálogo público, así que no alcanza
  // con que el cliente lo mande — hay que confirmar que quien llama es realmente dueño
  // de ese negocio antes de tocar nada.
  const usuario = await usuarioDeRequest(req);
  if (!usuario || usuario.negocioId !== negocioId)
    return res.status(403).json({ error: 'No autorizado para este negocio' });

  if (!MP_ACCESS_TOKEN)
    return res.status(500).json({ error: 'MercadoPago no configurado en el servidor' });

  const planInfo = PLANES_MP[plan];
  if (!planInfo)
    return res.status(400).json({ error: `Plan inválido: ${plan}` });

  try {
    const mpBody = {
      // Ojo: antes tenía un guión largo "—" (em dash, no un guión común "-"). La API de
      // Mercado Pago viene rechazando la creación de la suscripción con un 400 genérico
      // "Parameters passed are invalid" para TODOS los clientes — se reprodujo en vivo
      // contra la API real y se aisló a este campo. Con texto simple (sin ese carácter)
      // la misma llamada, con el mismo token y los mismos datos, sí funciona.
      reason: `ReventApp - ${planInfo.nombre}`,
      // Antes era fijo (negocioId + plan), así que un reintento del mismo cliente sobre el
      // mismo plan mandaba SIEMPRE el mismo external_reference a MP — soporte de MP señaló
      // que eso puede leerse como intentos "idénticos" y activar el motor antifraude
      // (cc_rejected_high_risk). Se agrega un timestamp para que cada intento de alta sea
      // único. parsearRef() en webhook-mp.js solo lee los primeros dos segmentos (split por
      // '___', destructuring [negocioId, plan]), así que el tercero no le afecta.
      external_reference: `${negocioId}___${plan}___${Date.now()}`,
      payer_email: email,
      card_token_id: cardTokenId,
      back_url: `${APP_URL}/planes?pago=exitoso`,
      notification_url: `${APP_URL}/api/webhook-mp`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        // "new Date()" queda justo en el límite: para cuando la request llega a MP y la
        // valida, ya pasaron unos segundos y la rechaza como fecha pasada (error real
        // reproducido: "invalid value for auto_recurring.start_date, cannot be a past
        // date"). Se le da un colchón de 10 minutos para absorber esa latencia.
        start_date: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        transaction_amount: planInfo.monto,
        currency_id: 'ARS',
      },
      // Antes quedaba "pending" y el cliente terminaba de cargar la tarjeta en el
      // checkout hosteado de Mercado Pago — ahí es donde venía fallando con "el negocio
      // no acepta el medio de pago" sin llegar nunca a generar un pago. Con la tarjeta
      // ya tokenizada acá (card_token_id) se puede crear directamente autorizada: MP
      // valida la tarjeta en el momento (hace un cobro mínimo de prueba y lo devuelve).
      status: 'authorized',
    };
    console.log('Enviando a MP:', JSON.stringify({ ...mpBody, card_token_id: 'OK' }));

    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        // Evita que un reintento de red (ej: el cliente pierde conexión justo después de
        // que MP ya procesó la creación) termine creando dos suscripciones duplicadas
        // para el mismo intento.
        'X-Idempotency-Key': cardTokenId,
      },
      body: JSON.stringify(mpBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP preapproval error:', JSON.stringify(data));
      return res.status(502).json({ error: `MP ${response.status}: ${data.message || data.error || JSON.stringify(data)}` });
    }

    // Guardar el preapprovalId en Firestore para poder verificar el pago después. El
    // webhook (webhook-mp.js) es quien activa el plan de verdad cuando MP confirma la
    // autorización — esto es solo para poder rastrear el intento.
    try {
      await adminDb.doc(`negocios/${negocioId}`).update({
        preapprovalId: data.id,
        planSolicitado: plan,
        ultimoCheckout: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('No se pudo guardar preapprovalId:', e.message);
    }

    return res.json({ ok: true, status: data.status, preapprovalId: data.id });
  } catch (err) {
    console.error('crear-suscripcion error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
