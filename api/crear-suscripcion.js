import { adminDb, usuarioDeRequest } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { limitado } from './_rateLimit.js';

// .trim() defiende contra un espacio o salto de línea de más al pegar el valor en
// Vercel -- eso rompe el header Authorization con un 401 "Unauthorized access to
// resource" sin ninguna pista de que el problema es solo whitespace.
const MP_ACCESS_TOKEN = (process.env.MP_ACCESS_TOKEN || '').trim() || undefined;

// URL base siempre apunta al dominio real de producción
const APP_URL = 'https://reventapp.com.ar';

// ReventApp pasó a un solo plan pago (antes básico/pro/pro max).
const PLANES_MP = {
  promax: { nombre: 'Plan Completo', monto: 29900 },
};

// Mapeo oficial de motivos de rechazo de tarjeta a mensajes accionables -- misma lista
// que usa el propio plugin de Mercado Pago (github.com/mercadopago/cart-magento2,
// StatusDetailMessage.php), traducida. Se usa SOLO para dar mejor mensaje cuando
// data.cause trae uno de estos códigos; si no matchea ninguno, cae al mensaje genérico
// de siempre más abajo -- no reemplaza ni arriesga el manejo existente de CC_VAL_433.
const MOTIVOS_RECHAZO = {
  cc_rejected_bad_filled_card_number: 'Revisá que el número de tarjeta esté bien escrito.',
  cc_rejected_bad_filled_date: 'Revisá la fecha de vencimiento de la tarjeta.',
  cc_rejected_bad_filled_other: 'Revisá que los datos de la tarjeta estén completos y correctos.',
  cc_rejected_bad_filled_security_code: 'Revisá el código de seguridad (CVV) de la tarjeta.',
  cc_rejected_blacklist: 'No pudimos procesar el pago con esta tarjeta. Probá con otra.',
  cc_rejected_call_for_authorize: 'Tu banco necesita que autorices este pago vos mismo/a. Llamá al número que figura al dorso de tu tarjeta y autorizá el pago a Mercado Pago.',
  cc_rejected_card_disabled: 'Tu tarjeta no está habilitada para pagos online. Llamá al número que figura al dorso de tu tarjeta para activarla.',
  cc_rejected_card_error: 'No pudimos procesar el pago con esta tarjeta. Probá con otra o contactanos por WhatsApp.',
  cc_rejected_duplicated_payment: 'Ya se registró un intento de pago por este monto hace instantes. Si necesitás repetirlo, usá otra tarjeta.',
  cc_rejected_high_risk: 'Mercado Pago rechazó la validación de la tarjeta por seguridad (riesgo alto). Esperá un rato antes de reintentar, o probá con otra tarjeta.',
  cc_rejected_insufficient_amount: 'La tarjeta no tiene saldo o límite disponible suficiente para esta operación.',
  cc_rejected_invalid_installments: 'Esta tarjeta no admite el pago en la cantidad de cuotas configurada.',
  cc_rejected_max_attempts: 'Llegaste al límite de intentos permitidos con esta tarjeta. Probá con otra tarjeta más tarde.',
  cc_rejected_other_reason: 'Tu banco no autorizó el pago. Contactá a tu banco para más info, o probá con otra tarjeta.',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Este es justo el endpoint más expuesto al motor antifraude de MP (CC_VAL_433, ver
  // comentario más abajo) -- MP lo dispara por reintentos repetidos en poco tiempo, así
  // que limitar los intentos acá de nuestro lado ayuda a evitar disparar esa alarma en
  // primer lugar, además de frenar abuso liso y llano.
  if (limitado(req, { ventanaMs: 10 * 60_000, maximo: 8 })) {
    return res.status(429).json({ error: 'Demasiados intentos seguidos. Esperá unos minutos antes de reintentar.' });
  }

  const { plan, negocioId, email, cardTokenId, tokenMeta } = req.body || {};

  console.log('crear-suscripcion recibido:', { plan, negocioId, email: email || 'VACIO', cardTokenId: cardTokenId ? 'OK' : 'FALTA' });
  // Metadata del token (BIN, últimos 4, longitud de CVV, luhn_validation, status) -- nunca
  // el número completo ni el CVV en sí. Sirve para diagnosticar sin especular si un pago
  // rebota con "token generado sin validación de CVV".
  if (tokenMeta) console.log('[crear-suscripcion] Token metadata:', JSON.stringify(tokenMeta));

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
      // Sin start_date: MP cobra la primera cuota de inmediato al autorizar la
      // suscripción, y desde ahí repite cada mes. Antes se mandaba un start_date 10
      // minutos en el futuro (para esquivar el error "cannot be a past date") y eso
      // hacía que el primer cobro real recién se programara para un mes después de
      // alta -- entre eso y los 7 días de trial, un cliente nuevo tenía 37 días
      // gratis antes de que se le cobrara la primera cuota real.
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
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

    const headers = {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      // Evita que un reintento de red (ej: el cliente pierde conexión justo después de
      // que MP ya procesó la creación) termine creando dos suscripciones duplicadas
      // para el mismo intento.
      'X-Idempotency-Key': cardTokenId,
    };

    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers,
      body: JSON.stringify(mpBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP preapproval error:', JSON.stringify(data));

      // DIAGNÓSTICO TEMPORAL -- borrar apenas se resuelva el caso de "sin validación de
      // CVV". Consulta la metadata real del token contra la API de MP (BIN, últimos 4,
      // longitud de CVV, luhn_validation) para confirmar si el emisor validó el CVV o no,
      // en vez de especular. No expone el PAN completo ni el CVV.
      if (data.message === 'Card token was generated without cvv validation') {
        try {
          const rInfo = await fetch(`https://api.mercadopago.com/v1/card_tokens/${cardTokenId}`, {
            headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
          });
          const tokenInfo = await rInfo.json();
          console.log('[DEBUG] Token sin CVV -- metadata completa:', JSON.stringify(tokenInfo));
        } catch (e) {
          console.error('[DEBUG] No se pudo consultar el token:', e.message);
        }
      }

      // CC_VAL_433 es el código genérico que devuelve el motor antifraude de MP
      // (equivalente a cc_rejected_high_risk) sin más detalle en el body -- confirmado
      // en este mismo caso: no trae data.cause. No es un dato mal formado de nuestro
      // lado (el body ya se verificó contra la documentación oficial campo por campo);
      // MP lo dispara típicamente por reintentos repetidos con el mismo comprador/
      // tarjeta en poco tiempo. Se le da un mensaje accionable en vez del genérico de MP.
      if (data.message === 'CC_VAL_433' || data.error === 'CC_VAL_433') {
        return res.status(502).json({
          error: 'Mercado Pago rechazó la validación de la tarjeta por seguridad (riesgo alto). ' +
            'Esto suele pasar tras varios intentos seguidos con la misma tarjeta. Esperá al menos ' +
            'un rato antes de reintentar, o probá con otra tarjeta. Si persiste, contactanos por WhatsApp.',
        });
      }

      // Si data.cause trae alguno de los 14 motivos oficiales de rechazo, usar el
      // mensaje traducido y accionable en vez del código crudo de MP.
      const causaConocida = Array.isArray(data.cause) && data.cause.find((c) => MOTIVOS_RECHAZO[c.code]);
      if (causaConocida) {
        return res.status(502).json({ error: MOTIVOS_RECHAZO[causaConocida.code] });
      }

      // data.cause trae el detalle real (código + descripción específica) que MP no
      // pone en el mensaje principal -- sin esto veníamos a ciegas frente a errores
      // genéricos como "Credit card validation has failed".
      const causa = Array.isArray(data.cause) && data.cause.length
        ? ' | causa: ' + data.cause.map((c) => `${c.code}:${c.description}`).join(', ')
        : '';
      return res.status(502).json({ error: `MP ${response.status}: ${data.message || data.error || JSON.stringify(data)}${causa}` });
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
