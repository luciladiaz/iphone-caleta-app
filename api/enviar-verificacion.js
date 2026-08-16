import { adminAuth } from './_firebase.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = 'https://reventapp.com.ar';

function botonWhatsapp(mensaje) {
  const WHATSAPP_SOPORTE = '5493364400111';
  const url = `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`;
  return `<p><a href="${url}" style="display:inline-block;background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">💬 Escribinos por WhatsApp</a></p>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { email, nombre } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Falta email' });

  try {
    const link = await adminAuth.generateEmailVerificationLink(email, {
      url: `${APP_URL}/login`,
      handleCodeInApp: false,
    });

    const html = `
      <p>Hola${nombre ? ' ' + nombre : ''} 👋</p>
      <p>Gracias por crear tu cuenta en ReventApp. Confirmá tu email para poder ingresar:</p>
      <p><a href="${link}" style="display:inline-block;background:#2f6fed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Verificar mi email →</a></p>
      <p style="color:#888;font-size:13px">Si el botón no funciona, copiá y pegá este link en tu navegador:<br/>${link}</p>
      <p style="color:#888;font-size:13px">Si no creaste esta cuenta, podés ignorar este mensaje.</p>
      ${botonWhatsapp(`Hola! Estoy tratando de verificar mi cuenta de ReventApp (${nombre || email}) y tengo una duda`)}`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'ReventApp <noreply@reventapp.com.ar>', to: email, subject: 'Verificá tu email — ReventApp', html }),
    });
    if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}: ${await resendRes.text()}`);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[enviar-verificacion]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
