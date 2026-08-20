import { adminDb, adminAuth, usuarioDeRequest } from './_firebase.js';

// Elimina definitivamente a un integrante del equipo: su login de Firebase Auth (para
// que ni siquiera pueda intentar iniciar sesión) y sus dos documentos de perfil (global
// y del negocio). Se hace desde el servidor porque el SDK cliente no puede borrar la
// cuenta de Auth de OTRO usuario, solo la propia.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { uid } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'Falta uid' });

  const solicitante = await usuarioDeRequest(req);
  if (!solicitante) return res.status(401).json({ error: 'No autorizado' });

  try {
    const solicitanteSnap = await adminDb.doc(`usuarios/${solicitante.uid}`).get();
    if (solicitanteSnap.data()?.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede eliminar usuarios' });
    }

    const targetSnap = await adminDb.doc(`usuarios/${uid}`).get();
    if (!targetSnap.exists) return res.status(404).json({ error: 'Usuario no encontrado' });
    const target = targetSnap.data();

    if (target.negocioId !== solicitante.negocioId) {
      return res.status(403).json({ error: 'No autorizado para este negocio' });
    }
    if (target.rol === 'admin') {
      return res.status(400).json({ error: 'No se puede eliminar a un admin' });
    }

    await adminDb.doc(`usuarios/${uid}`).delete();
    await adminDb.doc(`negocios/${solicitante.negocioId}/usuarios/${uid}`).delete();
    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      // La cuenta de Auth ya pudo haber sido borrada antes (o nunca haberse creado
      // bien) — no es motivo para dejar los documentos de Firestore sin borrar.
      console.error('[eliminar-usuario] No se pudo borrar la cuenta de Auth:', err.message);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[eliminar-usuario] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
