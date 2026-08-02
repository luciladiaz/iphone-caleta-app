import { adminDb } from './_firebase.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_DIGEST_DESTINO = process.env.EMAIL_DIGEST_DESTINO || 'luucila20@gmail.com';
const APP_URL = 'https://reventapp.com.ar';

const MENSAJES_WHATSAPP = {
  1: (nombre) => `Hola ${nombre}! 👋 Vi que te registraste en ReventApp. Cualquier duda para cargar tu primer stock, quedo a un mensaje de distancia. Un tip: en 10 minutos podés tener todo cargado y tu primera venta registrada 🚀`,
  4: (nombre) => `Hola ${nombre}! Van 4 días de tu prueba 👀 ¿Ya armaste tu catálogo? Se puede compartir por WhatsApp con un link que se actualiza solo. Te quedan 3 días de prueba, cualquier cosa contame`,
  6: (nombre) => `Hola ${nombre}! Mañana se vence tu prueba gratis de ReventApp. Si querés seguir, el plan básico son $7.900/mes, cancelás cuando quieras. ¿Tuviste algún problema con el pago o tenés dudas de qué plan te conviene? Contame y te ayudo ahora mismo`,
};

const EMAILS_FALLBACK = {
  1: (nombre) => ({
    subject: 'Ya podés cargar tu primer equipo 📱',
    html: `
      <p>Hola ${nombre} 👋</p>
      <p>Arrancó tu prueba gratis de ReventApp. Antes de que se te llene la semana de otras cosas, te dejo lo más rápido para que le saques provecho hoy mismo:</p>
      <p><strong>Cargá tu primer equipo</strong> — modelo, GB, color, batería e IMEI. Con eso ya tenés tu stock ordenado y buscable en segundos.</p>
      <p><em>"En 10 minutos tenía todo el stock cargado y mi primera venta registrada."</em></p>
      <p><a href="${APP_URL}/login">Entrar a ReventApp →</a></p>
      <p>Cualquier duda, respondé este mail o escribinos por WhatsApp — estamos para ayudarte a que no se te pase ni un peso.</p>`,
  }),
  4: (nombre, negocioId) => ({
    subject: '¿Ya probaste esto en ReventApp?',
    html: `
      <p>Hola ${nombre},</p>
      <p>Van 4 días de tu prueba. Si todavía no cargaste tus primeras ventas, este es el momento — te quedan 3 días para probar todo antes de decidir.</p>
      <p>Un feature que casi nadie descubre solo al principio: podés compartir tu <strong>catálogo actualizado por WhatsApp</strong> con un solo link.</p>
      <p><a href="${APP_URL}/catalogo/${negocioId}">Ver mi catálogo →</a></p>
      <p>Si te trabaste en algo o tenés una duda puntual, respondé este mail — leemos todos.</p>`,
  }),
  6: (nombre) => ({
    subject: 'Tu prueba gratis termina mañana',
    html: `
      <p>Hola ${nombre},</p>
      <p>Mañana se vence tu período de prueba de 7 días. Tus datos quedan guardados, pero para seguir usando ReventApp sin cortes, elegí tu plan ahora:</p>
      <p><strong>Plan Básico — $7.900/mes.</strong> Cancelás cuando quieras, sin letra chica.</p>
      <p><a href="${APP_URL}/planes">Elegir mi plan →</a></p>
      <p>Si tuviste algún problema con el pago o simplemente tenés dudas de qué plan te conviene, escribinos por WhatsApp — te ayudamos a resolverlo al toque.</p>`,
  }),
};

const DIAS_CONTACTO = [1, 4, 6];

function diasDesde(fecha) {
  const ms = Date.now() - fecha.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function enviarEmail({ to, subject, html }) {
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'ReventApp <hola@reventapp.com.ar>', to, subject, html }),
  });
  if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}: ${await resendRes.text()}`);
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secretValido = !process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (!secretValido) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const negociosSnap = await adminDb.collection('negocios').where('plan', '==', 'trial').get();

    const paraWhatsapp = [];
    const emailsEnviados = [];
    const errores = [];

    for (const negDoc of negociosSnap.docs) {
      const n = negDoc.data();
      const creadoEn = n.creadoEn?.toDate?.();
      if (!creadoEn) continue;

      const dias = diasDesde(creadoEn);
      if (!DIAS_CONTACTO.includes(dias)) continue;

      let usuario = {};
      try {
        const uSnap = await adminDb.doc(`usuarios/${n.ownerUid}`).get();
        if (uSnap.exists) usuario = uSnap.data();
      } catch {}

      const nombrePersona = usuario.nombre || n.nombre || '';

      if (n.telefono) {
        paraWhatsapp.push({
          negocio: n.nombre || '(sin nombre)',
          telefono: n.telefono,
          dia: dias,
          mensaje: MENSAJES_WHATSAPP[dias](nombrePersona),
        });
      } else if (usuario.email) {
        try {
          const { subject, html } = EMAILS_FALLBACK[dias](nombrePersona, negDoc.id);
          await enviarEmail({ to: usuario.email, subject, html });
          emailsEnviados.push({ negocio: n.nombre, email: usuario.email, dia: dias });
        } catch (e) {
          errores.push({ negocio: n.nombre, error: e.message });
        }
      }
    }

    if (paraWhatsapp.length === 0 && emailsEnviados.length === 0) {
      console.log('[cron-nurture-trial] Nada para hoy');
      return res.status(200).json({ ok: true, paraWhatsapp: 0, emailsEnviados: 0 });
    }

    const filasWhatsapp = paraWhatsapp.map(p => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${p.negocio}</strong><br/>Día ${p.dia} de trial</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${p.telefono}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;color:#444">${p.mensaje}</td>
      </tr>`).join('');

    const filasEmail = emailsEnviados.map(e => `
      <li>${e.negocio} (día ${e.dia}) → mail automático enviado a ${e.email}, no hace falta que hagas nada</li>`).join('');

    const html = `
      ${paraWhatsapp.length > 0 ? `
        <h2>Escribile por WhatsApp a ${paraWhatsapp.length} negocio(s) hoy</h2>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
          <tr style="background:#f5f5f5;text-align:left">
            <th style="padding:8px">Negocio</th>
            <th style="padding:8px">WhatsApp</th>
            <th style="padding:8px">Mensaje sugerido (copiar/pegar)</th>
          </tr>
          ${filasWhatsapp}
        </table>` : ''}
      ${emailsEnviados.length > 0 ? `
        <h3>Mails automáticos ya enviados (no tenían WhatsApp cargado)</h3>
        <ul>${filasEmail}</ul>` : ''}
      ${errores.length > 0 ? `<h3 style="color:#c00">Errores</h3><ul>${errores.map(e => `<li>${e.negocio}: ${e.error}</li>`).join('')}</ul>` : ''}
    `;

    await enviarEmail({
      to: EMAIL_DIGEST_DESTINO,
      subject: `📋 Seguimiento de trials: ${paraWhatsapp.length} por WhatsApp, ${emailsEnviados.length} por mail automático`,
      html,
    });

    console.log(`[cron-nurture-trial] ✅ WhatsApp: ${paraWhatsapp.length}, mails: ${emailsEnviados.length}`);
    return res.status(200).json({ ok: true, paraWhatsapp: paraWhatsapp.length, emailsEnviados: emailsEnviados.length, errores });
  } catch (err) {
    console.error('[cron-nurture-trial] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
