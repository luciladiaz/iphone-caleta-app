import { adminDb } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const DEMO_ID = 'demo-catalogo-reventapp';

const EQUIPOS_DEMO = [
  { modelo: 'iPhone 11',      gb: 64,  color: 'Rojo',           bateria: 78,  pvUsd: 210, estado: 'disponible' },
  { modelo: 'iPhone 12',      gb: 64,  color: 'Blanco',         bateria: 82,  pvUsd: 320, estado: 'disponible' },
  { modelo: 'iPhone 13',      gb: 128, color: 'Negro',          bateria: 89,  pvUsd: 450, estado: 'disponible' },
  { modelo: 'iPhone 14 Pro',  gb: 256, color: 'Morado oscuro',  bateria: 95,  pvUsd: 780, estado: 'disponible' },
  { modelo: 'iPhone 15',      gb: 128, color: 'Azul',           bateria: 100, pvUsd: 650, estado: 'disponible' },
];

export default async function handler(req, res) {
  // Si CRON_SECRET no está seteado, el endpoint queda cerrado para todos, nunca
  // abierto por default.
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secretValido = !!process.env.CRON_SECRET &&
    (authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET);
  if (!secretValido) return res.status(401).json({ error: 'No autorizado' });

  try {
    await adminDb.doc(`negocios/${DEMO_ID}`).set({
      nombre: 'ReventApp Demo',
      ownerUid: DEMO_ID,
      negocioId: DEMO_ID,
      plan: 'promax',
      estado: 'activo',
      esDemo: true,
      creadoEn: FieldValue.serverTimestamp(),
    }, { merge: true });

    await adminDb.doc(`negocios/${DEMO_ID}/config/general`).set({
      tipoCambio: 1430,
    }, { merge: true });

    const stockRef = adminDb.collection(`negocios/${DEMO_ID}/stock`);
    const existentes = await stockRef.get();
    if (existentes.empty) {
      const batch = adminDb.batch();
      for (const eq of EQUIPOS_DEMO) {
        batch.set(stockRef.doc(), eq);
      }
      await batch.commit();
    }

    return res.status(200).json({ ok: true, negocioId: DEMO_ID, equipos: EQUIPOS_DEMO.length, yaExistia: !existentes.empty });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
