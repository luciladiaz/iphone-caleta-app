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
  const [motivoBloqueo, setMotivoBloqueo] = useState(null);
  const [diasRestantesTrial, setDiasRestantesTrial] = useState(null);
  const [limitesPlan, setLimitesPlan] = useState(PLANES.trial);
  const [loading, setLoading] = useState(true);
  const [negocio, setNegocio] = useState(null);

  function procesarNegocio(negocio) {
    setNegocio(negocio);
    const hoy = new Date();
    const rawPlan = negocio.plan || 'trial';
    const planKey = rawPlan === 'agencia' ? 'promax' : rawPlan;
    let activo = true;
    let dias = null;
    let motivo = null;

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
      if (!activo) motivo = 'vencido';
    } else {
      if (negocio.estado === 'suspendido') {
        activo = false;
        motivo = 'suspendido';
      } else if (negocio.vencePlan) {
        const vence = negocio.vencePlan?.toDate?.() || new Date(negocio.vencePlan);
        activo = negocio.estado === 'activo' && vence > hoy;
        if (!activo) motivo = 'vencido';
      } else {
        activo = negocio.estado !== 'inactivo';
        if (!activo) motivo = 'vencido';
      }
      setDiasRestantesTrial(null);
    }

    setPlan(planKey);
    setPlanActivo(activo);
    setMotivoBloqueo(motivo);
    setLimitesPlan(PLANES[planKey] || PLANES.trial);
  }

  useEffect(() => {
    let unsubNegocio = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubNegocio) { unsubNegocio(); unsubNegocio = null; }

      if (!u) {
        setUser(null); setPerfil(null); setNegocioId(null);
        setPlan(null); setPlanActivo(false); setMotivoBloqueo(null);
        setDiasRestantesTrial(null); setLimitesPlan(null); setNegocio(null);
        setLoading(false);
        return;
      }

      setUser(u);

      try {
        const snap = await getDoc(doc(db, 'usuarios', u.uid));

        // negId: si usuarios ya existe usamos su negocioId, si no (registro en curso) usamos uid
        let negId = u.uid;
        if (snap.exists()) {
          const perfilData = snap.data();
          setPerfil(perfilData);
          negId = perfilData.negocioId || u.uid;
        }
        setNegocioId(negId);

        // perfilLoaded: rastrea si el perfil fue cargado. Si hubo condición de carrera
        // (usuarios aún no existía) lo reintentamos cuando llega el primer snapshot del negocio.
        let perfilLoaded = snap.exists();

        // onSnapshot: se actualiza en tiempo real cuando el webhook de MP modifica Firestore.
        // También maneja el caso en que el doc del negocio aún no fue creado (registro en curso).
        unsubNegocio = onSnapshot(
          doc(db, 'negocios', negId),
          async (negSnap) => {
            if (negSnap.exists()) {
              procesarNegocio(negSnap.data());

              // Si el perfil no se cargó (condición de carrera al registrarse),
              // reintentamos ahora que el negocio ya existe.
              if (!perfilLoaded) {
                try {
                  const reintento = await getDoc(doc(db, 'usuarios', u.uid));
                  if (reintento.exists()) {
                    setPerfil(reintento.data());
                    perfilLoaded = true;
                  }
                } catch {}
              }
            } else {
              // Documento de negocio aún no creado (milisegundos después del registro)
              setPlan('trial');
              setPlanActivo(true);
              setMotivoBloqueo(null);
              setDiasRestantesTrial(7);
              setLimitesPlan(PLANES.trial);
            }
            setLoading(false);
          },
          (err) => {
            console.error('Error escuchando negocio:', err);
            setPlan('trial');
            setPlanActivo(true);
            setMotivoBloqueo(null);
            setLimitesPlan(PLANES.trial);
            setLoading(false);
          }
        );
      } catch (e) {
        console.error('Error cargando perfil:', e);
        setPlanActivo(true);
        setLoading(false);
      }
    });

    return () => { unsubAuth(); if (unsubNegocio) unsubNegocio(); };
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const puedeVer = (modulo) => {
    // Si perfil no cargó todavía (condición de carrera en registro), permitir acceso
    if (!perfil) return true;
    if (perfil.rol === 'admin') return true;
    return perfil.permisos?.[modulo] === true;
  };

  const tieneFeature = (feature) => {
    if (!plan) return true;
    return PLANES[plan]?.features?.[feature] === true;
  };

  return (
    <AuthContext.Provider value={{
      user, perfil, negocioId, negocio,
      plan, planActivo, motivoBloqueo, diasRestantesTrial, limitesPlan,
      loading, login, logout, puedeVer, tieneFeature,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

