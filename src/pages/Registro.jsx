import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { IconMail } from '../components/Icons';

export default function Registro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const comprar = searchParams.get('comprar') === '1';
  const [form, setForm] = useState({ negocio: '', nombre: '', email: '', telefono: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(false);

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
        telefono: form.telefono,
      });

      // Doc público separado: el catálogo compartible lee de acá (nunca del doc de arriba,
      // que tiene teléfono/plan/datos de pago — no debe ser legible sin sesión).
      await setDoc(doc(db, 'negocios', uid, 'publico', 'info'), {
        nombre: form.negocio,
        plan: 'trial',
        telefono: form.telefono,
      });

      // Config inicial del negocio
      await setDoc(doc(db, 'negocios', uid, 'config', 'general'), {
        tipoCambio: 1430,
        origenes: ['Instagram', 'WhatsApp', 'Local físico', 'Referido', 'Facebook', 'TikTok', 'Otro'],
        modelos: ['iPhone 12','iPhone 12 Pro','iPhone 12 Pro Max','iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 14','iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max'],
      });

      await sendEmailVerification(cred.user);
      if (typeof fbq !== 'undefined') fbq('track', 'Lead');
      if (comprar) navigate('/planes?comprar=1');
      else setVerificando(true);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError(comprar
          ? 'Ese email ya tiene una cuenta. Iniciá sesión para continuar con el pago.'
          : 'Ese email ya tiene una cuenta.');
      }
      else if (err.code === 'auth/invalid-email') setError('Email inválido.');
      else setError('Ocurrió un error. Intentá de nuevo.');
      console.error(err);
    } finally { setLoading(false); }
  };

  const loginHref = comprar ? '/login?redirect=' + encodeURIComponent('/planes?comprar=1') : '/login';

  if (verificando) return (
    <div style={{ minHeight: '100vh', background: 'var(--rv-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif", padding: 16 }}>
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <IconMail size={40} style={{ marginBottom: 16 }} />
        <h2 style={{ color: 'var(--rv-text)', fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>Verificá tu email</h2>
        <p style={{ color: 'var(--rv-text-dim)', fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>
          Te enviamos un link de confirmación a:
        </p>
        <p style={{ color: 'var(--rv-accent)', fontWeight: 700, fontSize: 15, marginBottom: 24 }}>{form.email}</p>
        <p style={{ color: 'var(--rv-text-dim)', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
          Hacé click en el link del email para activar tu cuenta. Después podés iniciar sesión y empezar tu prueba gratis.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          Ir al inicio de sesión →
        </button>
        <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginTop: 16 }}>
          ¿No te llegó? Revisá la carpeta de spam.
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--rv-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif", padding: 16 }}>
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <svg viewBox="0 0 24 24" style={{ width: 44, height: 44, fill: 'var(--rv-accent)', margin: '0 auto 12px' }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <h1 style={{ color: 'var(--rv-text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Crear cuenta</h1>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 14, marginTop: 4 }}>{comprar ? 'Creá tu cuenta y activá el plan completo ahora' : '7 días gratis, sin tarjeta de crédito'}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Nombre del negocio</label>
            <input value={form.negocio} onChange={e => setForm({...form, negocio: e.target.value})} required placeholder="Ej: ReventApp Córdoba"
              style={{ width: '100%', padding: '12px 14px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, color: 'var(--rv-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Tu nombre</label>
            <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required placeholder="Tu nombre completo"
              style={{ width: '100%', padding: '12px 14px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, color: 'var(--rv-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="tu@email.com"
              style={{ width: '100%', padding: '12px 14px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, color: 'var(--rv-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>WhatsApp</label>
            <input type="tel" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} required placeholder="Ej: 11 2345-6789"
              style={{ width: '100%', padding: '12px 14px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, color: 'var(--rv-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Contraseña</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Mínimo 6 caracteres"
              style={{ width: '100%', padding: '12px 14px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 10, color: 'var(--rv-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {error && <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '10px 14px', color: 'var(--rv-text)', fontSize: 13, fontWeight: 600 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 8 }}>
            {loading ? 'Creando cuenta...' : comprar ? 'Crear cuenta y continuar al pago →' : 'Empezar prueba gratis → 7 días sin tarjeta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--rv-text-dim)' }}>
          ¿Ya tenés cuenta?{' '}
          <Link to={loginHref} style={{ color: 'var(--rv-accent)', fontWeight: 600 }}>Iniciar sesión →</Link>
        </p>
      </div>
    </div>
  );
}

