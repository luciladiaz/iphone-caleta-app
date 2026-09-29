import { adminDb, adminAuth, usuarioDeRequest } from './_firebase.js';
import { limitado } from './_rateLimit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = 'https://reventapp.com.ar';

// El nombre lo tipea la usuaria en Registro.jsx y llega acá tal cual — antes de meterlo
// en el HTML del mail hay que escapar las entidades básicas, si no cualquier cosa que
// haya puesto en ese campo (incluido HTML) se inyecta tal cual en el email.
function escaparHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// adminAuth.generate*Link() siempre devuelve el link con &lang=en -- no hay forma de
// pedirlo en español al generarlo (no es parte de actionCodeSettings). Sin esto, la
// página de Firebase donde la persona termina poniendo su contraseña (o confirmando el
// email) se veía en inglés, mientras todo el resto -- mail, app -- está en español.
// Encontrado probando en vivo el mail de invitación nuevo (mismo problema ya existía en
// el de verificación de siempre, así que esto lo corrige para los dos).
function forzarEspanol(link) {
  try {
    const url = new URL(link);
    url.searchParams.set('lang', 'es');
    return url.toString();
  } catch {
    return link;
  }
}

function botonWhatsapp(mensaje) {
  const WHATSAPP_SOPORTE = '5493364400111';
  const url = `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`;
  return `<p><a href="${url}" style="display:inline-block;background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">💬 Escribinos por WhatsApp</a></p>`;
}

async function mandarPorResend({ to, subject, html }) {
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'ReventApp <noreply@reventapp.com.ar>', to, subject, html }),
  });
  if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}: ${await resendRes.text()}`);
}

// Invitación a un usuario nuevo que dio de alta un admin desde Usuarios.jsx: la cuenta
// de Auth ya existe (con una contraseña al azar que nadie usa), esto le manda el link
// para que la persona ponga la suya propia. Antes esto se intentaba con el
// sendPasswordResetEmail del SDK cliente directo desde el browser -- probado en vivo y
// confirmado que NUNCA llega (el proyecto no tiene configurado el envío de mails propio
// de Firebase Auth, solo Resend a través de este archivo). Por eso pasa por acá, con el
// mismo mecanismo que ya funciona probado para el mail de verificación de arriba.
async function manejarInvitacion(req, res, solicitante) {
  const { uid } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'Falta uid' });

  const solicitanteSnap = await adminDb.doc(`usuarios/${solicitante.uid}`).get();
  if (solicitanteSnap.data()?.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un admin puede invitar usuarios' });
  }

  const targetSnap = await adminDb.doc(`usuarios/${uid}`).get();
  if (!targetSnap.exists) return res.status(404).json({ error: 'Usuario no encontrado' });
  const target = targetSnap.data();
  // El negocioId sale de Firestore, nunca del body -- si no, un admin de UN negocio
  // podría mandarle a cualquier uid ajeno un link para reiniciar SU contraseña.
  if (target.negocioId !== solicitante.negocioId) {
    return res.status(403).json({ error: 'No autorizado para este negocio' });
  }
  if (!target.email) return res.status(400).json({ error: 'Ese usuario no tiene email cargado' });

  const negocioSnap = await adminDb.doc(`negocios/${solicitante.negocioId}`).get();
  const nombreNegocio = escaparHtml(negocioSnap.data()?.nombre || 'ReventApp');

  const link = forzarEspanol(await adminAuth.generatePasswordResetLink(target.email, {
    url: `${APP_URL}/login`,
    handleCodeInApp: false,
  }));

  const nombreSeguro = escaparHtml(target.nombre);
  const html = `
    <p>Hola${nombreSeguro ? ' ' + nombreSeguro : ''} 👋</p>
    <p>Te dieron de alta como usuario de <strong>${nombreNegocio}</strong> en ReventApp. Creá tu contraseña para poder entrar:</p>
    <p><a href="${link}" style="display:inline-block;background:#2f6fed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Crear mi contraseña →</a></p>
    <p style="color:#888;font-size:13px">Si el botón no funciona, copiá y pegá este link en tu navegador:<br/>${link}</p>
    <p style="color:#888;font-size:13px">Tu usuario para entrar es: ${escaparHtml(target.email)}</p>
    ${botonWhatsapp(`Hola! Me invitaron a ${nombreNegocio} en ReventApp y tengo una duda para entrar`)}`;

  await mandarPorResend({ to: target.email, subject: `Te invitaron a ${nombreNegocio} — ReventApp`, html });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Mismo límite compartido por IP para las dos acciones de este archivo (mandarse la
  // verificación propia, o un admin invitando a alguien de su equipo) -- ninguna de las
  // dos necesita volumen alto, y así se frena en conjunto cualquier ráfaga.
  if (limitado(req, { ventanaMs: 10 * 60_000, maximo: 10 })) {
    return res.status(429).json({ error: 'Demasiados pedidos. Esperá unos minutos antes de reintentar.' });
  }

  const usuario = await usuarioDeRequest(req);
  if (!usuario) return res.status(401).json({ error: 'No autorizado' });

  try {
    // uid en el body = un admin invitando a OTRO usuario. Sin uid = alguien pidiendo
    // su propio mail de verificación (comportamiento de siempre, sin tocar).
    if (req.body?.uid) return await manejarInvitacion(req, res, usuario);

    if (!usuario.email) return res.status(401).json({ error: 'No autorizado' });
    const email = usuario.email;
    const { nombre } = req.body || {};

    const link = forzarEspanol(await adminAuth.generateEmailVerificationLink(email, {
      url: `${APP_URL}/login`,
      handleCodeInApp: false,
    }));

    const nombreSeguro = escaparHtml(nombre);
    const html = `
      <p>Hola${nombreSeguro ? ' ' + nombreSeguro : ''} 👋</p>
      <p>Gracias por crear tu cuenta en ReventApp. Confirmá tu email para poder ingresar:</p>
      <p><a href="${link}" style="display:inline-block;background:#2f6fed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Verificar mi email →</a></p>
      <p style="color:#888;font-size:13px">Si el botón no funciona, copiá y pegá este link en tu navegador:<br/>${link}</p>
      <p style="color:#888;font-size:13px">Si no creaste esta cuenta, podés ignorar este mensaje.</p>
      ${botonWhatsapp(`Hola! Estoy tratando de verificar mi cuenta de ReventApp (${nombre || email}) y tengo una duda`)}`;

    await mandarPorResend({ to: email, subject: 'Verificá tu email — ReventApp', html });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[enviar-verificacion]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
