// Test runner Node.js — no requiere browser ni Firebase
// Replica la lógica exacta de AuthContext y PLANES para testing offline

// ─── PLANES (copiado de src/config/planes.js) ────────────────────────────────
const PLANES = {
  trial: {
    nombre: 'Prueba gratuita', precio: 0, maxStock: Infinity, maxVentasMes: Infinity,
    maxUsuarios: 3, duracionDias: 7,
    features: {
      catalogoPublico: true, reportesGanancia: true, valorStockTiempoReal: true,
      calculadoraPrecio: true, panelDeudores: true, resumenCobros: true,
      exportarExcel: true, botonWhatsappDeudores: true, reportesPorVendedor: true,
      dashboardGerencial: true, multiplesPointsVenta: true, historialEquipo: true,
    },
  },
  basico: {
    nombre: 'Básico', precio: 7900, maxStock: 20, maxVentasMes: 10, maxUsuarios: 1,
    features: {
      catalogoPublico: false, reportesGanancia: false, valorStockTiempoReal: false,
      calculadoraPrecio: false, panelDeudores: false, resumenCobros: false,
      exportarExcel: false, botonWhatsappDeudores: false, reportesPorVendedor: false,
      dashboardGerencial: false, multiplesPointsVenta: false, historialEquipo: false,
    },
  },
  pro: {
    nombre: 'Pro', precio: 14900, maxStock: 60, maxVentasMes: 30, maxUsuarios: 3,
    features: {
      catalogoPublico: true, reportesGanancia: true, valorStockTiempoReal: true,
      calculadoraPrecio: true, panelDeudores: true, resumenCobros: true,
      exportarExcel: true, botonWhatsappDeudores: false, reportesPorVendedor: false,
      dashboardGerencial: false, multiplesPointsVenta: false, historialEquipo: false,
    },
  },
  promax: {
    nombre: 'Pro Max', precio: 29900, maxStock: Infinity, maxVentasMes: Infinity,
    maxUsuarios: Infinity,
    features: {
      catalogoPublico: true, reportesGanancia: true, valorStockTiempoReal: true,
      calculadoraPrecio: true, panelDeudores: true, resumenCobros: true,
      exportarExcel: true, botonWhatsappDeudores: true, reportesPorVendedor: true,
      dashboardGerencial: true, multiplesPointsVenta: true, historialEquipo: true,
    },
  },
};
PLANES.agencia = PLANES.promax;

// ─── Funciones de lógica (réplica exacta de AuthContext) ─────────────────────
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

// ─── Definición de todos los tests ───────────────────────────────────────────
const TESTS = [

  // ── Configuración de PLANES ──────────────────────────────────────────────
  { cat: 'Configuración PLANES', nombre: 'Existen trial, basico, pro, promax', fn: () => {
    const req = ['trial','basico','pro','promax'];
    const miss = req.filter(k => !PLANES[k]);
    if (miss.length) throw new Error(`Faltan: ${miss.join(', ')}`);
    return 'trial · basico · pro · promax';
  }},
  { cat: 'Configuración PLANES', nombre: 'PLANES.agencia es alias de promax', fn: () => {
    if (PLANES.agencia !== PLANES.promax) throw new Error('No es el mismo objeto');
    return 'alias correcto';
  }},
  { cat: 'Configuración PLANES', nombre: 'Trial: maxStock=∞ maxVentasMes=∞ maxUsuarios=3', fn: () => {
    const p = PLANES.trial;
    if (p.maxStock !== Infinity)   throw new Error(`maxStock=${p.maxStock}`);
    if (p.maxVentasMes !== Infinity) throw new Error(`maxVentasMes=${p.maxVentasMes}`);
    if (p.maxUsuarios !== 3)       throw new Error(`maxUsuarios=${p.maxUsuarios}`);
    return '∞ / ∞ / 3';
  }},
  { cat: 'Configuración PLANES', nombre: 'Básico: maxStock=20 maxVentasMes=10 maxUsuarios=1', fn: () => {
    const p = PLANES.basico;
    if (p.maxStock !== 20)    throw new Error(`maxStock=${p.maxStock}`);
    if (p.maxVentasMes !== 10) throw new Error(`maxVentasMes=${p.maxVentasMes}`);
    if (p.maxUsuarios !== 1)  throw new Error(`maxUsuarios=${p.maxUsuarios}`);
    return '20 / 10 / 1';
  }},
  { cat: 'Configuración PLANES', nombre: 'Pro: maxStock=60 maxVentasMes=30 maxUsuarios=3', fn: () => {
    const p = PLANES.pro;
    if (p.maxStock !== 60)    throw new Error(`maxStock=${p.maxStock}`);
    if (p.maxVentasMes !== 30) throw new Error(`maxVentasMes=${p.maxVentasMes}`);
    if (p.maxUsuarios !== 3)  throw new Error(`maxUsuarios=${p.maxUsuarios}`);
    return '60 / 30 / 3';
  }},
  { cat: 'Configuración PLANES', nombre: 'Pro Max: maxStock=∞ maxVentasMes=∞ maxUsuarios=∞', fn: () => {
    const p = PLANES.promax;
    if (p.maxStock !== Infinity)     throw new Error(`maxStock=${p.maxStock}`);
    if (p.maxVentasMes !== Infinity) throw new Error(`maxVentasMes=${p.maxVentasMes}`);
    if (p.maxUsuarios !== Infinity)  throw new Error(`maxUsuarios=${p.maxUsuarios}`);
    return '∞ / ∞ / ∞';
  }},
  { cat: 'Configuración PLANES', nombre: 'Precios: $7.900 / $14.900 / $29.900', fn: () => {
    if (PLANES.basico.precio !== 7900)  throw new Error(`basico.precio=${PLANES.basico.precio}`);
    if (PLANES.pro.precio !== 14900)    throw new Error(`pro.precio=${PLANES.pro.precio}`);
    if (PLANES.promax.precio !== 29900) throw new Error(`promax.precio=${PLANES.promax.precio}`);
    return '$7.900 / $14.900 / $29.900';
  }},
  { cat: 'Configuración PLANES', nombre: 'Trial: duracionDias=7', fn: () => {
    if (PLANES.trial.duracionDias !== 7) throw new Error(`duracionDias=${PLANES.trial.duracionDias}`);
    return '7 días';
  }},

  // ── Features por Plan ────────────────────────────────────────────────────
  { cat: 'Features por Plan', nombre: 'Trial: las 12 features habilitadas', fn: () => {
    const f = PLANES.trial.features;
    const bloq = Object.entries(f).filter(([,v]) => v !== true).map(([k]) => k);
    if (bloq.length) throw new Error(`Bloqueadas: ${bloq.join(', ')}`);
    return `${Object.keys(f).length}/12 features activas`;
  }},
  { cat: 'Features por Plan', nombre: 'Básico: 0 features habilitadas', fn: () => {
    const f = PLANES.basico.features;
    const hab = Object.entries(f).filter(([,v]) => v === true).map(([k]) => k);
    if (hab.length) throw new Error(`Activas (no debería): ${hab.join(', ')}`);
    return '0/12 features activas';
  }},
  { cat: 'Features por Plan', nombre: 'Pro: 7 activas (catálogo/reportes/cobros), 5 bloqueadas (WA/gerencial/vendedores/multiPV/historial)', fn: () => {
    const f = PLANES.pro.features;
    const debeHaber = ['catalogoPublico','reportesGanancia','valorStockTiempoReal','calculadoraPrecio','panelDeudores','resumenCobros','exportarExcel'];
    const noDebHaber = ['botonWhatsappDeudores','reportesPorVendedor','dashboardGerencial','multiplesPointsVenta','historialEquipo'];
    const errHay = debeHaber.filter(k => f[k] !== true);
    const errNo  = noDebHaber.filter(k => f[k] !== false);
    if (errHay.length) throw new Error(`Deberían estar activas: ${errHay.join(', ')}`);
    if (errNo.length)  throw new Error(`Deberían estar bloqueadas: ${errNo.join(', ')}`);
    return '7 activas · 5 bloqueadas';
  }},
  { cat: 'Features por Plan', nombre: 'Pro Max: las 12 features habilitadas', fn: () => {
    const f = PLANES.promax.features;
    const bloq = Object.entries(f).filter(([,v]) => v !== true).map(([k]) => k);
    if (bloq.length) throw new Error(`Bloqueadas: ${bloq.join(', ')}`);
    return `${Object.keys(f).length}/12 features activas`;
  }},
  { cat: 'Features por Plan', nombre: 'catalogoPublico: trial=✓ basico=✗ pro=✓ promax=✓', fn: () => {
    const f = 'catalogoPublico';
    if (!PLANES.trial.features[f])  throw new Error('trial debería tener catálogo');
    if (PLANES.basico.features[f])  throw new Error('basico NO debería tener catálogo');
    if (!PLANES.pro.features[f])    throw new Error('pro debería tener catálogo');
    if (!PLANES.promax.features[f]) throw new Error('promax debería tener catálogo');
    return '✓ / ✗ / ✓ / ✓';
  }},
  { cat: 'Features por Plan', nombre: 'botonWhatsappDeudores: trial=✓ basico=✗ pro=✗ promax=✓', fn: () => {
    const f = 'botonWhatsappDeudores';
    if (!PLANES.trial.features[f])  throw new Error('trial debería tener WA');
    if (PLANES.basico.features[f])  throw new Error('basico NO debería tener WA');
    if (PLANES.pro.features[f])     throw new Error('pro NO debería tener WA');
    if (!PLANES.promax.features[f]) throw new Error('promax debería tener WA');
    return '✓ / ✗ / ✗ / ✓';
  }},
  { cat: 'Features por Plan', nombre: 'dashboardGerencial: trial=✓ basico=✗ pro=✗ promax=✓', fn: () => {
    const f = 'dashboardGerencial';
    if (!PLANES.trial.features[f])  throw new Error('trial debería tener gerencial');
    if (PLANES.basico.features[f])  throw new Error('basico NO debería tener gerencial');
    if (PLANES.pro.features[f])     throw new Error('pro NO debería tener gerencial');
    if (!PLANES.promax.features[f]) throw new Error('promax debería tener gerencial');
    return '✓ / ✗ / ✗ / ✓';
  }},
  { cat: 'Features por Plan', nombre: 'reportesPorVendedor: trial=✓ basico=✗ pro=✗ promax=✓', fn: () => {
    const f = 'reportesPorVendedor';
    if (!PLANES.trial.features[f])  throw new Error('trial debería tener vendedores');
    if (PLANES.basico.features[f])  throw new Error('basico NO debería tener vendedores');
    if (PLANES.pro.features[f])     throw new Error('pro NO debería tener vendedores');
    if (!PLANES.promax.features[f]) throw new Error('promax debería tener vendedores');
    return '✓ / ✗ / ✗ / ✓';
  }},
  { cat: 'Features por Plan', nombre: 'panelDeudores: trial=✓ basico=✗ pro=✓ promax=✓', fn: () => {
    const f = 'panelDeudores';
    if (!PLANES.trial.features[f])  throw new Error('trial debería tener panel deudores');
    if (PLANES.basico.features[f])  throw new Error('basico NO debería tener panel deudores');
    if (!PLANES.pro.features[f])    throw new Error('pro debería tener panel deudores');
    if (!PLANES.promax.features[f]) throw new Error('promax debería tener panel deudores');
    return '✓ / ✗ / ✓ / ✓';
  }},
  { cat: 'Features por Plan', nombre: 'reportesGanancia: trial=✓ basico=✗ pro=✓ promax=✓', fn: () => {
    const f = 'reportesGanancia';
    if (!PLANES.trial.features[f])  throw new Error('trial sin reportes');
    if (PLANES.basico.features[f])  throw new Error('basico con reportes');
    if (!PLANES.pro.features[f])    throw new Error('pro sin reportes');
    if (!PLANES.promax.features[f]) throw new Error('promax sin reportes');
    return '✓ / ✗ / ✓ / ✓';
  }},

  // ── Lógica de Trial ──────────────────────────────────────────────────────
  { cat: 'Lógica de Trial', nombre: 'venceTrial en pasado (2020) → activo=false', fn: () => {
    const r = calcTrialState(new Date('2020-01-01'));
    if (r.activo) throw new Error('activo debería ser false');
    return 'activo=false';
  }},
  { cat: 'Lógica de Trial', nombre: 'venceTrial en 5 días → activo=true, dias≈5', fn: () => {
    const r = calcTrialState(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
    if (!r.activo) throw new Error('activo debería ser true');
    if (r.dias < 4 || r.dias > 6) throw new Error(`dias=${r.dias}, esperado ~5`);
    return `activo=true, dias=${r.dias}`;
  }},
  { cat: 'Lógica de Trial', nombre: 'venceTrial en 3 horas → activo=true, dias=1 (Math.ceil)', fn: () => {
    const r = calcTrialState(new Date(Date.now() + 3 * 60 * 60 * 1000));
    if (!r.activo) throw new Error('activo debería ser true');
    if (r.dias !== 1) throw new Error(`dias=${r.dias}, esperado 1`);
    return `activo=true, dias=1`;
  }},
  { cat: 'Lógica de Trial', nombre: 'sin venceTrial → activo=true, dias=7 (default)', fn: () => {
    const r = calcTrialState(null);
    if (!r.activo) throw new Error('activo debería ser true');
    if (r.dias !== 7) throw new Error(`dias=${r.dias}`);
    return 'activo=true, dias=7';
  }},
  { cat: 'Lógica de Trial', nombre: 'plan "agencia" normaliza a planKey="promax"', fn: () => {
    const r = simularNegocio({ plan: 'agencia', estado: 'activo', vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    if (r.planKey !== 'promax') throw new Error(`planKey=${r.planKey}`);
    return 'agencia → promax';
  }},
  { cat: 'Lógica de Trial', nombre: 'plan basico sin vencePlan, estado=activo → activo=true', fn: () => {
    const r = simularNegocio({ plan: 'basico', estado: 'activo', vencePlan: null });
    if (!r.activo) throw new Error('activo debería ser true');
    return 'activo=true';
  }},
  { cat: 'Lógica de Trial', nombre: 'plan basico con vencePlan vencido → activo=false', fn: () => {
    const r = simularNegocio({ plan: 'basico', estado: 'activo', vencePlan: new Date('2020-01-01') });
    if (r.activo) throw new Error('activo debería ser false');
    return 'activo=false';
  }},
  { cat: 'Lógica de Trial', nombre: 'plan pro con estado=inactivo → activo=false', fn: () => {
    const r = simularNegocio({ plan: 'pro', estado: 'inactivo', vencePlan: null });
    if (r.activo) throw new Error('activo debería ser false');
    return 'activo=false';
  }},
  { cat: 'Lógica de Trial', nombre: 'Registro: venceTrial = ahora + 7 días → activo=true, dias≈7', fn: () => {
    const venceTrial = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const r = calcTrialState(venceTrial);
    if (!r.activo) throw new Error('debería estar activo');
    if (r.dias < 6 || r.dias > 7) throw new Error(`dias=${r.dias}`);
    return `activo=true, dias=${r.dias}`;
  }},

  // ── Límites por Plan ─────────────────────────────────────────────────────
  { cat: 'Límites por Plan', nombre: 'Básico: 19 equipos → puede agregar (<20)', fn: () => {
    const max = PLANES.basico.maxStock;
    if (19 >= max) throw new Error(`19 >= ${max}`);
    return `19 < 20 → puede agregar`;
  }},
  { cat: 'Límites por Plan', nombre: 'Básico: 20 equipos → modal (>=20)', fn: () => {
    const max = PLANES.basico.maxStock;
    if (!(20 >= max)) throw new Error('20 debería bloquear');
    return `20 >= 20 → modal aparece`;
  }},
  { cat: 'Límites por Plan', nombre: 'Pro: 59 equipos → puede agregar (<60)', fn: () => {
    const max = PLANES.pro.maxStock;
    if (59 >= max) throw new Error(`59 >= ${max}`);
    return `59 < 60 → puede agregar`;
  }},
  { cat: 'Límites por Plan', nombre: 'Pro: 60 equipos → modal (>=60)', fn: () => {
    const max = PLANES.pro.maxStock;
    if (!(60 >= max)) throw new Error('60 debería bloquear');
    return `60 >= 60 → modal aparece`;
  }},
  { cat: 'Límites por Plan', nombre: 'Pro Max: 10.000 equipos → nunca bloquea (Infinity)', fn: () => {
    const max = PLANES.promax.maxStock;
    if (max !== Infinity) throw new Error(`maxStock=${max}`);
    if (10000 >= max) throw new Error('Infinity nunca debería bloquear');
    return 'Infinity → nunca bloquea';
  }},
  { cat: 'Límites por Plan', nombre: 'Básico: 9 ventas → puede registrar (<10)', fn: () => {
    const max = PLANES.basico.maxVentasMes;
    if (9 >= max) throw new Error(`9 >= ${max}`);
    return `9 < 10 → puede registrar`;
  }},
  { cat: 'Límites por Plan', nombre: 'Básico: 10 ventas/mes → modal (>=10)', fn: () => {
    const max = PLANES.basico.maxVentasMes;
    if (!(10 >= max)) throw new Error('10 debería bloquear');
    return `10 >= 10 → modal aparece`;
  }},
  { cat: 'Límites por Plan', nombre: 'Pro: 30 ventas/mes → modal (>=30)', fn: () => {
    const max = PLANES.pro.maxVentasMes;
    if (!(30 >= max)) throw new Error('30 debería bloquear');
    return `30 >= 30 → modal aparece`;
  }},
  { cat: 'Límites por Plan', nombre: 'Básico: 1 usuario → modal si intenta agregar (>=1)', fn: () => {
    const max = PLANES.basico.maxUsuarios;
    if (!(1 >= max)) throw new Error('1 debería bloquear en básico');
    return `1 >= 1 → modal aparece`;
  }},
  { cat: 'Límites por Plan', nombre: 'Pro: 3 usuarios → modal si intenta agregar (>=3)', fn: () => {
    const max = PLANES.pro.maxUsuarios;
    if (!(3 >= max)) throw new Error('3 debería bloquear en pro');
    return `3 >= 3 → modal aparece`;
  }},
  { cat: 'Límites por Plan', nombre: 'Pro Max: 10.000 usuarios → nunca bloquea (Infinity)', fn: () => {
    const max = PLANES.promax.maxUsuarios;
    if (max !== Infinity) throw new Error(`maxUsuarios=${max}`);
    return 'Infinity → nunca bloquea';
  }},

  // ── Simulación completa por escenario ────────────────────────────────────
  { cat: 'Simulación de escenarios', nombre: 'Trial activo: planActivo=true, todas las features OK', fn: () => {
    const r = simularNegocio({ plan: 'trial', estado: 'activo', venceTrial: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    if (!r.activo) throw new Error('activo=false');
    if (!r.tieneFeature('botonWhatsappDeudores')) throw new Error('WA bloqueado');
    if (!r.tieneFeature('dashboardGerencial'))    throw new Error('gerencial bloqueado');
    if (r.limitesPlan.maxStock !== Infinity)      throw new Error('maxStock no es ∞');
    return `planKey=${r.planKey}, activo=true, dias=${r.dias}, features ∞`;
  }},
  { cat: 'Simulación de escenarios', nombre: 'Trial vencido: planActivo=false → redirige a /planes', fn: () => {
    const r = simularNegocio({ plan: 'trial', estado: 'activo', venceTrial: new Date('2020-01-01') });
    if (r.activo) throw new Error('debería ser activo=false');
    return 'activo=false → PrivateRoute redirige a /planes?motivo=vencido';
  }},
  { cat: 'Simulación de escenarios', nombre: 'Plan básico: activo=true, 0 features, stock=20', fn: () => {
    const r = simularNegocio({ plan: 'basico', estado: 'activo', vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    if (!r.activo) throw new Error('activo=false');
    if (r.tieneFeature('catalogoPublico'))  throw new Error('básico con catálogo');
    if (r.tieneFeature('reportesGanancia')) throw new Error('básico con reportes');
    if (r.limitesPlan.maxStock !== 20)      throw new Error(`maxStock=${r.limitesPlan.maxStock}`);
    return 'activo=true, 0 features, maxStock=20';
  }},
  { cat: 'Simulación de escenarios', nombre: 'Plan pro: catálogo+cobros OK, WA+gerencial bloqueados, maxStock=60', fn: () => {
    const r = simularNegocio({ plan: 'pro', estado: 'activo', vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    if (!r.activo) throw new Error('activo=false');
    if (!r.tieneFeature('catalogoPublico'))      throw new Error('pro sin catálogo');
    if (!r.tieneFeature('panelDeudores'))        throw new Error('pro sin panel deudores');
    if (r.tieneFeature('botonWhatsappDeudores')) throw new Error('pro con WA');
    if (r.tieneFeature('dashboardGerencial'))    throw new Error('pro con gerencial');
    if (r.limitesPlan.maxStock !== 60)           throw new Error(`maxStock=${r.limitesPlan.maxStock}`);
    return 'activo=true, 7 features, WA/gerencial bloqueados, maxStock=60';
  }},
  { cat: 'Simulación de escenarios', nombre: 'Plan promax: todas las 12 features, límites ∞', fn: () => {
    const r = simularNegocio({ plan: 'promax', estado: 'activo', vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    if (!r.activo) throw new Error('activo=false');
    const todas = Object.keys(PLANES.promax.features);
    const bloq = todas.filter(f => !r.tieneFeature(f));
    if (bloq.length) throw new Error(`Bloqueadas: ${bloq.join(', ')}`);
    if (r.limitesPlan.maxStock !== Infinity)    throw new Error('maxStock no es ∞');
    if (r.limitesPlan.maxUsuarios !== Infinity) throw new Error('maxUsuarios no es ∞');
    return `activo=true, 12/12 features, maxStock=∞, maxUsuarios=∞`;
  }},
  { cat: 'Simulación de escenarios', nombre: 'CatalogoPublico: básico → bloqueado, pro → visible', fn: () => {
    const habBasico = PLANES.basico?.features?.catalogoPublico === true;
    const habPro    = PLANES.pro?.features?.catalogoPublico === true;
    if (habBasico) throw new Error('básico NO debería tener catálogo');
    if (!habPro)   throw new Error('pro SÍ debería tener catálogo');
    return 'básico=bloqueado · pro=visible';
  }},
  { cat: 'Simulación de escenarios', nombre: 'ModalLimiteAlcanzado: tipos stock/ventas/usuarios tienen planRequerido correcto', fn: () => {
    // Reproduce CONFIG de ModalLimiteAlcanzado
    const CONFIG = {
      stock:    { planRequerido: 'pro' },
      ventas:   { planRequerido: 'pro' },
      usuarios: { planRequerido: 'promax' },
    };
    if (!PLANES[CONFIG.stock.planRequerido])    throw new Error('planRequerido stock inválido');
    if (!PLANES[CONFIG.ventas.planRequerido])   throw new Error('planRequerido ventas inválido');
    if (!PLANES[CONFIG.usuarios.planRequerido]) throw new Error('planRequerido usuarios inválido');
    return 'stock→pro · ventas→pro · usuarios→promax';
  }},
];

// ─── Runner ───────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const GOLD  = '\x1b[33m';
const GRAY  = '\x1b[90m';
const BOLD  = '\x1b[1m';

let pasaron = 0, fallaron = 0;
const fallas = [];
let catActual = '';

console.log(`\n${BOLD}🧪 iPhone Caleta App — Test Suite${RESET}`);
console.log(`${GRAY}${'─'.repeat(60)}${RESET}\n`);

for (const t of TESTS) {
  if (t.cat !== catActual) {
    catActual = t.cat;
    console.log(`\n${GOLD}${BOLD}${t.cat}${RESET}`);
  }
  try {
    const detalle = t.fn();
    console.log(`  ${GREEN}✅${RESET} ${t.nombre}`);
    console.log(`     ${GRAY}→ ${detalle}${RESET}`);
    pasaron++;
  } catch (e) {
    console.log(`  ${RED}❌${RESET} ${t.nombre}`);
    console.log(`     ${RED}→ ${e.message}${RESET}`);
    fallas.push({ nombre: t.nombre, error: e.message });
    fallaron++;
  }
}

// ── Resumen final ─────────────────────────────────────────────────────────────
const total = TESTS.length;
console.log(`\n${GRAY}${'─'.repeat(60)}${RESET}`);
console.log(`\n${BOLD}Resultado:${RESET}`);
console.log(`  Total:   ${total}`);
console.log(`  ${GREEN}Pasaron: ${pasaron} ✅${RESET}`);
if (fallaron > 0) {
  console.log(`  ${RED}Fallaron: ${fallaron} ❌${RESET}`);
  console.log(`\n${RED}${BOLD}Tests que fallaron:${RESET}`);
  fallas.forEach(f => {
    console.log(`  ${RED}❌ ${f.nombre}${RESET}`);
    console.log(`     ${GRAY}${f.error}${RESET}`);
  });
  process.exit(1);
} else {
  console.log(`\n${GREEN}${BOLD}✅ TODOS LOS TESTS PASARON (${total}/${total})${RESET}\n`);
}
