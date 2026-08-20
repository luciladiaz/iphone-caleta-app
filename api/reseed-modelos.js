import { adminDb } from './_firebase.js';

// Copia local e intencional de la lista de referencia (no se importa desde
// src/lib/categoriasProducto.js porque ese archivo usa el SDK cliente de Firestore,
// que no corre en este entorno de servidor con Admin SDK).
const MODELOS_DEFAULT_POR_CATEGORIA = {
  iPhone: ['iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone 14', 'iPhone 14 Pro', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 17', 'iPhone 17 Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max'],
  iPad: ['iPad (10ª gen)', 'iPad (11ª gen)', 'iPad Air M2', 'iPad Air M3', 'iPad Pro 11" M4', 'iPad Pro 13" M4', 'iPad mini 7'],
  Mac: ['MacBook Air M2', 'MacBook Air M3', 'MacBook Air M4', 'MacBook Pro 14" M3', 'MacBook Pro 14" M4', 'MacBook Pro 16" M4', 'iMac M4', 'Mac mini M4', 'Mac Studio'],
  Android: ['Samsung Galaxy S23', 'Samsung Galaxy S24', 'Samsung Galaxy S25', 'Samsung Galaxy A54', 'Samsung Galaxy A55', 'Motorola Edge 50', 'Xiaomi Redmi Note 13', 'Google Pixel 9'],
  Drone: ['DJI Mini 3', 'DJI Mini 4 Pro', 'DJI Air 3', 'DJI Mavic 3', 'DJI Avata 2', 'DJI Neo'],
};

// Utilidad de administración, uso manual y puntual: repuebla con la lista de
// referencia SOLO las categorías que estén vacías (nunca pisa una que ya tenga
// modelos cargados/editados a mano), para un negocio puntual. Uso:
// GET /api/reseed-modelos?secret=<CRON_SECRET>&negocioId=<id>
// Opcional: &categorias=iPhone,iPad,Drone (si no se pasa, evalúa las 5 default).
export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secretValido = !!process.env.CRON_SECRET &&
    (authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET);
  if (!secretValido) return res.status(401).json({ error: 'No autorizado' });

  const negocioId = req.query?.negocioId || req.body?.negocioId;
  if (!negocioId) return res.status(400).json({ error: 'Falta negocioId' });

  const categoriasParam = req.query?.categorias || req.body?.categorias;
  const categorias = categoriasParam
    ? String(categoriasParam).split(',').map(c => c.trim())
    : Object.keys(MODELOS_DEFAULT_POR_CATEGORIA);

  try {
    const cfgRef = adminDb.doc(`negocios/${negocioId}/config/general`);
    const cfgSnap = await cfgRef.get();
    const actuales = cfgSnap.data()?.modelosPorCategoria || {};

    const nuevos = { ...actuales };
    const sembradas = [];
    const yaTenianContenido = [];
    for (const cat of categorias) {
      const defaults = MODELOS_DEFAULT_POR_CATEGORIA[cat];
      if (!defaults) continue;
      if (!actuales[cat] || actuales[cat].length === 0) {
        nuevos[cat] = defaults;
        sembradas.push(cat);
      } else {
        yaTenianContenido.push(cat);
      }
    }

    if (sembradas.length > 0) {
      await cfgRef.set({ modelosPorCategoria: nuevos }, { merge: true });
    }

    return res.status(200).json({ ok: true, negocioId, sembradas, saltadas_ya_tenian_contenido: yaTenianContenido });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
