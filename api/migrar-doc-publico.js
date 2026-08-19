import { adminDb } from './_firebase.js';

export default async function handler(req, res) {
  // Si CRON_SECRET no está seteado en el entorno, este endpoint queda cerrado para
  // todos (nunca "abierto por default") — antes, sin la variable configurada, cualquiera
  // podía llamarlo sin clave.
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secretValido = !!process.env.CRON_SECRET &&
    (authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET);
  if (!secretValido) return res.status(401).json({ error: 'No autorizado' });

  try {
    const snap = await adminDb.collection('negocios').get();
    const batch = adminDb.batch();
    let migrados = 0;

    for (const doc of snap.docs) {
      const n = doc.data();
      batch.set(adminDb.doc(`negocios/${doc.id}/publico/info`), {
        nombre: n.nombre || '',
        plan: n.plan || 'trial',
        telefono: n.telefono || '',
      }, { merge: true });
      migrados++;
    }

    await batch.commit();
    return res.status(200).json({ ok: true, migrados });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
