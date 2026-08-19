const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = 'https://reventapp.com.ar';
const WHATSAPP_SOPORTE = '5493364400111';
const DESTINO_PRUEBA = 'luucila20@gmail.com';
const NEGOCIO_ID_PRUEBA = 'demo-catalogo-reventapp'; // negocio demo con stock ficticio, ver api/setup-demo-catalogo.js

function botonWhatsapp(mensaje) {
  const url = `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`;
  return `<p><a href="${url}" style="display:inline-block;background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">💬 Escribinos por WhatsApp</a></p>`;
}

const EMAILS = [
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

export default async function handler(req, res) {
  // Si CRON_SECRET no está seteado, el endpoint queda cerrado para todos, nunca
  // abierto por default.
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secretValido = !!process.env.CRON_SECRET &&
    (authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET);
  if (!secretValido) return res.status(401).json({ error: 'No autorizado' });

  try {
    const resultados = [];
    for (const email of EMAILS) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'ReventApp <hola@reventapp.com.ar>', to: DESTINO_PRUEBA, subject: email.subject, html: email.html }),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
      resultados.push(email.subject);
    }
    return res.status(200).json({ ok: true, enviados: resultados });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
