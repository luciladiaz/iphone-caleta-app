import { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  IconChart, IconUser, IconClock, IconWarning, IconCheckCircle, IconXCircle,
  IconLock, IconBell, IconWallet, IconSearch, IconRefresh, IconMail, IconPhone, IconCheck,
} from '../components/Icons';

const EMAIL_SUPERADMIN = 'luucila20@gmail.com';

const fmtMoneda = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtFecha = (iso) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const iniciales = (nombre) => (nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const SALUD = {
  trial_activo:    { label: 'Trial activo',       color: '#2f6fed', bg: 'rgba(47,111,237,0.1)' },
  trial_vencido:   { label: 'Trial vencido',       color: '#c8790a', bg: 'rgba(200,121,10,0.12)' },
  pago_activo:     { label: 'Pago activo',         color: '#1a9c6b', bg: 'rgba(26,156,107,0.12)' },
  pago_vencido:    { label: 'Pago vencido',        color: '#d43d3d', bg: 'rgba(212,61,61,0.1)' },
  suspendido:      { label: 'Suspendido',          color: '#d43d3d', bg: 'rgba(212,61,61,0.1)' },
  sin_suscripcion: { label: 'Sin suscripción MP',  color: '#c8790a', bg: 'rgba(200,121,10,0.12)' },
};

function Badge({ salud }) {
  const s = SALUD[salud] || { label: salud, color: '#6b7686', bg: 'rgba(107,118,134,0.1)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 99, fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function Avatar({ nombre, color }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: color ? `${color}1f` : 'var(--rv-surface-alt)', color: color || 'var(--rv-text-dim)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800, letterSpacing: '-0.3px',
    }}>
      {iniciales(nombre)}
    </div>
  );
}

function KPI({ icon, label, valor, color, destacado }) {
  return (
    <div style={{
      background: destacado ? `linear-gradient(135deg, ${color}18, ${color}08)` : 'var(--rv-surface)',
      border: `1px solid ${destacado ? `${color}35` : 'var(--rv-border)'}`,
      borderRadius: 16, padding: '18px 20px', flex: '1 1 160px', minWidth: 160,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--rv-text-dim)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--rv-text)', letterSpacing: '-0.8px' }}>{valor}</div>
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

const COL_HEADERS = ['Negocio', 'Dueño', 'Email', 'Plan', 'Salud', 'Inicio', 'Vence trial', 'Próx. cobro', 'Auto-renov.', 'Último pago'];

const DIA_LABEL = { 1: 'Día 1', 4: 'Día 4', 6: 'Día 6' };
const DIA_COLOR = { 1: '#2f6fed', 4: '#c8790a', 6: '#d43d3d' };

function PendientesContacto({ negocios, onMarcar, marcando }) {
  const pendientes = negocios.filter(n => n.pendienteContacto);
  if (pendientes.length === 0) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800 }}>Mensajes de seguimiento pendientes</h2>
        <span style={{ background: 'var(--rv-danger-soft)', color: 'var(--rv-danger)', fontSize: 11.5, fontWeight: 800, borderRadius: 99, padding: '2px 9px' }}>{pendientes.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pendientes.map(n => {
          const dia = n.diaActualContacto;
          const soloDigitos = (n.telefono || '').replace(/\D/g, '');
          const linkWhatsapp = soloDigitos ? `https://wa.me/${soloDigitos}?text=${encodeURIComponent(n.mensajeSugerido || '')}` : null;
          return (
            <div key={`${n.id}-${dia}`} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Avatar nombre={n.nombre} color={DIA_COLOR[dia]} />
              <div style={{ flex: '1 1 260px', minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{n.nombre}</span>
                  <span style={{ color: 'var(--rv-text-dim)', fontSize: 12.5 }}>{n.nombreDueño || 'sin dueño registrado'}</span>
                  <span style={{ background: `${DIA_COLOR[dia]}18`, color: DIA_COLOR[dia], fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '2px 9px' }}>{DIA_LABEL[dia]} de trial</span>
                </div>
                <p style={{ color: 'var(--rv-text-mid)', fontSize: 12.5, lineHeight: 1.5 }}>{n.mensajeSugerido}</p>
                {!n.telefono && <p style={{ color: 'var(--rv-text-dim)', fontSize: 11.5, marginTop: 4 }}>Sin teléfono cargado — se le manda el mail automático del día correspondiente.</p>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {linkWhatsapp && (
                  <a href={linkWhatsapp} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#22c55e18', color: '#16a34a', border: '1px solid #22c55e35', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 700 }}>
                    <IconPhone size={13} /> WhatsApp
                  </a>
                )}
                <button
                  onClick={() => onMarcar(n.id, dia, true)}
                  disabled={marcando.has(`${n.id}-${dia}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, cursor: marcando.has(`${n.id}-${dia}`) ? 'default' : 'pointer', opacity: marcando.has(`${n.id}-${dia}`) ? 0.6 : 1 }}
                >
                  <IconCheck size={13} /> Ya le escribí
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [marcando, setMarcando] = useState(new Set());
  const [vista, setVista] = useState('resumen');

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

  const marcarContacto = async (negocioId, dia, contactado) => {
    const clave = `${negocioId}-${dia}`;
    setMarcando(prev => new Set(prev).add(clave));
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ negocioId, dia, contactado }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Error ${res.status}`);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setMarcando(prev => { const s = new Set(prev); s.delete(clave); return s; });
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
    <div style={{ minHeight: '100vh', background: 'var(--rv-bg)', color: 'var(--rv-text)', fontFamily: 'Manrope, sans-serif' }}>
      <style>{`
        .sa-row { transition: background-color 0.12s ease; }
        .sa-row:hover { background: var(--rv-surface-alt); }
        .sa-filtro { transition: background-color 0.15s ease, color 0.15s ease; }
        .sa-refresh:hover { background: var(--rv-border) !important; }
        .sa-spin { animation: sa-spin-kf 0.8s linear infinite; }
        @keyframes sa-spin-kf { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sa-thead th { position: sticky; top: 0; background: var(--rv-surface-alt); z-index: 1; }
      `}</style>

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 24px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--rv-accent), #5a8ff2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(47,111,237,0.28)',
            }}>
              <IconChart size={22} style={{ color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px' }}>Panel de negocio</h1>
              <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginTop: 2 }}>Todos los negocios de ReventApp, actualizado al día.</p>
            </div>
          </div>
          <button
            className="sa-refresh"
            onClick={cargar}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 10,
              padding: '10px 18px', color: 'var(--rv-text)', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            <span className={loading ? 'sa-spin' : ''} style={{ display: 'inline-flex' }}><IconRefresh size={15} /></span>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', borderRadius: 12, padding: '14px 18px', color: 'var(--rv-danger)', fontSize: 13, marginBottom: 20 }}>
            <IconWarning size={16} /> {error}
          </div>
        )}

        {loading && !datos && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--rv-text-dim)', padding: '40px 0' }}>
            <span className="sa-spin" style={{ display: 'inline-flex' }}><IconRefresh size={16} /></span> Cargando…
          </div>
        )}

        {datos && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--rv-border)' }}>
              {[
                { key: 'resumen', label: 'Resumen' },
                { key: 'seguimiento', label: 'Seguimiento de trial', badge: datos.resumen.pendientesContacto },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setVista(t.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '10px 4px', marginRight: 22,
                    color: vista === t.key ? 'var(--rv-accent)' : 'var(--rv-text-dim)',
                    fontSize: 14, fontWeight: 700,
                    borderBottom: vista === t.key ? '2px solid var(--rv-accent)' : '2px solid transparent',
                  }}
                >
                  {t.label}
                  {!!t.badge && (
                    <span style={{ background: vista === t.key ? 'var(--rv-accent)' : 'var(--rv-danger-soft)', color: vista === t.key ? '#fff' : 'var(--rv-danger)', fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '1px 8px' }}>{t.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {vista === 'seguimiento' && (
              <PendientesContacto negocios={datos.negocios} onMarcar={marcarContacto} marcando={marcando} />
            )}

            {vista === 'resumen' && (
              <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 26 }}>
              <KPI icon={<IconUser size={14} />} label="Total negocios" valor={datos.resumen.total} color="#45505f" />
              <KPI icon={<IconClock size={14} />} label="Trial activo" valor={datos.resumen.trialActivo} color="#2f6fed" />
              <KPI icon={<IconWarning size={14} />} label="Trial vencido" valor={datos.resumen.trialVencido} color="#c8790a" />
              <KPI icon={<IconCheckCircle size={14} />} label="Pagando" valor={datos.resumen.pagoActivo} color="#1a9c6b" />
              <KPI icon={<IconXCircle size={14} />} label="Pago vencido" valor={datos.resumen.pagoVencido} color="#d43d3d" />
              <KPI icon={<IconLock size={14} />} label="Suspendidos" valor={datos.resumen.suspendido} color="#d43d3d" />
              <KPI icon={<IconBell size={14} />} label="Vencen en 7 días" valor={datos.resumen.proximosAVencer} color="#c8790a" />
              <KPI icon={<IconWallet size={15} />} label="MRR estimado" valor={fmtMoneda(datos.resumen.mrrEstimado)} color="#1a9c6b" destacado />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220 }}>
                <IconSearch size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--rv-text-dim)' }} />
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por negocio, dueño o email…"
                  style={{ width: '100%', background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 14px 10px 36px', color: 'var(--rv-text)', fontSize: 13 }}
                />
              </div>
              {FILTROS.map(f => (
                <button
                  key={f.key}
                  className="sa-filtro"
                  onClick={() => setFiltro(f.key)}
                  style={{
                    background: filtro === f.key ? 'var(--rv-accent)' : 'var(--rv-surface)',
                    color: filtro === f.key ? '#fff' : 'var(--rv-text-dim)',
                    border: `1px solid ${filtro === f.key ? 'var(--rv-accent)' : 'var(--rv-border)'}`,
                    borderRadius: 99, padding: '8px 15px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ color: 'var(--rv-text-dim)', fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>
              {negociosFiltrados.length} {negociosFiltrados.length === 1 ? 'negocio' : 'negocios'}
            </div>

            <div style={{ border: '1px solid var(--rv-border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(16,24,40,0.04)' }}>
              <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead className="sa-thead">
                    <tr style={{ textAlign: 'left' }}>
                      {COL_HEADERS.map(h => (
                        <th key={h} style={{ padding: '12px 14px', color: 'var(--rv-text-dim)', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap', borderBottom: '1px solid var(--rv-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {negociosFiltrados.map(n => {
                      const color = (SALUD[n.salud] || {}).color;
                      return (
                        <tr key={n.id} className="sa-row" style={{ borderTop: '1px solid var(--rv-border)' }}>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar nombre={n.nombre} color={color} />
                              <div>
                                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {n.nombre}
                                  {n.esDemo && <span style={{ fontSize: 9.5, color: 'var(--rv-text-dim)', fontWeight: 700, border: '1px solid var(--rv-border)', borderRadius: 5, padding: '1px 5px' }}>DEMO</span>}
                                </div>
                                {n.telefono && (
                                  <div style={{ fontSize: 11.5, color: 'var(--rv-text-dim)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                                    <IconPhone size={10} /> {n.telefono}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px' }}>{n.nombreDueño || '—'}</td>
                          <td style={{ padding: '11px 14px', color: 'var(--rv-text-dim)' }}>
                            {n.email ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconMail size={11} /> {n.email}</span> : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', textTransform: 'capitalize' }}>{n.plan}</td>
                          <td style={{ padding: '11px 14px' }}><Badge salud={n.salud} /></td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', color: 'var(--rv-text-mid)' }}>{fmtFecha(n.creadoEn)}</td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            {n.plan === 'trial' ? (
                              <>
                                <span style={{ color: 'var(--rv-text-mid)' }}>{fmtFecha(n.venceTrial)}</span>
                                {n.diasTrialRestantes !== null && (
                                  <span style={{ color: n.diasTrialRestantes <= 0 ? 'var(--rv-danger)' : 'var(--rv-text-dim)', fontSize: 11.5 }}> {n.diasTrialRestantes <= 0 ? '(vencido)' : `(${n.diasTrialRestantes}d)`}</span>
                                )}
                              </>
                            ) : <span style={{ color: 'var(--rv-text-dim)' }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            {n.plan !== 'trial' ? (
                              <>
                                <span style={{ color: 'var(--rv-text-mid)' }}>{fmtFecha(n.vencePlan)}</span>
                                {n.diasHastaVencimiento !== null && (
                                  <span style={{ color: n.diasHastaVencimiento <= 0 ? 'var(--rv-danger)' : 'var(--rv-text-dim)', fontSize: 11.5 }}> {n.diasHastaVencimiento <= 0 ? '(vencido)' : `(${n.diasHastaVencimiento}d)`}</span>
                                )}
                              </>
                            ) : <span style={{ color: 'var(--rv-text-dim)' }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {n.renovacionAutomatica
                              ? <span style={{ color: '#1a9c6b', display: 'inline-flex' }}><IconCheckCircle size={16} /></span>
                              : <span style={{ color: 'var(--rv-text-dim)' }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            {n.ultimoPagoRegistro ? (
                              <span style={{ color: n.ultimoPagoRegistro.estado === 'exitoso' ? '#1a9c6b' : '#c8790a', fontSize: 12 }}>
                                {n.ultimoPagoRegistro.tipo} · {fmtFecha(n.ultimoPagoRegistro.fecha)}
                              </span>
                            ) : <span style={{ color: 'var(--rv-text-dim)' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {negociosFiltrados.length === 0 && (
                      <tr><td colSpan={COL_HEADERS.length} style={{ padding: 40, textAlign: 'center', color: 'var(--rv-text-dim)' }}>Sin resultados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
