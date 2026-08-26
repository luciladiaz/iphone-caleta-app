import { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EMAIL_SUPERADMIN = 'luucila20@gmail.com';

const fmtMoneda = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtFecha = (iso) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const SALUD = {
  trial_activo:    { label: 'Trial activo',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  trial_vencido:   { label: 'Trial vencido',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  pago_activo:     { label: 'Pago activo',        color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  pago_vencido:    { label: 'Pago vencido',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  suspendido:      { label: 'Suspendido',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  sin_suscripcion: { label: 'Sin suscripción MP',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

function Badge({ salud }) {
  const s = SALUD[salud] || { label: salud, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
  return (
    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function KPI({ label, valor, color }) {
  return (
    <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '18px 20px', flex: '1 1 140px', minWidth: 140 }}>
      <div style={{ color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--rv-text)', letterSpacing: '-1px' }}>{valor}</div>
    </div>
  );
}

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'trial_activo', label: 'Trial activo' },
  { key: 'trial_vencido', label: 'Trial vencido' },
  { key: 'pago_activo', label: 'Pago activo' },
  { key: 'pago_vencido', label: 'Pago vencido' },
  { key: 'suspendido', label: 'Suspendido' },
  { key: 'sin_suscripcion', label: 'Sin suscripción' },
];

export default function SuperAdmin() {
  const { user } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!user || user.email !== EMAIL_SUPERADMIN) { setLoading(false); return; }
    cargar();
  }, [user]);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/superadmin', { headers: { Authorization: `Bearer ${idToken}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setDatos(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const negociosFiltrados = useMemo(() => {
    if (!datos) return [];
    let lista = datos.negocios;
    if (filtro !== 'todos') lista = lista.filter(n => n.salud === filtro);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(n =>
        n.nombre.toLowerCase().includes(q) ||
        (n.email || '').toLowerCase().includes(q) ||
        (n.nombreDueño || '').toLowerCase().includes(q)
      );
    }
    return lista;
  }, [datos, filtro, busqueda]);

  if (!user) return <Navigate to="/login?redirect=/superadmin" />;
  if (user.email !== EMAIL_SUPERADMIN) return <Navigate to="/" />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--rv-bg)', color: 'var(--rv-text)', fontFamily: 'Manrope, sans-serif', padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Panel de negocio</h1>
            <p style={{ color: 'var(--rv-text-dim)', fontSize: 13 }}>Todos los negocios de ReventApp, actualizado al día.</p>
          </div>
          <button onClick={cargar} disabled={loading} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '10px 18px', color: 'var(--rv-text)', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {loading && !datos && <p style={{ color: 'var(--rv-text-dim)' }}>Cargando…</p>}

        {datos && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <KPI label="Total negocios" valor={datos.resumen.total} />
              <KPI label="Trial activo" valor={datos.resumen.trialActivo} color="#3b82f6" />
              <KPI label="Trial vencido" valor={datos.resumen.trialVencido} color="#f59e0b" />
              <KPI label="Pagando" valor={datos.resumen.pagoActivo} color="#10b981" />
              <KPI label="Pago vencido" valor={datos.resumen.pagoVencido} color="#ef4444" />
              <KPI label="Suspendidos" valor={datos.resumen.suspendido} color="#ef4444" />
              <KPI label="Vencen en 7 días" valor={datos.resumen.proximosAVencer} color="#f59e0b" />
              <KPI label="MRR estimado" valor={fmtMoneda(datos.resumen.mrrEstimado)} color="#10b981" />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por negocio, dueño o email…"
                style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '9px 14px', color: 'var(--rv-text)', fontSize: 13, minWidth: 240, flex: '1 1 240px' }}
              />
              {FILTROS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  style={{
                    background: filtro === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)',
                    color: filtro === f.key ? '#fff' : 'var(--rv-text-dim)',
                    border: '1px solid var(--rv-border)', borderRadius: 99, padding: '7px 14px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--rv-border)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--rv-surface-alt)', textAlign: 'left' }}>
                    {['Negocio', 'Dueño', 'Email', 'Plan', 'Salud', 'Inicio', 'Vence trial', 'Próx. cobro', 'Auto-renov.', 'Último pago registrado'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', color: 'var(--rv-text-dim)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {negociosFiltrados.map(n => (
                    <tr key={n.id} style={{ borderTop: '1px solid var(--rv-border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                        {n.nombre}{n.esDemo && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--rv-text-dim)', fontWeight: 600 }}>DEMO</span>}
                        {n.telefono && <div style={{ fontSize: 11, color: 'var(--rv-text-dim)', fontWeight: 500 }}>{n.telefono}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{n.nombreDueño || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--rv-text-dim)' }}>{n.email || '—'}</td>
                      <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{n.plan}</td>
                      <td style={{ padding: '10px 14px' }}><Badge salud={n.salud} /></td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{fmtFecha(n.creadoEn)}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {n.plan === 'trial' ? (
                          <>{fmtFecha(n.venceTrial)} {n.diasTrialRestantes !== null && (
                            <span style={{ color: n.diasTrialRestantes <= 0 ? '#ef4444' : 'var(--rv-text-dim)', fontSize: 11 }}> ({n.diasTrialRestantes <= 0 ? 'vencido' : `${n.diasTrialRestantes}d`})</span>
                          )}</>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {n.plan !== 'trial' ? (
                          <>{fmtFecha(n.vencePlan)} {n.diasHastaVencimiento !== null && (
                            <span style={{ color: n.diasHastaVencimiento <= 0 ? '#ef4444' : 'var(--rv-text-dim)', fontSize: 11 }}> ({n.diasHastaVencimiento <= 0 ? 'vencido' : `${n.diasHastaVencimiento}d`})</span>
                          )}</>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{n.renovacionAutomatica ? '✅' : '—'}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {n.ultimoPagoRegistro ? (
                          <span style={{ color: n.ultimoPagoRegistro.estado === 'exitoso' ? '#10b981' : '#f59e0b' }}>
                            {n.ultimoPagoRegistro.tipo} · {fmtFecha(n.ultimoPagoRegistro.fecha)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  {negociosFiltrados.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: 'var(--rv-text-dim)' }}>Sin resultados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
