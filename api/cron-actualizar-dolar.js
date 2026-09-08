import { adminDb } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

// Endpoints de dolarapi.com por tipo
const ENDPOINTS = {
  blue:    'blue',
  oficial: 'oficial',
  mep:     'bolsa',
};

async function fetchCotizacion(tipo) {
  const endpoint = ENDPOINTS[tipo];
  if (!endpoint) return null;
  const res = await fetch(`https://dolarapi.com/v1/dolares/${endpoint}`);
  if (!res.ok) throw new Error(`dolarapi ${res.status} para ${tipo}`);
  const data = await res.json();
  return data.venta;
}

// Respaldo de suscripciones canceladas cuya notificación nunca llegó (confirmado que
// pasa: el webhook subscription_preapproval puede no llegar). Sin esto, un negocio
// sigue con acceso pago hasta que venza vencePlan solo, aunque MP ya haya dejado de
// cobrarle de verdad -- hasta 31 días de acceso sin pagar.
//
// Corta acceso en dos casos:
// 1) status === 'cancelled' -- igual que procesarCancelacion() en webhook-mp.js.
// 2) status === 'paused' CON los 4 intentos de cobro ya agotados -- confirmado en vivo
//    (07/09/2026) que MP puede dejar una suscripción en "paused" indefinidamente después
//    de agotar los reintentos, sin pasarla nunca a "cancelled" como decía la
//    documentación. Sin este segundo caso, esas suscripciones quedan con acceso pago
//    para siempre porque ningún mecanismo (ni el webhook, ni este chequeo) reacciona a
//    "paused" solo. Se confirma "agotado" consultando authorized_payments/search y
//    viendo si algún intento llegó a retry_attempt 4 -- así nunca se corta a alguien en
//    medio de un reintento legítimo (paused con menos de 4 intentos).
// Nunca corta si el negocio ya se auto-canceló desde la app (renovacionAutomatica ===
// false es un estado válido e intencional aparte, con su propio período de gracia hasta
// vencePlan).
const MAX_INTENTOS_COBRO = 4;

async function intentosAgotados(preapprovalId) {
  const r = await fetch(`https://api.mercadopago.com/authorized_payments/search?preapproval_id=${preapprovalId}`, {
    headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!r.ok) return false;
  const data = await r.json();
  const maxIntento = (data.results || []).reduce((max, f) => Math.max(max, f.retry_attempt || 0), 0);
  return maxIntento >= MAX_INTENTOS_COBRO;
}

async function verificarSuscripcionesActivas() {
  if (!MP_ACCESS_TOKEN) return { revisadas: 0, cortadas: [] };

  const snap = await adminDb.collection('negocios')
    .where('plan', '==', 'promax')
    .where('estado', '==', 'activo')
    .get();

  const cortadas = [];
  for (const doc of snap.docs) {
    const n = doc.data();
    if (!n.preapprovalId || n.renovacionAutomatica === false) continue;

    try {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${n.preapprovalId}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
      });
      if (!r.ok) continue;
      const sub = await r.json();

      const debeCortar = sub.status === 'cancelled'
        || (sub.status === 'paused' && await intentosAgotados(n.preapprovalId));

      if (debeCortar) {
        await doc.ref.update({
          estado: 'suspendido',
          motivoSuspension: 'pago_fallido',
          fechaSuspension: FieldValue.serverTimestamp(),
        });
        cortadas.push(n.nombre || doc.id);
      }
    } catch (e) {
      console.warn(`[cron-dolar] No se pudo verificar suscripción de ${doc.id}:`, e.message);
    }
  }

  return { revisadas: snap.size, cortadas };
}

export default async function handler(req, res) {
  // Acepta el secreto por header (Vercel cron) o por query param (cron-job.org u otros
  // servicios externos). Si CRON_SECRET no está seteado, el endpoint queda cerrado para
  // todos, nunca abierto por default.
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secretValido = !!process.env.CRON_SECRET &&
    (authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET);
  if (!secretValido) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const ahora = new Date().toISOString();

    // Obtener todas las cotizaciones de una vez
    const [blue, oficial, mep] = await Promise.allSettled([
      fetchCotizacion('blue'),
      fetchCotizacion('oficial'),
      fetchCotizacion('mep'),
    ]);

    const cotizaciones = {
      blue:    blue.status    === 'fulfilled' ? blue.value    : null,
      oficial: oficial.status === 'fulfilled' ? oficial.value : null,
      mep:     mep.status     === 'fulfilled' ? mep.value     : null,
    };

    console.log('[cron-dolar] Cotizaciones obtenidas:', cotizaciones);

    // Leer todos los negocios
    const negociosSnap = await adminDb.collection('negocios').get();
    const batch = adminDb.batch();
    let actualizados = 0;

    for (const negDoc of negociosSnap.docs) {
      const negocioId = negDoc.id;
      const cfgRef = adminDb.doc(`negocios/${negocioId}/config/general`);

      let cfgSnap;
      try { cfgSnap = await cfgRef.get(); } catch { continue; }

      const cfg = cfgSnap.data() || {};
      const tipoDolar = cfg.tipoDolar || 'blue';

      // Saltar negocios con tipo manual
      if (tipoDolar === 'manual') continue;

      const nuevaCotizacion = cotizaciones[tipoDolar];
      if (!nuevaCotizacion) continue;

      batch.set(cfgRef, {
        tipoCambio: nuevaCotizacion,
        ultimaActualizacionTC: ahora,
      }, { merge: true });

      actualizados++;
    }

    await batch.commit();

    console.log(`[cron-dolar] ✅ ${actualizados} negocios actualizados a las ${ahora}`);

    // Aislado en su propio try/catch: si esto falla, no debe afectar el resultado ya
    // confirmado de la actualización de cotizaciones de arriba.
    let suscripciones = { revisadas: 0, cortadas: [] };
    try {
      suscripciones = await verificarSuscripcionesActivas();
      if (suscripciones.cortadas.length > 0) {
        console.log(`[cron-dolar] 🔒 Suscripciones cortadas por cancelación no notificada: ${suscripciones.cortadas.join(', ')}`);
      }
    } catch (e) {
      console.error('[cron-dolar] Error verificando suscripciones:', e.message);
    }

    return res.status(200).json({ ok: true, actualizados, cotizaciones, ahora, suscripciones });
  } catch (err) {
    console.error('[cron-dolar] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
