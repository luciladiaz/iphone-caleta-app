import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await getDoc(doc(db, 'usuarios', u.uid));
          if (snap.exists()) {
            const perfilData = snap.data();
            setPerfil(perfilData);
            const negId = perfilData.negocioId || u.uid;
            setNegocioId(negId);

            // Cargar negocio para info de plan
            try {
              const negSnap = await getDoc(doc(db, 'negocios', negId));
              if (negSnap.exists()) {
                const negocio = negSnap.data();
                const rawPlan = negocio.plan || 'trial';
                // Normalizar agencia → promax (backward compat)
                const planKey = rawPlan === 'agencia' ? 'promax' : rawPlan;
                const hoy = new Date();
                let activo = true;
                let dias = null;

                if (planKey === 'trial') {
                  if (negocio.venceTrial) {
                    const vence = negocio.venceTrial?.toDate?.() || new Date(negocio.venceTrial);
                    activo = vence > hoy;
                    dias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
                    if (dias < 0) dias = 0;
                  } else {
                    // Registro viejo sin venceTrial → trial activo por defecto
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
              } else {
                // Negocio no encontrado → trial activo por defecto
                setPlan('trial');
                setPlanActivo(true);
                setDiasRestantesTrial(7);
                setLimitesPlan(PLANES.trial);
              }
            } catch (e) {
              console.error('Error cargando negocio:', e);
              setPlan('trial');
              setPlanActivo(true);
              setLimitesPlan(PLANES.trial);
            }
          }
        } catch (e) {
          console.error('Error cargando perfil:', e);
        }
      } else {
        setUser(null);
        setPerfil(null);
        setNegocioId(null);
        setPlan(null);
        setPlanActivo(false);
        setDiasRestantesTrial(null);
        setLimitesPlan(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const puedeVer = (modulo) => {
    if (!perfil) return false;
    if (perfil.rol === 'admin') return true;
    return perfil.permisos?.[modulo] === true;
  };

  const tieneFeature = (feature) => {
    if (!plan) return true; // allow while loading
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
