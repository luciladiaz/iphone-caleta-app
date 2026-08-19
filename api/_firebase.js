import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();

// Verifica el ID token de Firebase Auth que manda el cliente en el header
// Authorization: Bearer <token>, y devuelve el negocioId real del que ese usuario
// es dueño (leído del propio Firestore, nunca del que mande el cliente en el body).
// Usar en cualquier endpoint que actúe sobre un negocio puntual, para que nadie pueda
// operar sobre un negocioId ajeno con solo saber cuál es (son visibles en los links
// de catálogo público).
export async function usuarioDeRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const perfilSnap = await adminDb.doc(`usuarios/${decoded.uid}`).get();
    const negocioId = perfilSnap.exists ? perfilSnap.data().negocioId : decoded.uid;
    return { uid: decoded.uid, email: decoded.email, negocioId };
  } catch {
    return null;
  }
}

