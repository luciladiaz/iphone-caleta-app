import { useState, useEffect } from 'react';
import { PLANES } from '../config/planes';

// ── Lógica de simulación (réplica de AuthContext) ─────────────────────────────
function simularNegocio(negocio) {
  const hoy = new Date();
  const rawPlan = negocio.plan || 'trial';
  const planKey = rawPlan === 'agencia' ? 'promax' : rawPlan;
  let activo = true;
  let motivo = null;

  if (planKey === 'trial') {
    if (negocio.venceTrial) {
      const vence = negocio.venceTrial instanceof Date ? negocio.venceTrial : new Date(negocio.venceTrial);
      activo = vence > hoy;
      if (!activo) motivo = 'vencido';
    }
  } else {
    if (negocio.estado === 'suspendido') {
      activo = false; motivo = 'suspendido';
    } else if (negocio.vencePlan) {
      const vence = negocio.vencePlan instanceof Date ? negocio.vencePlan : new Date(negocio.vencePlan);
      activo = negocio.estado === 'activo' && vence > hoy;
      if (!activo) motivo = 'vencido';
    } else {
      activo = negocio.estado !== 'inactivo' && negocio.estado !== 'suspendido';
      if (!activo) motivo = negocio.estado === 'suspendido' ? 'suspendido' : 'vencido';
    }
  }
  return { planKey, activo, motivo };
}

// ── Helpers para llamar al webhook en modo test ───────────────────────────────
async function whook(testMode, body) {
  const r = await fetch('/api/webhook-mp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Mode': testMode },
    body: JSON.stringify(body),
  });
  return r.json();
}

const TEST_IDS = ['TEST_PAGO_OK', 'TEST_CANCELADO', 'TEST_RECHAZADO'];

// ── Definición de los 7 tests ─────────────────────────────────────────────────
async function runTests(setLog) {
  const results = [];

  const ok  = (nombre, detalle) => { results.push({ nombre, ok: true,  detalle }); setLog([...results]); };
  const fail = (nombre, detalle) => { results.push({ nombre, ok: false, detalle }); setLog([...results]); };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1 — Webhook responde 200
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const r = await fetch('/api/webhook-mp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    });
    if (r.ok) ok('TEST 1 — Webhook responde 200', `status=${r.status}`);
    else fail('TEST 1 — Webhook responde 200', `status=${r.status} (esperado 200)`);
  } catch (e) { fail('TEST 1 — Webhook responde 200', e.message); }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2 — Pago exitoso activa el plan
  // ──────────────────────────────────────────────────────────────────────────
  try {
    // Setup: negocio con trial vencido
    await whook('setup', {
      negocioId: 'TEST_PAGO_OK',
      data: { plan: 'trial', estado: 'activo', venceTrial: new Date('2020-01-01'), nombre: 'Test Pago OK' },
    });

    // Simular pago aprobado
    await whook('true', { negocioId: 'TEST_PAGO_OK', status: 'approved', plan: 'pro' });

    // Leer resultado via webhook (Admin bypassa reglas de Firestore)
    const res = await whook('read', { negocioId: 'TEST_PAGO_OK' });

    if (res.data?.estado === 'activo' && res.data?.plan === 'pro' && res.data?.vencePlan) {
      ok('TEST 2 — Pago exitoso activa el plan', `estado=${res.data.estado} plan=${res.data.plan}`);
    } else {
      fail('TEST 2 — Pago exitoso activa el plan', `estado=${res.data?.estado} plan=${res.data?.plan} (esperado estado=activo plan=pro)`);
    }
  } catch (e) { fail('TEST 2 — Pago exitoso activa el plan', e.message); }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3 — Cancelación bloquea al usuario (estado=suspendido)
  // ──────────────────────────────────────────────────────────────────────────
  try {
    // Setup: negocio activo pagando
    await whook('setup', {
      negocioId: 'TEST_CANCELADO',
      data: {
        plan: 'pro', estado: 'activo',
        vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nombre: 'Test Cancelado',
      },
    });

    // Simular cancelación de suscripción (MP agotó reintentos)
    await whook('true', { negocioId: 'TEST_CANCELADO', status: 'cancelled' });

    const res = await whook('read', { negocioId: 'TEST_CANCELADO' });

    if (res.data?.estado === 'suspendido') {
      ok('TEST 3 — Cancelación suspende al usuario', `estado=${res.data.estado}`);
    } else {
      fail('TEST 3 — Cancelación suspende al usuario', `estado=${res.data?.estado} (esperado suspendido)`);
    }
  } catch (e) { fail('TEST 3 — Cancelación suspende al usuario', e.message); }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4 — Pago rechazado NO bloquea (MP está reintentando)
  // ──────────────────────────────────────────────────────────────────────────
  try {
    // Setup: negocio activo
    await whook('setup', {
      negocioId: 'TEST_RECHAZADO',
      data: {
        plan: 'pro', estado: 'activo',
        vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nombre: 'Test Rechazado',
      },
    });

    // Simular pago rechazado / suscripción pausada (MP reintentando)
    await whook('true', { negocioId: 'TEST_RECHAZADO', status: 'paused' });

    const res = await whook('read', { negocioId: 'TEST_RECHAZADO' });

    if (res.data?.estado === 'activo') {
      ok('TEST 4 — Pago rechazado NO bloquea (MP reintentando)', `estado=${res.data.estado} — sigue activo ✓`);
    } else {
      fail('TEST 4 — Pago rechazado NO bloquea (MP reintentando)', `estado=${res.data?.estado} (debería seguir activo mientras MP reintenta)`);
    }
  } catch (e) { fail('TEST 4 — Pago rechazado NO bloquea (MP reintentando)', e.message); }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5 — Usuario suspendido → planActivo=false, motivo=suspendido
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const r = simularNegocio({
      plan: 'pro',
      estado: 'suspendido',
      vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    if (!r.activo && r.motivo === 'suspendido') {
      ok('TEST 5 — Usuario suspendido queda bloqueado', `activo=${r.activo} motivo=${r.motivo}`);
    } else {
      fail('TEST 5 — Usuario suspendido queda bloqueado', `activo=${r.activo} motivo=${r.motivo} (esperado activo=false motivo=suspendido)`);
    }
  } catch (e) { fail('TEST 5 — Usuario suspendido queda bloqueado', e.message); }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6 — Usuario activo con fecha vigente puede acceder
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const r = simularNegocio({
      plan: 'pro',
      estado: 'activo',
      vencePlan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    if (r.activo && r.motivo === null) {
      ok('TEST 6 — Usuario activo vigente puede acceder', `activo=${r.activo}`);
    } else {
      fail('TEST 6 — Usuario activo vigente puede acceder', `activo=${r.activo} motivo=${r.motivo}`);
    }
  } catch (e) { fail('TEST 6 — Usuario activo vigente puede acceder', e.message); }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7 — Usuario activo con vencePlan expirado NO puede acceder
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const r = simularNegocio({
      plan: 'pro',
      estado: 'activo',
      vencePlan: new Date('2020-01-01'), // fecha pasada
    });
    if (!r.activo && r.motivo === 'vencido') {
      ok('TEST 7 — Fecha vencida bloquea aunque estado=activo', `activo=${r.activo} motivo=${r.motivo}`);
    } else {
      fail('TEST 7 — Fecha vencida bloquea aunque estado=activo', `activo=${r.activo} motivo=${r.motivo} (esperado activo=false motivo=vencido)`);
    }
  } catch (e) { fail('TEST 7 — Fecha vencida bloquea aunque estado=activo', e.message); }

  // ──────────────────────────────────────────────────────────────────────────
  // LIMPIEZA automática de documentos de test
  // ──────────────────────────────────────────────────────────────────────────
  try {
    await whook('cleanup', { negocioIds: TEST_IDS });
  } catch {}

  return results;
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function TestPagos() {
  const [resultados, setResultados] = useState([]);
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);

  const ejecutar = async () => {
    setCorriendo(true);
    setTerminado(false);
    setResultados([]);
    await runTests(setResultados);
    setCorriendo(false);
    setTerminado(true);
  };

  useEffect(() => { ejecutar(); }, []);

  const pasaron = resultados.filter(r => r.ok).length;
  const fallaron = resultados.filter(r => !r.ok).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#fff', fontFamily: "'Inter', sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 12, padding: '14px 20px', marginBottom: 32, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🧪</span>
          <div>
            <div style={{ fontWeight: 700, color: '#ff3b30', fontSize: 14 }}>Test Suite — Sistema de Pagos y Webhooks</div>
            <div style={{ color: '#86868b', fontSize: 12 }}>Tests automáticos del flujo MercadoPago → Webhook → Firestore → Bloqueo</div>
          </div>
        </div>

        {/* Resumen */}
        {terminado && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
            {[
              { label: 'Total', valor: resultados.length, color: '#2563EB' },
              { label: 'Pasaron', valor: pasaron, color: '#30d158' },
              { label: 'Fallaron', valor: fallaron, color: fallaron > 0 ? '#ff3b30' : '#3a3a3c' },
            ].map(c => (
              <div key={c.label} style={{ background: '#1c1c1e', border: `1px solid ${c.color}40`, borderRadius: 12, padding: '14px 20px', flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.valor}</div>
                <div style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Banner resultado */}
        {terminado && (
          <div style={{
            background: fallaron === 0 ? 'rgba(48,209,88,0.1)' : 'rgba(255,59,48,0.1)',
            border: `1px solid ${fallaron === 0 ? 'rgba(48,209,88,0.4)' : 'rgba(255,59,48,0.4)'}`,
            borderRadius: 12, padding: '14px 20px', marginBottom: 28,
            fontWeight: 700, fontSize: 15, color: fallaron === 0 ? '#30d158' : '#ff3b30',
          }}>
            {fallaron === 0
              ? `✅ TODOS LOS TESTS PASARON (${pasaron}/${resultados.length})`
              : `❌ ${fallaron} test${fallaron > 1 ? 's' : ''} fallaron — revisá los detalles abajo`}
          </div>
        )}

        {/* Resultados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {corriendo && resultados.length === 0 && (
            <div style={{ color: '#86868b', fontSize: 14, textAlign: 'center', padding: 32 }}>
              ⏳ Ejecutando tests...
            </div>
          )}
          {resultados.map((r, i) => (
            <div key={i} style={{
              background: '#1c1c1e',
              border: `1px solid ${r.ok ? 'rgba(48,209,88,0.2)' : 'rgba(255,59,48,0.3)'}`,
              borderRadius: 12, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: r.detalle ? 6 : 0 }}>
                <span style={{ fontSize: 16 }}>{r.ok ? '✅' : '❌'}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: r.ok ? '#ebebf5' : '#ff3b30' }}>{r.nombre}</span>
              </div>
              {r.detalle && (
                <div style={{ fontSize: 12, color: '#86868b', fontFamily: 'monospace', paddingLeft: 26 }}>
                  → {r.detalle}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botón re-ejecutar */}
        <button
          onClick={ejecutar}
          disabled={corriendo}
          style={{
            background: corriendo ? '#2c2c2e' : '#2563EB', color: corriendo ? '#3a3a3c' : '#000',
            border: 'none', borderRadius: 10, padding: '13px 28px',
            fontSize: 14, fontWeight: 700, cursor: corriendo ? 'not-allowed' : 'pointer',
          }}
        >
          {corriendo ? '⏳ Ejecutando...' : '▶ Volver a ejecutar'}
        </button>

        <div style={{ marginTop: 20, fontSize: 11, color: '#3a3a3c' }}>
          Los documentos de test se crean y eliminan automáticamente. No afectan datos reales.
        </div>
      </div>
    </div>
  );
}

