import { adminDb } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

// Utilidades administrativas de uso manual y puntual, consolidadas en un solo
// endpoint para no sumar funciones serverless (el plan Hobby de Vercel tope a
// 12 por deploy). Uso: GET/POST /api/admin?secret=<CRON_SECRET>&accion=<accion>
// Acciones: reseed-modelos | migrar-doc-publico | setup-demo-catalogo | test-mail-nurture

const MODELOS_DEFAULT_POR_CATEGORIA = {
  iPhone: ['iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone 14', 'iPhone 14 Pro', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 17', 'iPhone 17 Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max'],
  iPad: ['iPad (10ª gen)', 'iPad (11ª gen)', 'iPad Air M2', 'iPad Air M3', 'iPad Pro 11" M4', 'iPad Pro 13" M4', 'iPad mini 7'],
  Mac: ['MacBook Air M2', 'MacBook Air M3', 'MacBook Air M4', 'MacBook Pro 14" M3', 'MacBook Pro 14" M4', 'MacBook Pro 16" M4', 'iMac M4', 'Mac mini M4', 'Mac Studio'],
  Android: ['Samsung Galaxy S23', 'Samsung Galaxy S24', 'Samsung Galaxy S25', 'Samsung Galaxy A54', 'Samsung Galaxy A55', 'Motorola Edge 50', 'Xiaomi Redmi Note 13', 'Google Pixel 9'],
  Drone: ['DJI Mini 3', 'DJI Mini 4 Pro', 'DJI Air 3', 'DJI Mavic 3', 'DJI Avata 2', 'DJI Neo'],
};

const DEMO_ID = 'demo-catalogo-reventapp';

const EQUIPOS_DEMO = [
  { modelo: 'iPhone 11',      gb: 64,  color: 'Rojo',           bateria: 78,  pvUsd: 210, estado: 'disponible' },
  { modelo: 'iPhone 12',      gb: 64,  color: 'Blanco',         bateria: 82,  pvUsd: 320, estado: 'disponible' },
  { modelo: 'iPhone 13',      gb: 128, color: 'Negro',          bateria: 89,  pvUsd: 450, estado: 'disponible' },
  { modelo: 'iPhone 14 Pro',  gb: 256, color: 'Morado oscuro',  bateria: 95,  pvUsd: 780, estado: 'disponible' },
  { modelo: 'iPhone 15',      gb: 128, color: 'Azul',           bateria: 100, pvUsd: 650, estado: 'disponible' },
];

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = 'https://reventapp.com.ar';
const WHATSAPP_SOPORTE = '5493364400111';
const DESTINO_PRUEBA = 'luucila20@gmail.com';
const NEGOCIO_ID_PRUEBA = DEMO_ID;

function botonWhatsapp(mensaje) {
  const url = `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`;
  return `<p><a href="${url}" style="display:inline-block;background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">💬 Escribinos por WhatsApp</a></p>`;
}

const EMAILS_NURTURE = [
  {
    subject: '[PRUEBA] Día 1 — Ya podés cargar tu primer equipo 📱',
    html: `
      <p>Hola Lucila 👋</p>
      <p>Arrancó tu prueba gratis de ReventApp. Antes de que se te llene la semana de otras cosas, te dejo lo más rápido para que le saques provecho hoy mismo:</p>
      <p><strong>Cargá tu primer equipo</strong> — modelo, GB, color, batería e IMEI. Con eso ya tenés tu stock ordenado y buscable en segundos.</p>
      <p><a href="${APP_URL}/login">Entrar a ReventApp →</a></p>
      <p>Cualquier duda, escribinos directo:</p>
      ${botonWhatsapp('Hola! Empecé mi prueba en ReventApp y tengo una duda')}`,
  },
  {
    subject: '[PRUEBA] Día 4 — ¿Ya probaste esto en ReventApp?',
    html: `
      <p>Hola Lucila,</p>
      <p>Van 4 días de tu prueba. Si todavía no cargaste tus primeras ventas, este es el momento — te quedan 3 días para probar todo antes de decidir.</p>
      <p>Un feature que casi nadie descubre solo al principio: podés compartir tu <strong>catálogo actualizado por WhatsApp</strong> con un solo link.</p>
      <p><a href="${APP_URL}/catalogo/${NEGOCIO_ID_PRUEBA}">Ver mi catálogo →</a></p>
      <p>Si te trabaste en algo o tenés una duda puntual, escribinos directo:</p>
      ${botonWhatsapp('Hola! Estoy en mi prueba de ReventApp y tengo una duda')}`,
  },
  {
    subject: '[PRUEBA] Día 6 — Tu prueba gratis termina mañana',
    html: `
      <p>Hola Lucila,</p>
      <p>Mañana se vence tu período de prueba de 7 días. Tus datos quedan guardados, pero para seguir usando ReventApp sin cortes, elegí tu plan ahora:</p>
      <p><strong>Plan Completo — $29.900/mes, con todas las funciones incluidas.</strong> Cancelás cuando quieras, sin letra chica.</p>
      <p><a href="${APP_URL}/planes">Elegir mi plan →</a></p>
      <p>Si tuviste algún problema con el pago o simplemente tenés dudas de qué plan te conviene, escribinos directo y te ayudamos a resolverlo enseguida:</p>
      ${botonWhatsapp('Hola! Se me vence la prueba en ReventApp y tengo una duda sobre los planes/pago')}`,
  },
];

async function accionReseedModelos(req, res) {
  const negocioId = req.query?.negocioId || req.body?.negocioId;
  if (!negocioId) return res.status(400).json({ error: 'Falta negocioId' });

  const categoriasParam = req.query?.categorias || req.body?.categorias;
  const categorias = categoriasParam
    ? String(categoriasParam).split(',').map(c => c.trim())
    : Object.keys(MODELOS_DEFAULT_POR_CATEGORIA);

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
}

async function accionMigrarDocPublico(req, res) {
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
}

async function accionSetupDemoCatalogo(req, res) {
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
}

async function accionTestMailNurture(req, res) {
  const resultados = [];
  for (const email of EMAILS_NURTURE) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'ReventApp <hola@reventapp.com.ar>', to: DESTINO_PRUEBA, subject: email.subject, html: email.html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    resultados.push(email.subject);
  }
  return res.status(200).json({ ok: true, enviados: resultados });
}

const ACCIONES = {
  'reseed-modelos': accionReseedModelos,
  'migrar-doc-publico': accionMigrarDocPublico,
  'setup-demo-catalogo': accionSetupDemoCatalogo,
  'test-mail-nurture': accionTestMailNurture,
};

export default async function handler(req, res) {
  // Si CRON_SECRET no está seteado, el endpoint queda cerrado para todos, nunca
  // abierto por default.
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secretValido = !!process.env.CRON_SECRET &&
    (authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET);
  if (!secretValido) return res.status(401).json({ error: 'No autorizado' });

  const accion = req.query?.accion || req.body?.accion;
  const fn = ACCIONES[accion];
  if (!fn) return res.status(400).json({ error: `Falta o es inválido el parámetro accion. Válidas: ${Object.keys(ACCIONES).join(', ')}` });

  try {
    await fn(req, res);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
