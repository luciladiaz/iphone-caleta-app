import { adminDb } from './_firebase.js';
import { limitado } from './_rateLimit.js';

// Endpoint público (sin login) para el catálogo compartible. Antes CatalogoPublico.jsx
// leía la colección `stock` entera directo desde el cliente con el SDK de Firestore —
// eso mandaba al navegador de CUALQUIERA (autenticado o no) el documento completo de
// cada equipo, costoUsd, IMEI, proveedor y el nombre/teléfono de clientes que entregaron
// un equipo como parte de pago incluidos, sin importar que la interfaz solo mostrara
// unos pocos campos. Firestore no permite exponer "algunos campos sí, otros no" de un
// documento vía reglas, así que la única forma correcta es armar la respuesta acá, a
// mano, con el Admin SDK (que no depende de las reglas) y devolver SOLO lo que un
// cliente necesita ver.
export default async function handler(req, res) {
  if (limitado(req, { ventanaMs: 60_000, maximo: 60 })) {
    return res.status(429).json({ error: 'Demasiados pedidos. Probá de nuevo en un minuto.' });
  }

  const negocioId = req.query?.negocioId;
  if (!negocioId) return res.status(400).json({ error: 'Falta negocioId' });

  try {
    const base = `negocios/${negocioId}`;
    const [negSnap, infoSnap, cfgSnap, stockSnap] = await Promise.all([
      adminDb.doc(base).get(),
      adminDb.doc(`${base}/publico/info`).get(),
      adminDb.doc(`${base}/config/general`).get(),
      adminDb.collection(`${base}/stock`).where('estado', '==', 'disponible').get(),
    ]);

    if (!infoSnap.exists) return res.status(404).json({ error: 'Negocio no encontrado' });

    // El catálogo público es una feature del plan pago -- antes esto no se chequeaba acá,
    // así que un negocio con el trial vencido o la cuenta suspendida/cancelada seguía
    // teniendo su catálogo funcionando indefinidamente (stock y precios reales incluidos)
    // aunque ya no pudiera entrar a la app. Misma lógica de "¿está activo?" que usa
    // AuthContext.jsx en el cliente, replicada acá porque este endpoint no pasa por ahí.
    const neg = negSnap.data() || {};
    const rawPlan = neg.plan || 'trial';
    let planActivo = true;
    if (rawPlan === 'trial') {
      if (neg.venceTrial) {
        const vence = neg.venceTrial?.toDate?.() || new Date(neg.venceTrial);
        planActivo = vence > new Date();
      } else {
        // Un negocio en trial siempre nace con venceTrial. Si falta, es un dato
        // roto/editado a mano -- no regalar catálogo público indefinido.
        planActivo = false;
      }
    } else if (neg.estado === 'suspendido') {
      planActivo = false;
    } else if (neg.vencePlan) {
      const vence = neg.vencePlan?.toDate?.() || new Date(neg.vencePlan);
      planActivo = neg.estado === 'activo' && vence > new Date();
    } else {
      planActivo = neg.estado !== 'inactivo';
    }
    if (!planActivo) return res.status(404).json({ error: 'Negocio no encontrado' });

    const info = infoSnap.data() || {};
    const cfg = cfgSnap.data() || {};
    const equipos = stockSnap.docs.map(d => {
      const e = d.data();
      return {
        id: d.id,
        categoria: e.categoria || '',
        modelo: e.modelo || '',
        gb: e.gb || '',
        color: e.color || '',
        bateria: e.bateria || '',
        pvUsd: e.pvUsd || 0,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      negocio: { nombre: info.nombre || '', plan: info.plan || '', telefono: info.telefono || '', logoUrl: info.logoUrl || '' },
      tipoCambio: cfg.tipoCambio || 0,
      listaCanje: cfg.listaCanje || [],
      equipos,
    });
  } catch (err) {
    console.error('[catalogo] Error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
