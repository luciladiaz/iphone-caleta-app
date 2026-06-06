import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export default function Registro() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ negocio: '', nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const uid = cred.user.uid;

      const venceTrial = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // usuarios PRIMERO: así cuando onSnapshot del negocio se dispara en AuthContext,
      // el perfil ya existe y puede cargarse en el reintento.
      const userData = {
        nombre: form.nombre,
        email: form.email,
        rol: 'admin',
        negocioId: uid,
        activo: true,
        permisos: {},
      };
      await setDoc(doc(db, 'usuarios', uid), userData);

      // Crear usuario también en la subcolección del negocio
      await setDoc(doc(db, 'negocios', uid, 'usuarios', uid), userData);

      // negocios DESPUÉS: su creación dispara onSnapshot en AuthContext.
      // Para entonces usuarios ya existe → perfil se carga correctamente.
      await setDoc(doc(db, 'negocios', uid), {
        nombre: form.negocio,
        ownerUid: uid,
        plan: 'trial',
        estado: 'activo',
        venceTrial,
        vencePlan: null,
        creadoEn: serverTimestamp(),
        negocioId: uid,
      });

      // Config inicial del negocio
      await setDoc(doc(db, 'negocios', uid, 'config', 'general'), {
        tipoCambio: 1430,
        origenes: ['Instagram', 'WhatsApp', 'Local físico', 'Referido', 'Facebook', 'TikTok', 'Otro'],
        modelos: ['iPhone 12','iPhone 12 Pro','iPhone 12 Pro Max','iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 14','iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max'],
      });

      navigate('/');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Ese email ya tiene una cuenta.');
      else if (err.code === 'auth/invalid-email') setError('Email inválido.');
      else setError('Ocurrió un error. Intentá de nuevo.');
      console.error(err);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: 16 }}>
      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <svg viewBox="0 0 24 24" style={{ width: 44, height: 44, fill: '#fff', margin: '0 auto 12px' }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>Crear cuenta</h1>
          <p style={{ color: '#86868b', fontSize: 14, marginTop: 4 }}>7 días gratis, sin tarjeta de crédito</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Nombre del negocio</label>
            <input value={form.negocio} onChange={e => setForm({...form, negocio: e.target.value})} required placeholder="Ej: ReventApp Córdoba"
              style={{ width: '100%', padding: '12px 14px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Tu nombre</label>
            <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required placeholder="Tu nombre completo"
              style={{ width: '100%', padding: '12px 14px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="tu@email.com"
              style={{ width: '100%', padding: '12px 14px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Contraseña</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Mínimo 6 caracteres"
              style={{ width: '100%', padding: '12px 14px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {error && <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 8, padding: '10px 14px', color: '#ff3b30', fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 8 }}>
            {loading ? 'Creando cuenta...' : 'Empezar prueba gratis → 7 días sin tarjeta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#86868b' }}>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" style={{ color: '#2563EB', fontWeight: 600 }}>Iniciar sesión →</Link>
        </p>
      </div>
    </div>
  );
}

