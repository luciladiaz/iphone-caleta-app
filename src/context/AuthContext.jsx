import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { PLANES } from '../config/planes';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [negocioId, setNegocioId] = useState(null);
  const [plan, setPlan] = useState(null);
  const [planActivo, setPlanActivo] = useState(true);
  const [diasRestantesTrial, setDiasRestantesTrial] = useState(null);
  const [limitesPlan, setLimitesPlan] = useState(PLANES.trial);
  const [loading, setLoading] = useState(true);

  function procesarNegocio(negocio) {
    const hoy = new Date();
    const rawPlan = negocio.plan || 'trial';
    const planKey = rawPlan === 'agencia' ? 'promax' : rawPlan;
    let activo = true;
    let dias = null;

    if (planKey === 'trial') {
      if (negocio.venceTrial) {
        const vence = negocio.venceTrial?.toDate?.() || new Date(negocio.venceTrial);
        activo = vence > hoy;
        dias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
        if (dias < 0) dias = 0;
      } else {
        activo = true;
        dias = 7;
      }
      setDiasRestantesTrial(dias);
    } else {
      if (negocio.vencePlan) {
        const vence = negocio.vencePlan?.toDate?.() || new Date(negocio.vencePlan);
        activo = negocio.estado === 'activo' && vence > hoy;
      } else {
        activo = negocio.estado !== 'inactivo';
      }
      setDiasRestantesTrial(null);
    }

    setPlan(planKey);
    setPlanActivo(activo);
    setLimitesPlan(PLANES[planKey] || PLANES.trial);
  }

  useEffect(() => {
    let unsubNegocio = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // Limpiar listener del negocio anterior al cambiar de usuario
      if (unsubNegocio) { unsubNegocio(); unsubNegocio = null; }

      if (!u) {
        setUser(null); setPerfil(null); setNegocioId(null);
        setPlan(null); setPlanActivo(false); setDiasRestantesTrial(null); setLimitesPlan(null);
        setLoading(false);
        return;
      }

      setUser(u);
      try {
        const snap = await getDoc(doc(db, 'usuarios', u.uid));
        if (!snap.exists()) { setLoading(false); return; }

        const perfilData = snap.data();
        setPerfil(perfilData);
        const negId = perfilData.negocioId || u.uid;
        setNegocioId(negId);

        // onSnapshot: se ejecuta ahora Y cada vez que el webhook de MP actualice Firestore.
        // Esto hace que la app se bloquee/desbloquee en tiempo real sin que el usuario recargue.
        unsubNegocio = onSnapshot(
          doc(db, 'negocios', negId),
          (negSnap) => {
            if (negSnap.exists()) {
              procesarNegocio(negSnap.data());
            } else {
              setPlan('trial');
              setPlanActivo(true);
              setDiasRestantesTrial(7);
              setLimitesPlan(PLANES.trial);
            }
            setLoading(false);
          },
          (err) => {
            console.error('Error escuchando negocio:', err);
            setPlan('trial');
            setPlanActivo(true);
            setLimitesPlan(PLANES.trial);
            setLoading(false);
          }
        );
      } catch (e) {
        console.error('Error cargando perfil:', e);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubNegocio) unsubNegocio();
    };
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const puedeVer = (modulo) => {
    if (!perfil) return false;
    if (perfil.rol === 'admin') return true;
    return perfil.permisos?.[modulo] === true;
  };

  const tieneFeature = (feature) => {
    if (!plan) return true;
    return PLANES[plan]?.features?.[feature] === true;
  };

  return (
    <AuthContext.Provider value={{
      user, perfil, negocioId,
      plan, planActivo, diasRestantesTrial, limitesPlan,
      loading, login, logout, puedeVer, tieneFeature,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
