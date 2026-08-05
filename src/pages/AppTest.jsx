import { useState, useEffect } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PLANES } from '../config/planes';

// ─── Replica de la lógica de AuthContext para testear sin login ───────────────

function calcTrialState(venceTrial) {
  const hoy = new Date();
  if (!venceTrial) return { activo: true, dias: 7 };
  const vence = venceTrial instanceof Date ? venceTrial : new Date(venceTrial);
  const activo = vence > hoy;
  const dias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
  return { activo, dias: dias < 0 ? 0 : dias };
}

function simularNegocio(negocio) {
  const hoy = new Date();
  const rawPlan = negocio.plan || 'trial';
  const planKey = rawPlan === 'agencia' ? 'promax' : rawPlan;
  let activo = true, dias = null;

  if (planKey === 'trial') {
    if (negocio.venceTrial) {
      const r = calcTrialState(negocio.venceTrial);
      activo = r.activo; dias = r.dias;
    } else { activo = true; dias = 7; }
  } else {
    if (negocio.vencePlan) {
      const vence = negocio.vencePlan instanceof Date ? negocio.vencePlan : new Date(negocio.vencePlan);
      activo = negocio.estado === 'activo' && vence > hoy;
    } else {
      activo = negocio.estado !== 'inactivo';
    }
  }
  const limitesPlan = PLANES[planKey] || PLANES.trial;
  const tieneFeature = (f) => PLANES[planKey]?.features?.[f] === true;
  return { planKey, activo, dias, limitesPlan, tieneFeature };
}

// ─── Definición de tests ─────────────────────────────────────────────────────

const SUITES = [
  {
    categoria: '📋 Configuración de PLANES (ReventApp: un solo plan pago)',
    tests: [
      {
        nombre: 'Existen los 2 planes (trial, promax = Plan Completo)',
        fn: () => {
          const req = ['trial', 'promax'];
          const miss = req.filter(k => !PLANES[k]);
          if (miss.length) throw new Error(`Faltan: ${miss.join(', ')}`);
          return 'trial · promax ✓';
        },
      },
      {
        nombre: 'PLANES.agencia/pro/basico son alias de promax (backward-compat)',
        fn: () => {
          if (PLANES.agencia !== PLANES.promax) throw new Error('agencia no es el mismo objeto');
          if (PLANES.pro !== PLANES.promax) throw new Error('pro no es el mismo objeto');
          if (PLANES.basico !== PLANES.promax) throw new Error('basico no es el mismo objeto');
          return 'alias correctos ✓';
        },
      },
      {
        nombre: 'Trial: maxStock=∞  maxVentasMes=∞  maxUsuarios=3',
        fn: () => {
          const p = PLANES.trial;
          if (p.maxStock !== Infinity) throw new Error(`maxStock=${p.maxStock}`);
          if (p.maxVentasMes !== Infinity) throw new Error(`maxVentasMes=${p.maxVentasMes}`);
          if (p.maxUsuarios !== 3) throw new Error(`maxUsuarios=${p.maxUsuarios}`);
          return '∞ / ∞ / 3 ✓';
        },
      },
      {
        nombre: 'Plan Completo: maxStock=∞  maxVentasMes=∞  maxUsuarios=∞',
        fn: () => {
          const p = PLANES.promax;
          if (p.maxStock !== Infinity) throw new Error(`maxStock=${p.maxStock}`);
          if (p.maxVentasMes !== Infinity) throw new Error(`maxVentasMes=${p.maxVentasMes}`);
          if (p.maxUsuarios !== Infinity) throw new Error(`maxUsuarios=${p.maxUsuarios}`);
          return '∞ / ∞ / ∞ ✓';
        },
      },
      {
        nombre: 'Precio del plan pago: $29.900',
        fn: () => {
          if (PLANES.promax.precio !== 29900) throw new Error(`promax.precio=${PLANES.promax.precio}`);
          return '$29.900 ✓';
        },
      },
      {
        nombre: 'Trial: duracionDias = 7',
        fn: () => {
          if (PLANES.trial.duracionDias !== 7) throw new Error(`duracionDias=${PLANES.trial.duracionDias}`);
          return '7 días ✓';
        },
      },
    ],
  },
  {
    categoria: '🔒 Features por Plan',
    tests: [
      {
        nombre: 'Trial: todas las features están habilitadas',
        fn: () => {
          const f = PLANES.trial.features;
          const bloq = Object.entries(f).filter(([, v]) => v !== true).map(([k]) => k);
          if (bloq.length) throw new Error(`Bloqueadas: ${bloq.join(', ')}`);
          return `${Object.keys(f).length} features activas ✓`;
        },
      },
      {
        nombre: 'Plan Completo: todas las features están habilitadas',
        fn: () => {
          const f = PLANES.promax.features;
          const bloq = Object.entries(f).filter(([, v]) => v !== true).map(([k]) => k);
          if (bloq.length) throw new Error(`Bloqueadas: ${bloq.join(', ')}`);
          return `${Object.keys(f).length} features activas ✓`;
        },
      },
    ],
  },
  {
    categoria: '⏱️ Lógica de Trial y Expiración',
    tests: [
      {
        nombre: 'Trial vencido (2020-01-01) → activo=false',
        fn: () => {
          const r = calcTrialState(new Date('2020-01-01'));
          if (r.activo) throw new Error('activo debería ser false');
          return 'activo=false ✓';
        },
      },
      {
        nombre: 'Trial activo (5 días) → activo=true, dias≈5',
        fn: () => {
          const r = calcTrialState(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
          if (!r.activo) throw new Error('activo debería ser true');
          if (r.dias < 4 || r.dias > 6) throw new Error(`dias=${r.dias}, esperado ~5`);
          return `activo=true, dias=${r.dias} ✓`;
        },
      },
      {
        nombre: 'Trial en 3 horas → activo=true, dias=1 (Math.ceil de fracción)',
        fn: () => {
          const r = calcTrialState(new Date(Date.now() + 3 * 60 * 60 * 1000));
          if (!r.activo) throw new Error('activo debería ser true');
          if (r.dias !== 1) throw new Error(`dias=${r.dias}, esperado 1`);
          return 'activo=true, dias=1 ✓';
        },
      },
      {
        nombre: 'Sin venceTrial → activo=true, dias=7 (default)',
        fn: () => {
          const r = calcTrialState(null);
          if (!r.activo) throw new Error('activo debería ser true');
          if (r.dias !== 7) throw new Error(`dias=${r.dias}`);
          return 'activo=true, dias=7 ✓';
        },
      },
      {
        nombre: 'Plan "agencia" normaliza a planKey="promax"',
        fn: () => {
          const r = simularNegocio({ plan: 'agencia', estado: 'activo', vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
          if (r.planKey !== 'promax') throw new Error(`planKey=${r.planKey}`);
          return 'agencia → promax ✓';
        },
      },
      {
        nombre: 'Plan Completo sin vencePlan, estado="activo" → activo=true',
        fn: () => {
          const r = simularNegocio({ plan: 'promax', estado: 'activo', vencePlan: null });
          if (!r.activo) throw new Error('activo debería ser true');
          return 'activo=true ✓';
        },
      },
      {
        nombre: 'Plan Completo con vencePlan vencido → activo=false',
        fn: () => {
          const r = simularNegocio({ plan: 'promax', estado: 'activo', vencePlan: new Date('2020-01-01') });
          if (r.activo) throw new Error('activo debería ser false');
          return 'activo=false ✓';
        },
      },
      {
        nombre: 'Plan con estado="inactivo" sin vencePlan → activo=false',
        fn: () => {
          const r = simularNegocio({ plan: 'promax', estado: 'inactivo', vencePlan: null });
          if (r.activo) throw new Error('activo debería ser false');
          return 'activo=false ✓';
        },
      },
      {
        nombre: 'Registro: venceTrial = ahora + 7 días (simulado)',
        fn: () => {
          const venceTrial = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const r = calcTrialState(venceTrial);
          if (!r.activo) throw new Error('debería estar activo');
          if (r.dias < 6 || r.dias > 7) throw new Error(`dias=${r.dias}, esperado 7`);
          return `activo=true, dias=${r.dias} ✓`;
        },
      },
    ],
  },
  {
    categoria: '📦 Límites (solo trial — el plan pago es todo ilimitado)',
    tests: [
      {
        nombre: 'Plan Completo: 10.000 equipos → NUNCA bloquea (Infinity)',
        fn: () => {
          const max = PLANES.promax.maxStock;
          if (max !== Infinity) throw new Error(`maxStock=${max}`);
          if (10000 >= max) throw new Error('Infinity nunca debería bloquear');
          return 'Infinity → nunca bloquea ✓';
        },
      },
      {
        nombre: 'Plan Completo: ventas ilimitadas → nunca bloquea (Infinity)',
        fn: () => {
          const max = PLANES.promax.maxVentasMes;
          if (max !== Infinity) throw new Error(`maxVentasMes=${max}`);
          return 'Infinity → nunca bloquea ✓';
        },
      },
      {
        nombre: 'Plan Completo: usuarios ilimitados → nunca bloquea (Infinity)',
        fn: () => {
          const max = PLANES.promax.maxUsuarios;
          if (max !== Infinity) throw new Error(`maxUsuarios=${max}`);
          return 'Infinity → nunca bloquea ✓';
        },
      },
    ],
  },
  {
    categoria: '🔥 Simulación completa por escenario',
    tests: [
      {
        nombre: 'Trial activo: planActivo=true, todas las features disponibles',
        fn: () => {
          const r = simularNegocio({ plan: 'trial', estado: 'activo', venceTrial: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
          if (!r.activo) throw new Error('activo=false');
          if (!r.tieneFeature('catalogoPublico')) throw new Error('catalogoPublico bloqueado');
          if (!r.tieneFeature('botonWhatsappDeudores')) throw new Error('WA bloqueado');
          if (!r.tieneFeature('dashboardGerencial')) throw new Error('gerencial bloqueado');
          return `planKey=${r.planKey}, activo=true, todas features ✓`;
        },
      },
      {
        nombre: 'Trial vencido: planActivo=false → PrivateRoute redirige',
        fn: () => {
          const r = simularNegocio({ plan: 'trial', estado: 'activo', venceTrial: new Date('2020-01-01') });
          if (r.activo) throw new Error('debería ser activo=false');
          return 'activo=false → redirige a /planes?motivo=vencido ✓';
        },
      },
      {
        nombre: 'Plan Completo: todas las features activas, límites infinitos',
        fn: () => {
          const r = simularNegocio({ plan: 'promax', estado: 'activo', vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
          if (!r.activo) throw new Error('activo=false');
          const todas = ['catalogoPublico','reportesGanancia','valorStockTiempoReal','calculadoraPrecio','panelDeudores','resumenCobros','exportarExcel','botonWhatsappDeudores','reportesPorVendedor','dashboardGerencial','multiplesPointsVenta','historialEquipo'];
          const bloq = todas.filter(f => !r.tieneFeature(f));
          if (bloq.length) throw new Error(`Bloqueadas: ${bloq.join(', ')}`);
          if (r.limitesPlan.maxStock !== Infinity) throw new Error('maxStock no es ∞');
          return `activo=true, ${todas.length} features ✓, límites ∞ ✓`;
        },
      },
      {
        nombre: 'CatalogoPublico: Plan Completo SÍ tiene catalogoPublico → muestra catálogo',
        fn: () => {
          const habilitado = PLANES.promax?.features?.catalogoPublico === true;
          if (!habilitado) throw new Error('promax debería tener catálogo');
          return 'plan pago → catálogo visible ✓';
        },
      },
    ],
  },
];

// ─── Async tests ──────────────────────────────────────────────────────────────

const ASYNC_TESTS = [
  {
    categoria: '🔌 Conectividad Firebase',
    nombre: 'Firestore accesible (lectura de doc no existente no lanza error de red)',
    fn: async () => {
      await getDoc(doc(db, '_test_connectivity', '_ping'));
      return 'Firestore OK ✓';
    },
  },
];

// ─── Manual checklist ─────────────────────────────────────────────────────────

const MANUAL = [
  {
    categoria: '👤 Autenticación (manual)',
    items: [
      { label: 'Landing carga sin estar logueado', link: '/landing' },
      { label: 'Registro de usuario nuevo funciona y crea negocio en Firestore', link: '/registro' },
      { label: 'Login con email/contraseña funciona', link: '/login' },
      { label: 'Logout regresa a /landing' },
      { label: '/dashboard sin sesión redirige a /landing', link: '/dashboard_no_auth_test' },
    ],
  },
  {
    categoria: '🧪 Trial (manual — usar usuarios de /dev/seed)',
    items: [
      { label: 'Login como trial.activo@caleta.test → BannerTrial dorado aparece con ~5 días', link: '/login' },
      { label: 'Login como trial.hoy@caleta.test → BannerTrial ROJO "vence hoy"', link: '/login' },
      { label: 'Login como trial.vencido@caleta.test → redirige a /planes con banner rojo "venció"', link: '/login' },
      { label: 'Con trial vencido: /stock, /ventas, /cobros redirigen a /planes', link: '/login' },
    ],
  },
  {
    categoria: '⭐ Plan Completo — único plan pago (manual — promax@caleta.test)',
    items: [
      { label: 'Dashboard: ganancia visible en USD y ARS' },
      { label: 'Dashboard: valor del stock visible' },
      { label: 'Stock: calculadora funciona' },
      { label: 'Cobros: panel deudores con semáforo visible' },
      { label: 'Cobros: botón WhatsApp aparece y funciona' },
      { label: 'Gerencial (/gerencial): accesible (no bloqueado)' },
      { label: 'Rendimiento (/vendedores): accesible' },
      { label: 'Sidebar: PlanBadge muestra "Plan Completo"' },
    ],
  },
  {
    categoria: '🌐 Landing (manual)',
    items: [
      { label: 'Hero: título y botones "Empezar gratis" visibles', link: '/landing' },
      { label: 'Precios: 1 sola card ($29.900, todas las funciones)', link: '/landing' },
      { label: 'FAQ: accordion abre y cierra correctamente', link: '/landing' },
      { label: 'Mobile 375px: card sin overflow horizontal', link: '/landing' },
      { label: 'Ninguna mención de "Agencia", "Básico" o "Pro" (sin Max) en toda la landing', link: '/landing' },
    ],
  },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AppTest() {
  const [resultados, setResultados] = useState([]);
  const [corriendo, setCorriendo] = useState(false);
  const [manual, setManual] = useState(() => {
    const flat = MANUAL.flatMap(g => g.items.map((_, i) => `${g.categoria}_${i}`));
    return Object.fromEntries(flat.map(k => [k, null]));
  });

  const ejecutarTests = async () => {
    setCorriendo(true);
    setResultados([]);
    const res = [];

    // Tests síncronos
    for (const suite of SUITES) {
      for (const t of suite.tests) {
        try {
          const detalle = t.fn();
          res.push({ categoria: suite.categoria, nombre: t.nombre, ok: true, detalle });
        } catch (e) {
          res.push({ categoria: suite.categoria, nombre: t.nombre, ok: false, detalle: e.message });
        }
        setResultados([...res]);
        await new Promise(r => setTimeout(r, 20)); // visual progress
      }
    }

    // Tests asíncronos
    for (const t of ASYNC_TESTS) {
      try {
        const detalle = await t.fn();
        res.push({ categoria: t.categoria, nombre: t.nombre, ok: true, detalle });
      } catch (e) {
        res.push({ categoria: t.categoria, nombre: t.nombre, ok: false, detalle: e.message });
      }
      setResultados([...res]);
    }

    setCorriendo(false);
  };

  useEffect(() => { ejecutarTests(); }, []);

  const total = resultados.length;
  const pasaron = resultados.filter(r => r.ok).length;
  const fallaron = resultados.filter(r => !r.ok).length;
  const totalTests = SUITES.reduce((a, s) => a + s.tests.length, 0) + ASYNC_TESTS.length;

  const categorias = [...new Set(resultados.map(r => r.categoria))];

  const toggleManual = (key, val) => setManual(m => ({ ...m, [key]: m[key] === val ? null : val }));

  const manualPasaron = Object.values(manual).filter(v => v === true).length;
  const manualFallaron = Object.values(manual).filter(v => v === false).length;
  const manualTotal = Object.keys(manual).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#fff', fontFamily: "'Inter', sans-serif", padding: '32px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🧪 Test Suite — ReventApp</h1>
            <div style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>Tests automáticos de lógica + checklist manual</div>
          </div>
          <button onClick={ejecutarTests} disabled={corriendo}
            style={{ background: corriendo ? '#2c2c2e' : '#2563EB', color: corriendo ? '#86868b' : '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: corriendo ? 'not-allowed' : 'pointer' }}>
            {corriendo ? 'Ejecutando...' : '▶ Volver a ejecutar'}
          </button>
        </div>

        {/* Resumen automáticos */}
        {total > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
            <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2563EB' }}>{total}/{totalTests}</div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 4 }}>Tests ejecutados</div>
            </div>
            <div style={{ background: pasaron > 0 ? 'rgba(48,209,88,0.08)' : '#1c1c1e', border: `1px solid ${pasaron > 0 ? 'rgba(48,209,88,0.3)' : '#2c2c2e'}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#30d158' }}>{pasaron} ✅</div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 4 }}>Tests pasados</div>
            </div>
            <div style={{ background: fallaron > 0 ? 'rgba(255,59,48,0.08)' : '#1c1c1e', border: `1px solid ${fallaron > 0 ? 'rgba(255,59,48,0.3)' : '#2c2c2e'}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: fallaron > 0 ? '#ff3b30' : '#30d158' }}>{fallaron} {fallaron > 0 ? '❌' : '✓'}</div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 4 }}>Tests fallidos</div>
            </div>
            <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: total === totalTests && fallaron === 0 ? '#30d158' : '#2563EB' }}>
                {total < totalTests ? `${Math.round((total/totalTests)*100)}%` : fallaron === 0 ? '100% ✅' : `${Math.round((pasaron/total)*100)}%`}
              </div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 4 }}>Éxito</div>
            </div>
          </div>
        )}

        {/* Barra de progreso */}
        {corriendo && (
          <div style={{ background: '#2c2c2e', borderRadius: 99, height: 4, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ background: '#2563EB', height: '100%', width: `${(total / totalTests) * 100}%`, transition: 'width .1s' }} />
          </div>
        )}

        {/* Resultados por categoría */}
        {categorias.map(cat => (
          <div key={cat} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#2563EB' }}>{cat}</div>
            {resultados.filter(r => r.categoria === cat).map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #2c2c2e', lastChild: { borderBottom: 'none' } }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{r.ok ? '✅' : '❌'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: r.ok ? '#ebebf5cc' : '#ff3b30', fontWeight: r.ok ? 400 : 600 }}>{r.nombre}</div>
                  <div style={{ fontSize: 11, color: r.ok ? '#86868b' : '#ff3b30', marginTop: 2, fontFamily: 'monospace' }}>{r.detalle}</div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Tests fallidos resumidos */}
        {fallaron > 0 && (
          <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#ff3b30', marginBottom: 12 }}>❌ Tests fallidos — necesitan corrección</div>
            {resultados.filter(r => !r.ok).map((r, i) => (
              <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,59,48,0.05)', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ff3b30' }}>{r.nombre}</div>
                <div style={{ fontSize: 12, color: '#ff9f0a', marginTop: 3, fontFamily: 'monospace' }}>{r.detalle}</div>
              </div>
            ))}
          </div>
        )}

        {/* Separador */}
        <div style={{ borderTop: '1px solid #2c2c2e', marginTop: 32, marginBottom: 28, paddingTop: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>☑️ Checklist Manual</h2>
          <p style={{ color: '#86868b', fontSize: 13, marginBottom: 4 }}>
            Para estos tests necesitás hacer login con los usuarios de{' '}
            <a href="/dev/seed" style={{ color: '#2563EB' }}>/dev/seed</a>.
            Marcá ✅ o ❌ según lo que veas en el browser.
          </p>
          <div style={{ fontSize: 12, color: '#86868b' }}>
            {manualPasaron} ✅ · {manualFallaron} ❌ · {manualTotal - manualPasaron - manualFallaron} pendientes
          </div>
        </div>

        {MANUAL.map((grupo) => (
          <div key={grupo.categoria} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#2563EB' }}>{grupo.categoria}</div>
            {grupo.items.map((item, i) => {
              const key = `${grupo.categoria}_${i}`;
              const val = manual[key];
              return (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #2c2c2e' }}>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => toggleManual(key, true)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: val === true ? '#30d158' : '#2c2c2e', color: val === true ? '#000' : '#86868b', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>✓</button>
                    <button onClick={() => toggleManual(key, false)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: val === false ? '#ff3b30' : '#2c2c2e', color: val === false ? '#fff' : '#86868b', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>✕</button>
                  </div>
                  <span style={{ fontSize: 13, flex: 1, color: val === true ? '#30d158' : val === false ? '#ff3b30' : '#ebebf5cc', textDecoration: val === false ? 'line-through' : 'none' }}>{item.label}</span>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: '#2563EB', textDecoration: 'none', flexShrink: 0 }}>↗ abrir</a>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#3a3a3c', fontSize: 12, marginTop: 32 }}>
          Solo visible en desarrollo · <a href="/dev/seed" style={{ color: '#2563EB' }}>Crear usuarios de prueba</a>
        </div>
      </div>
    </div>
  );
}

