import { adminDb } from './_firebase.js';

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

export default async function handler(req, res) {
  // Acepta el secreto por header (Vercel cron) o por query param (cron-job.org u otros servicios externos)
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secretValido = !process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
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
    return res.status(200).json({ ok: true, actualizados, cotizaciones, ahora });
  } catch (err) {
    console.error('[cron-dolar] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
