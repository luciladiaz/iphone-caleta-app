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
// sigue con acceso pago hasta que venza vencePlan solo, aunque MP ya haya cancelado la
// suscripción de verdad -- hasta 31 días de acceso sin pagar. Replica EXACTO el mismo
// criterio que procesarCancelacion() en webhook-mp.js: solo corta acceso si MP dice
// "cancelled" (nunca por "paused", que es solo un reintento en curso -- no hay que
// bloquear por un cobro fallido aislado) y nunca si el negocio ya se auto-canceló desde
// la app (renovacionAutomatica === false es un estado válido e intencional aparte, con
// su propio período de gracia hasta vencePlan).
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

      if (sub.status === 'cancelled') {
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
