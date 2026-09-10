import { adminDb, usuarioDeRequest } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = 'https://reventapp.com.ar';
const WHATSAPP_SOPORTE = '5493364400111';

// Panel de superadmin — visión de todos los negocios (trial, plan, vencimientos,
// estado de la suscripción) en un solo lugar. Acceso restringido a la dueña de la
// app, verificado server-side contra el token de Firebase Auth (nunca confiar en
// un chequeo solo del lado del cliente, que cualquiera puede saltarse editando el JS).
const EMAIL_SUPERADMIN = 'luucila20@gmail.com';
const MS_DIA = 1000 * 60 * 60 * 24;

// Mismos días y mensajes que el seguimiento automático de trial (ver
// api/cron-nurture-trial.js) — acá se listan para que Lucila los tenga a mano en el
// panel y pueda marcarlos como ya enviados, en vez de depender solo del mail diario.
const DIAS_CONTACTO = [1, 4, 6];

const MENSAJES_WHATSAPP = {
  1: (nombre) => `Hola ${nombre}! 👋 Vi que te registraste en ReventApp. En 10 minutos podés tener tu stock cargado y tu primera venta registrada. ¿Ya pudiste entrar y cargar el primer equipo? Contame con 👍 (todo bien) o 🤔 (medio trabado) y te ayudo`,
  4: (nombre) => `Hola ${nombre}! Van 4 días de tu prueba 👀 Te quedan 3. ¿Cómo la venís pasando — te sirvió, te trabaste en algo puntual, o todavía no tuviste tiempo de probarla bien? Contame así te ayudo con lo que necesites en lo que queda`,
  6: (nombre) => `Hola ${nombre}! Mañana se vence tu prueba gratis de ReventApp. Si querés seguir, el plan completo son $29.900/mes, con todo incluido, cancelás cuando quieras. ¿Tuviste algún problema con el pago o dudas del plan? Y si decidís no seguir, contame por qué — me ayuda un montón a mejorar la app`,
};

function botonWhatsapp(mensaje, label = '💬 Escribinos por WhatsApp') {
  const url = `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`;
  return `<p><a href="${url}" style="display:inline-block;background:#25D366;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a></p>`;
}

// Campaña de reactivación para negocios cuyo trial venció sin convertir a pago
// (manejarWinback más abajo). Dos rondas de feedback de Lucila sobre la primera
// versión:
// 1) Cancelación y "un solo plan simple" no ayudan a decidir una compra (sacan
//    fricción, no dan motivo) -- reemplazadas por 3 features que resuelven un dolor
//    real y concreto del día a día del revendedor (fuente: WIKI, investigación de
//    mercado real del 2026-08-08 + código confirmado): comprobante con
//    checklist+firma (cierra el dolor de reclamos de garantía), Plan Canje (evita
//    cuentas a mano en la parte más propensa a error de la operación) y Reparaciones
//    (suma un negocio entero a la misma app).
// 2) Regalar los 7 días de prueba de nuevo, ya activados de una, no sirve como señal
//    de interés real -- a alguien que ya tuvo un trial gratis y no convirtió, darle
//    más gratis sin pedirle nada no filtra quién está genuinamente interesado. Ahora
//    el mail PIDE una acción (responder o escribir por WhatsApp) para reactivar --
//    quien no está interesado simplemente no contesta, y quien contesta es una señal
//    real. La activación queda manual (Lucila usa el botón "Extender trial" que ya
//    existe en el detalle del negocio en el panel), así que manejarWinback ya NO
//    toca venceTrial -- solo manda el mail y marca winbackEnviado.
function EMAIL_WINBACK(nombre) {
  return {
    subject: `${nombre}, te guardamos 7 días de prueba gratis 🎁`,
    html: `
      <p>Hola ${nombre},</p>
      <p>Probaste ReventApp hace un tiempo y no llegaste a decidirte. Pasa, y antes de asumir que no era para vos, quisimos darte otra chance.</p>
      <p>Desde entonces sumamos 3 cosas que te van a servir de verdad:</p>
      <ul style="padding-left:18px;line-height:1.7">
        <li>🧾 <strong>Comprobante de venta con checklist de estado + firma digital del cliente</strong>: te cubrís ante cualquier reclamo de garantía después de la venta.</li>
        <li>🔁 <strong>Plan Canje</strong>: calculadora automática de la diferencia cuando un cliente te entrega un equipo usado como parte de pago — sin cuentas a mano ni errores.</li>
        <li>🔧 <strong>Módulo de Reparaciones</strong>: si además reparás equipos, ahora llevás todo el flujo (ingreso → diagnóstico → presupuesto → entrega) en la misma app.</li>
      </ul>
      <p>Si te interesa darle otra vuelta, avisanos y te reactivamos 7 días de prueba gratis al toque, sin necesidad de cargar tarjeta:</p>
      ${botonWhatsapp(`Hola! Me llegó el mail de ReventApp y quiero reactivar mi prueba (${nombre})`, '🎁 Quiero mis 7 días gratis')}
      <p style="color:#666;font-size:13px">También podés responder directamente este correo.</p>
      <p style="color:#888;font-size:12px;margin-top:28px">Si preferís no recibir más este tipo de mails, respondé este correo y te sacamos de la lista.</p>`,
  };
}

async function enviarEmail({ to, subject, html }) {
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'ReventApp <hola@reventapp.com.ar>', to, subject, html }),
  });
  if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}: ${await resendRes.text()}`);
}

function aFecha(valor) {
  if (!valor) return null;
  if (valor.toDate) return valor.toDate();
  return new Date(valor);
}

function diasHasta(fecha) {
  if (!fecha) return null;
  return Math.ceil((fecha.getTime() - Date.now()) / MS_DIA);
}

function calcularSalud(n) {
  if (n.plan === 'trial') {
    return n.diasTrialRestantes !== null && n.diasTrialRestantes <= 0 ? 'trial_vencido' : 'trial_activo';
  }
  if (n.estado === 'suspendido') return 'suspendido';
  if (!n.preapprovalId) return 'sin_suscripcion';
  if (n.diasHastaVencimiento !== null && n.diasHastaVencimiento <= 0) return 'pago_vencido';
  return 'pago_activo';
}

// Historial completo de pagos + nota manual de un negocio puntual, para el modal de
// detalle. Se pide aparte (no en el listado general) para no traer todo el historial
// de pagos de todos los negocios en cada carga del panel.
async function manejarDetalle(req, res, negocioId) {
  try {
    const [negSnap, pagosSnap] = await Promise.all([
      adminDb.doc(`negocios/${negocioId}`).get(),
      adminDb.collection(`negocios/${negocioId}/pagos`).orderBy('fecha', 'desc').get(),
    ]);
    if (!negSnap.exists) return res.status(404).json({ error: 'Negocio no encontrado' });

    const historial = await Promise.all(pagosSnap.docs.map(async (d) => {
      const p = d.data();
      const base = { id: d.id, tipo: p.tipo || null, estado: p.estado || null, mpId: p.mpId || null, motivoRechazo: p.motivoRechazo || null, fecha: aFecha(p.fecha)?.toISOString() || null };

      // Para pagos rechazados ANTES de hoy, motivoRechazo no existe todavía (recién se
      // empezó a guardar). Se consulta en vivo contra MP con el mpId ya guardado -- así
      // no hace falta esperar un webhook nuevo para saber por qué falló uno viejo. Solo
      // para tipo pago (mpId numérico real, no "test"), y solo si no lo teníamos ya.
      if (!base.motivoRechazo && base.mpId && base.mpId !== 'test' && p.tipo?.includes('rechazado') && MP_ACCESS_TOKEN) {
        try {
          const r = await fetch(`https://api.mercadopago.com/v1/payments/${base.mpId}`, {
            headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
          });
          if (r.ok) {
            const pago = await r.json();
            base.motivoRechazo = pago.status_detail || null;
          }
        } catch (e) { console.warn(`[superadmin] No se pudo consultar mpId=${base.mpId}:`, e.message); }
      }

      return base;
    }));

    // Historial REAL de cobros directo desde MP (authorized_payments/search por
    // preapproval_id) -- a diferencia de "historial" (que sale de nuestro Firestore, y
    // depende de que el webhook haya llegado), esto consulta a MP directamente y trae
    // TODOS los intentos de cobro recurrente que existan, hayan generado notificación o
    // no. Es lo que permite ver el motivo real de un intento aunque el webhook nunca haya
    // llegado (confirmado que puede pasar si falta habilitar un tópico específico).
    let facturasMP = [];
    const preapprovalId = negSnap.data().preapprovalId;
    if (preapprovalId && MP_ACCESS_TOKEN) {
      try {
        const rFact = await fetch(`https://api.mercadopago.com/authorized_payments/search?preapproval_id=${preapprovalId}`, {
          headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
        });
        if (rFact.ok) {
          const data = await rFact.json();
          console.log(`[superadmin] authorized_payments/search preapproval=${preapprovalId}: ${data.results?.length ?? 0} resultado(s), paging=${JSON.stringify(data.paging)}`);
          facturasMP = (data.results || []).map((f) => ({
            id: f.id,
            status: f.status,
            retryAttempt: f.retry_attempt ?? null,
            dateCreated: f.date_created || null,
            lastModified: f.last_modified || null,
            debitDate: f.debit_date || null,
            paymentId: f.payment?.id || null,
            paymentStatus: f.payment?.status || null,
            motivoRechazo: f.payment?.status_detail || null,
          }));
        } else {
          console.warn(`[superadmin] authorized_payments/search respondió ${rFact.status} para preapproval=${preapprovalId}`);
        }
      } catch (e) { console.warn('[superadmin] Error consultando authorized_payments:', e.message); }
    }

    return res.status(200).json({ ok: true, nota: negSnap.data().notaAdmin || '', historial, facturasMP });
  } catch (err) {
    console.error('[superadmin] Error en detalle:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function manejarGet(req, res) {
  const detalleId = req.query?.detalle;
  if (detalleId) return manejarDetalle(req, res, detalleId);

  try {
    const negociosSnap = await adminDb.collection('negocios').get();

    const negocios = await Promise.all(negociosSnap.docs.map(async (negDoc) => {
      const n = negDoc.data();

      let dueño = {};
      if (n.ownerUid) {
        try {
          const uSnap = await adminDb.doc(`usuarios/${n.ownerUid}`).get();
          if (uSnap.exists) dueño = uSnap.data();
        } catch (e) { console.warn(`[superadmin] No se pudo leer dueño de ${negDoc.id}:`, e.message); }
      }

      let ultimoPagoRegistro = null;
      try {
        const pagosSnap = await adminDb.collection(`negocios/${negDoc.id}/pagos`)
          .orderBy('fecha', 'desc').limit(1).get();
        if (!pagosSnap.empty) {
          const p = pagosSnap.docs[0].data();
          ultimoPagoRegistro = { tipo: p.tipo, estado: p.estado, fecha: aFecha(p.fecha)?.toISOString() || null };
        }
      } catch (e) { console.warn(`[superadmin] No se pudo leer pagos de ${negDoc.id}:`, e.message); }

      const creadoEn = aFecha(n.creadoEn);
      const venceTrial = aFecha(n.venceTrial);
      const vencePlan = aFecha(n.vencePlan);
      const fechaSuspension = aFecha(n.fechaSuspension);
      const ultimoPago = aFecha(n.ultimoPago);
      const ultimoCheckout = aFecha(n.ultimoCheckout);
      const contactosTrial = n.contactosTrial || {};

      const plan = n.plan || 'trial';
      const nombreDueño = dueño.nombre || null;
      const diasDesdeCreado = creadoEn ? Math.floor((Date.now() - creadoEn.getTime()) / MS_DIA) : null;

      // Día de seguimiento vigente: el mayor de [1,4,6] ya alcanzado. Si ese día
      // todavía no fue marcado como contactado, es el que hay que mostrar como
      // pendiente — mismo criterio que usaría el cron, pero sin depender de que
      // se ejecute justo el día exacto (si se saltó un día, lo sigue mostrando).
      let diaActualContacto = null;
      if (plan === 'trial' && !n.esDemo && diasDesdeCreado !== null) {
        for (const dia of DIAS_CONTACTO) {
          if (diasDesdeCreado >= dia) diaActualContacto = dia;
        }
      }
      const yaContactado = diaActualContacto ? contactosTrial[diaActualContacto] === true : false;
      const pendienteContacto = diaActualContacto !== null && !yaContactado;
      const mensajeSugerido = diaActualContacto ? MENSAJES_WHATSAPP[diaActualContacto](nombreDueño || n.nombre || '') : null;

      const base = {
        id: negDoc.id,
        nombre: n.nombre || '(sin nombre)',
        email: dueño.email || null,
        nombreDueño,
        telefono: n.telefono || null,
        esDemo: !!n.esDemo,
        plan,
        estado: n.estado || 'activo',
        renovacionAutomatica: n.renovacionAutomatica === true,
        preapprovalId: n.preapprovalId || null,
        planSolicitado: n.planSolicitado || null,
        motivoSuspension: n.motivoSuspension || null,
        creadoEn: creadoEn?.toISOString() || null,
        venceTrial: venceTrial?.toISOString() || null,
        vencePlan: vencePlan?.toISOString() || null,
        fechaSuspension: fechaSuspension?.toISOString() || null,
        ultimoPago: ultimoPago?.toISOString() || null,
        ultimoCheckout: ultimoCheckout?.toISOString() || null,
        ultimoPagoRegistro,
        diasTrialRestantes: venceTrial ? diasHasta(venceTrial) : null,
        diasHastaVencimiento: vencePlan ? diasHasta(vencePlan) : null,
        diaActualContacto,
        pendienteContacto,
        mensajeSugerido,
        notaAdmin: n.notaAdmin || '',
        winbackEnviado: !!n.winbackEnviado,
      };

      return { ...base, salud: calcularSalud(base) };
    }));

    negocios.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));

    const activos = negocios.filter(n => n.salud === 'pago_activo' && !n.esDemo);
    const resumen = {
      total: negocios.filter(n => !n.esDemo).length,
      trialActivo: negocios.filter(n => n.salud === 'trial_activo' && !n.esDemo).length,
      trialVencido: negocios.filter(n => n.salud === 'trial_vencido' && !n.esDemo).length,
      pagoActivo: activos.length,
      pagoVencido: negocios.filter(n => n.salud === 'pago_vencido' && !n.esDemo).length,
      suspendido: negocios.filter(n => n.salud === 'suspendido' && !n.esDemo).length,
      sinSuscripcion: negocios.filter(n => n.salud === 'sin_suscripcion' && !n.esDemo).length,
      proximosAVencer: negocios.filter(n => !n.esDemo && (
        (n.plan === 'trial' && n.diasTrialRestantes !== null && n.diasTrialRestantes >= 0 && n.diasTrialRestantes <= 7) ||
        (n.plan !== 'trial' && n.diasHastaVencimiento !== null && n.diasHastaVencimiento >= 0 && n.diasHastaVencimiento <= 7)
      )).length,
      mrrEstimado: activos.length * 29900,
      pendientesContacto: negocios.filter(n => n.pendienteContacto).length,
    };

    // Conversión trial → pago: de los negocios cuyo trial ya está "decidido" (o ya
    // pasaron a plan pago, o su trial ya venció sin que hayan pagado), qué % efectivamente
    // llegó a pagar alguna vez. plan queda en 'promax' aunque después se suspenda o
    // cancele, así que sigue contando como conversión (no como reversión).
    const decididos = negocios.filter(n => !n.esDemo && (n.plan !== 'trial' || (n.diasTrialRestantes !== null && n.diasTrialRestantes <= 0)));
    const convertidos = decididos.filter(n => n.plan !== 'trial');
    resumen.tasaConversion = decididos.length > 0 ? Math.round((convertidos.length / decididos.length) * 1000) / 10 : null;
    resumen.decididos = decididos.length;
    resumen.convertidos = convertidos.length;

    return res.status(200).json({ ok: true, resumen, negocios });
  } catch (err) {
    console.error('[superadmin] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Marca (o desmarca) que ya se le mandó el mensaje de seguimiento del día indicado a
// un negocio puntual. Se guarda como mapa en el propio doc del negocio
// (contactosTrial.{dia}) para no sumar otra colección ni otra función serverless.
async function manejarMarcarContacto(req, res) {
  const { negocioId, dia, contactado } = req.body || {};
  if (!negocioId || !DIAS_CONTACTO.includes(Number(dia)) || typeof contactado !== 'boolean')
    return res.status(400).json({ error: 'Faltan o son inválidos: negocioId, dia, contactado' });

  try {
    await adminDb.doc(`negocios/${negocioId}`).update({
      [`contactosTrial.${dia}`]: contactado,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[superadmin] Error marcando contacto:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Extiende el trial de un negocio X días. Si venceTrial ya pasó, cuenta desde hoy (no
// desde la fecha vieja, que le sumaría días "perdidos" que ya no importan); si todavía
// no venció, se suma sobre esa fecha (no pisa el tiempo que le queda).
async function manejarExtenderTrial(req, res) {
  const { negocioId, dias } = req.body || {};
  const diasNum = Number(dias);
  if (!negocioId || !diasNum || diasNum <= 0)
    return res.status(400).json({ error: 'Faltan o son inválidos: negocioId, dias' });

  try {
    const negRef = adminDb.doc(`negocios/${negocioId}`);
    const negSnap = await negRef.get();
    if (!negSnap.exists) return res.status(404).json({ error: 'Negocio no encontrado' });

    const actual = negSnap.data();
    const venceActual = aFecha(actual.venceTrial);
    const base = venceActual && venceActual.getTime() > Date.now() ? venceActual : new Date();
    const nuevaFecha = new Date(base.getTime() + diasNum * MS_DIA);

    await negRef.update({ venceTrial: nuevaFecha });
    return res.status(200).json({ ok: true, venceTrial: nuevaFecha.toISOString() });
  } catch (err) {
    console.error('[superadmin] Error extendiendo trial:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Nota libre por negocio (mini-CRM: "ya hablé, dijo que necesita tiempo", etc.).
async function manejarGuardarNota(req, res) {
  const { negocioId, nota } = req.body || {};
  if (!negocioId || typeof nota !== 'string')
    return res.status(400).json({ error: 'Faltan o son inválidos: negocioId, nota' });

  try {
    await adminDb.doc(`negocios/${negocioId}`).update({ notaAdmin: nota.slice(0, 2000) });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[superadmin] Error guardando nota:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Campaña de reactivación (ver EMAIL_WINBACK más arriba). Dos modos:
// - testEmail: manda UN mail de prueba a esa dirección (sin tocar Firestore), para
//   revisar cómo se ve antes de mandarlo en serio.
// - negocioIds: la lista exacta que Lucila ya vio y confirmó en el panel (nunca
//   recalculada a ciegas del lado del servidor) -- por cada uno, manda el mail y
//   marca winbackEnviado, para que un reintento por error de red no lo mande dos
//   veces a quien ya lo recibió.
//
// A propósito NO extiende venceTrial acá -- el mail le pide a la persona que
// responda o escriba por WhatsApp para reactivar (ver comentario en EMAIL_WINBACK):
// regalar los 7 días de una sin pedir nada no da ninguna señal de interés real.
// Cuando alguien efectivamente contesta, Lucila lo activa a mano con el botón
// "Extender trial" que ya existe en el detalle de cada negocio (manejarExtenderTrial),
// mismo mecanismo de siempre, solo que ahora disparado por una respuesta real en vez
// de a ciegas.
async function manejarWinback(req, res) {
  const { testEmail, negocioIds } = req.body || {};
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Resend no configurado en el servidor' });

  if (testEmail) {
    try {
      await enviarEmail({ to: testEmail, ...EMAIL_WINBACK('Ejemplo') });
      return res.status(200).json({ ok: true, testEnviado: testEmail });
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }

  if (!Array.isArray(negocioIds) || negocioIds.length === 0)
    return res.status(400).json({ error: 'Falta negocioIds (lista) o testEmail' });

  const enviados = [];
  const errores = [];

  for (const negocioId of negocioIds) {
    try {
      const negRef = adminDb.doc(`negocios/${negocioId}`);
      const negSnap = await negRef.get();
      if (!negSnap.exists) { errores.push({ negocioId, error: 'No encontrado' }); continue; }
      const n = negSnap.data();
      if (n.winbackEnviado) { errores.push({ negocioId, error: 'Ya se le había enviado' }); continue; }
      if (n.plan !== 'trial') { errores.push({ negocioId, error: 'Ya no está en trial' }); continue; }

      let usuario = {};
      if (n.ownerUid) {
        const uSnap = await adminDb.doc(`usuarios/${n.ownerUid}`).get();
        if (uSnap.exists) usuario = uSnap.data();
      }
      if (!usuario.email) { errores.push({ negocioId, error: 'Sin email de dueño' }); continue; }

      const nombrePersona = usuario.nombre || n.nombre || '';
      await enviarEmail({ to: usuario.email, ...EMAIL_WINBACK(nombrePersona) });
      await negRef.update({
        winbackEnviado: true,
        winbackFecha: FieldValue.serverTimestamp(),
      });
      enviados.push({ negocioId, email: usuario.email });
    } catch (e) {
      errores.push({ negocioId, error: e.message });
    }
  }

  return res.status(200).json({ ok: true, enviados, errores });
}

async function manejarPost(req, res) {
  const { dia, nota, dias, winback } = req.body || {};
  if (dia !== undefined) return manejarMarcarContacto(req, res);
  if (nota !== undefined) return manejarGuardarNota(req, res);
  if (dias !== undefined) return manejarExtenderTrial(req, res);
  if (winback !== undefined) return manejarWinback(req, res);
  return res.status(400).json({ error: 'Body inválido' });
}

export default async function handler(req, res) {
  const usuario = await usuarioDeRequest(req);
  if (!usuario || usuario.email !== EMAIL_SUPERADMIN)
    return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') return manejarGet(req, res);
  if (req.method === 'POST') return manejarPost(req, res);
  return res.status(405).json({ error: 'Método no permitido' });
}
