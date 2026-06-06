import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const ESCENARIOS = [
  {
    id: 'trial_vencido',
    label: 'Trial VENCIDO',
    emoji: '⏰',
    color: '#ff3b30',
    email: 'trial.vencido@caleta.test',
    password: 'test123456',
    nombre: 'Test Trial Vencido',
    negocio: 'Negocio Trial Vencido',
    plan: 'trial',
    estado: 'activo',
    venceTrial: new Date('2020-01-01'),
    vencePlan: null,
    desc: 'Redirige a /planes?motivo=vencido',
  },
  {
    id: 'trial_activo',
    label: 'Trial ACTIVO (5 días)',
    emoji: '🧪',
    color: '#2563EB',
    email: 'trial.activo@caleta.test',
    password: 'test123456',
    nombre: 'Test Trial Activo',
    negocio: 'Negocio Trial Activo',
    plan: 'trial',
    estado: 'activo',
    venceTrial: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    vencePlan: null,
    desc: 'BannerTrial naranja · acceso completo',
  },
  {
    id: 'trial_ultimo_dia',
    label: 'Trial ÚLTIMO DÍA',
    emoji: '🚨',
    color: '#ff9f0a',
    email: 'trial.hoy@caleta.test',
    password: 'test123456',
    nombre: 'Test Trial Hoy',
    negocio: 'Negocio Trial Hoy',
    plan: 'trial',
    estado: 'activo',
    venceTrial: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 horas
    vencePlan: null,
    desc: 'BannerTrial rojo "vence hoy"',
  },
  {
    id: 'basico',
    label: 'Plan BÁSICO',
    emoji: '⭐',
    color: '#86868b',
    email: 'basico@caleta.test',
    password: 'test123456',
    nombre: 'Test Plan Básico',
    negocio: 'Negocio Básico',
    plan: 'basico',
    estado: 'activo',
    venceTrial: null,
    vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    desc: '20 stock · 10 ventas · 1 usuario · features bloqueadas',
  },
  {
    id: 'pro',
    label: 'Plan PRO',
    emoji: '⭐⭐',
    color: '#2563EB',
    email: 'pro@caleta.test',
    password: 'test123456',
    nombre: 'Test Plan Pro',
    negocio: 'Negocio Pro',
    plan: 'pro',
    estado: 'activo',
    venceTrial: null,
    vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    desc: '60 stock · 30 ventas · 3 usuarios · WA bloqueado',
  },
  {
    id: 'promax',
    label: 'Plan PRO MAX',
    emoji: '⭐⭐⭐',
    color: '#ffd700',
    email: 'promax@caleta.test',
    password: 'test123456',
    nombre: 'Test Plan Pro Max',
    negocio: 'Negocio Pro Max',
    plan: 'promax',
    estado: 'activo',
    venceTrial: null,
    vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    desc: 'Todo habilitado · sin límites',
  },
];

async function crearEscenario(e) {
  const cred = await createUserWithEmailAndPassword(auth, e.email, e.password);
  const uid = cred.user.uid;

  await setDoc(doc(db, 'negocios', uid), {
    nombre: e.negocio,
    ownerUid: uid,
    plan: e.plan,
    estado: e.estado,
    venceTrial: e.venceTrial,
    vencePlan: e.vencePlan,
    creadoEn: serverTimestamp(),
    negocioId: uid,
  });

  const userData = {
    nombre: e.nombre,
    email: e.email,
    rol: 'admin',
    negocioId: uid,
    activo: true,
    permisos: {},
  };
  await setDoc(doc(db, 'usuarios', uid), userData);
  await setDoc(doc(db, 'negocios', uid, 'usuarios', uid), userData);

  await setDoc(doc(db, 'negocios', uid, 'config', 'general'), {
    tipoCambio: 1430,
    origenes: ['Instagram', 'WhatsApp', 'Local físico', 'Referido'],
    modelos: ['iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 16'],
  });

  return uid;
}

export default function DevSeed() {
  const [estados, setEstados] = useState({});
  const [creando, setCreando] = useState(null);
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog(l => [...l, { ts: new Date().toLocaleTimeString('es-AR'), msg }]);

  const handleCrear = async (e) => {
    if (creando) return;
    setCreando(e.id);
    setEstados(s => ({ ...s, [e.id]: 'creando' }));
    try {
      const uid = await crearEscenario(e);
      setEstados(s => ({ ...s, [e.id]: 'ok' }));
      addLog(`✅ ${e.label} creado — uid: ${uid} · email: ${e.email} · pass: ${e.password}`);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setEstados(s => ({ ...s, [e.id]: 'existe' }));
        addLog(`⚠️ ${e.label} — el email ya existe (${e.email})`);
      } else {
        setEstados(s => ({ ...s, [e.id]: 'error' }));
        addLog(`❌ ${e.label} — error: ${err.message}`);
      }
    } finally {
      setCreando(null);
    }
  };

  const handleCrearTodos = async () => {
    for (const e of ESCENARIOS) {
      if (estados[e.id] === 'ok') continue;
      await handleCrear(e);
    }
  };

  const estadoBadge = (id) => {
    const s = estados[id];
    if (!s) return null;
    const cfg = {
      creando: { label: 'Creando...', color: '#ff9f0a' },
      ok:      { label: '✅ Creado',   color: '#30d158' },
      existe:  { label: '⚠️ Ya existe', color: '#ff9f0a' },
      error:   { label: '❌ Error',    color: '#ff3b30' },
    };
    const c = cfg[s];
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: c.color, background: c.color + '20', padding: '2px 8px', borderRadius: 99 }}>
        {c.label}
      </span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#fff', fontFamily: "'Inter', sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 12, padding: '14px 20px', marginBottom: 32, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🧪</span>
          <div>
            <div style={{ fontWeight: 700, color: '#ff3b30', fontSize: 14 }}>Modo desarrollo — Solo para testing</div>
            <div style={{ color: '#86868b', fontSize: 12 }}>Creá usuarios de prueba para cada escenario de plan. Crea cuentas reales en Firebase Auth.</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Usuarios de prueba</h1>
          <button
            onClick={handleCrearTodos}
            disabled={!!creando}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: creando ? 'not-allowed' : 'pointer', opacity: creando ? 0.6 : 1 }}
          >
            Crear todos
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {ESCENARIOS.map(e => (
            <div key={e.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{e.emoji} {e.label}</span>
                    {estadoBadge(e.id)}
                  </div>
                  <div style={{ fontSize: 12, color: '#86868b', marginBottom: 4 }}>{e.desc}</div>
                  <div style={{ fontSize: 11, color: '#3a3a3c', fontFamily: 'monospace' }}>
                    {e.email} · {e.password}
                  </div>
                </div>
                <button
                  onClick={() => handleCrear(e)}
                  disabled={!!creando || estados[e.id] === 'ok'}
                  style={{
                    background: estados[e.id] === 'ok' ? '#2c2c2e' : e.color,
                    color: estados[e.id] === 'ok' ? '#3a3a3c' : e.color === '#86868b' || e.color === '#ffd700' ? '#000' : '#000',
                    border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700,
                    cursor: (creando || estados[e.id] === 'ok') ? 'not-allowed' : 'pointer',
                    opacity: (creando && creando !== e.id) ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                    minWidth: 90,
                  }}
                >
                  {estados[e.id] === 'ok' ? 'Listo ✓' : creando === e.id ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Credenciales resumen */}
        <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 Credenciales de acceso</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ESCENARIOS.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 12, padding: '6px 10px', background: '#2c2c2e', borderRadius: 6 }}>
                <span style={{ color: e.color, fontWeight: 700, minWidth: 160 }}>{e.label}</span>
                <span style={{ color: '#ebebf5cc' }}>{e.email}</span>
                <span style={{ color: '#86868b' }}>/ {e.password}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📟 Log</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {log.map((l, i) => (
                <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, color: '#ebebf5cc' }}>
                  <span style={{ color: '#3a3a3c', marginRight: 10 }}>{l.ts}</span>{l.msg}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

