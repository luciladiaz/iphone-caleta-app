import { adminDb, usuarioDeRequest } from './_firebase.js';

// Panel de superadmin — visión de todos los negocios (trial, plan, vencimientos,
// estado de la suscripción) en un solo lugar. Acceso restringido a la dueña de la
// app, verificado server-side contra el token de Firebase Auth (nunca confiar en
// un chequeo solo del lado del cliente, que cualquiera puede saltarse editando el JS).
const EMAIL_SUPERADMIN = 'luucila20@gmail.com';
const MS_DIA = 1000 * 60 * 60 * 24;

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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const usuario = await usuarioDeRequest(req);
  if (!usuario || usuario.email !== EMAIL_SUPERADMIN)
    return res.status(403).json({ error: 'No autorizado' });

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

      const base = {
        id: negDoc.id,
        nombre: n.nombre || '(sin nombre)',
        email: dueño.email || null,
        nombreDueño: dueño.nombre || null,
        telefono: n.telefono || null,
        esDemo: !!n.esDemo,
        plan: n.plan || 'trial',
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
    };

    return res.status(200).json({ ok: true, resumen, negocios });
  } catch (err) {
    console.error('[superadmin] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
