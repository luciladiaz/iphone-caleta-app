import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BannerTrial from './BannerTrial';

const SZ = { width: 17, height: 17, flexShrink: 0 };
const SA = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round', strokeLinejoin: 'round' };

const NAV = [
  { to: '/', label: 'Dashboard', modulo: 'dashboard', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <rect x="3" y="10" width="4" height="11" rx="1"/><rect x="10" y="5" width="4" height="16" rx="1"/><rect x="17" y="1" width="4" height="20" rx="1"/>
    </svg>
  )},
  { to: '/stock', label: 'Stock', modulo: 'stock', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
    </svg>
  )},
  { to: '/ventas', label: 'Ventas', modulo: 'ventas', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>
    </svg>
  )},
  { to: '/cobros', label: 'Cobros', modulo: 'cobros', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M6 14.5h2M11 14.5h3"/>
    </svg>
  )},
  { to: '/proveedores', label: 'Proveedores', modulo: 'proveedores', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <path d="M3 21V9.5L12 3l9 6.5V21H3z"/><path d="M9 21V14h6v7"/>
    </svg>
  )},
  { to: '/pagos', label: 'Pagos Prov.', modulo: 'pagos', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5V18"/>
    </svg>
  )},
  { to: '/gerencial', label: 'Gerencial', modulo: 'gerencial', feature: 'dashboardGerencial', icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  )},
  { to: '/vendedores', label: 'Rendimiento', modulo: 'vendedores', feature: 'reportesPorVendedor', icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )},
  { to: '/config', label: 'Configuración', modulo: 'config', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )},
  { to: '/usuarios', label: 'Usuarios', modulo: 'usuarios', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )},
  { to: '/planes', label: 'Mi Plan', modulo: 'planes', siempre: true, icon: (
    <svg viewBox="0 0 24 24" style={SZ} {...SA}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )},
];

function PlanBadge({ plan, diasRestantesTrial }) {
  if (!plan) return null;
  const configs = {
    trial:   { label: `Trial · ${diasRestantesTrial ?? '?'} días`, color: '#2563EB', stars: '🧪' },
    basico:  { label: 'Plan Básico',  color: '#86868b', stars: '⭐' },
    pro:     { label: 'Plan Pro',     color: '#2563EB', stars: '⭐⭐' },
    promax:  { label: 'Pro Max',      color: '#ffd700', stars: '⭐⭐⭐' },
    agencia: { label: 'Pro Max',      color: '#ffd700', stars: '⭐⭐⭐' },
  };
  const cfg = configs[plan] || configs.basico;
  return (
    <NavLink to="/planes" style={{ textDecoration: 'none', display: 'block', margin: '8px 12px 0' }}>
      <div style={{
        background: 'rgba(37,99,235,0.12)', borderRadius: 8, padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 12 }}>{cfg.stars}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
      </div>
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { perfil, logout, puedeVer, tieneFeature, plan, diasRestantesTrial, negocio } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const navItems = NAV.filter(n => {
    if (!puedeVer(n.modulo) && n.siempre !== true) return false;
    return true;
  });

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 20px', borderBottom: '1px solid rgba(37,99,235,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {negocio?.logoUrl
            ? <img src={negocio.logoUrl} alt="logo" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
            : <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: '#fff', flexShrink: 0 }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          }
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {negocio?.nombre || 'ReventApp'}
            </div>
            <div style={{ color: '#2563EB', fontSize: 11, fontWeight: 600 }}>
              {perfil?.rol === 'admin' ? 'Administrador' : 'Vendedor'}
            </div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
        {navItems.map(({ to, label, icon, feature }) => {
          const bloqueado = feature && !tieneFeature(feature);
          return (
            <NavLink key={to} to={to} end={to === '/'}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none', fontSize: 14, fontWeight: 500,
                background: isActive ? 'rgba(37,99,235,0.12)' : 'transparent',
                color: isActive ? '#7DD3FC' : bloqueado ? '#3a3a3c' : '#ebebf5cc',
                borderLeft: isActive ? '3px solid #2563EB' : '3px solid transparent',
                transition: 'all .15s',
              })}
            >
              {icon}
              <span>{label}</span>
              {bloqueado && <span style={{ fontSize: 11, color: '#3a3a3c', marginLeft: 'auto' }}>🔒</span>}
            </NavLink>
          );
        })}
      </nav>

      <PlanBadge plan={plan} diasRestantesTrial={diasRestantesTrial} />

      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(37,99,235,0.2)', marginTop: 8 }}>
        <div style={{ color: '#86868b', fontSize: 12, marginBottom: 8, paddingLeft: 4 }}>
          {perfil?.nombre || perfil?.email}
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '9px', background: 'rgba(255,59,48,0.1)',
          border: '1px solid rgba(255,59,48,0.2)', borderRadius: 8,
          color: '#ff3b30', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Cerrar sesión</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar desktop */}
      <aside style={{
        width: 220, background: '#1e293b', borderRight: '1px solid rgba(37,99,235,0.2)',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
      }} className="sidebar-desktop">
        <SidebarContent />
      </aside>

      {/* Header mobile */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        background: '#1e293b', borderBottom: '1px solid rgba(37,99,235,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 60,
      }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {negocio?.logoUrl
            ? <img src={negocio.logoUrl} alt="logo" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
            : <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: '#fff' }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          }
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{negocio?.nombre || 'ReventApp'}</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{
          background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
        }}>☰</button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: '#1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }}>
            <button onClick={() => setMenuOpen(false)} style={{
              background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer',
            }}>✕</button>
          </div>
          <SidebarContent />
        </div>
      )}

      {/* Main content */}
      <main style={{
        marginLeft: 220, flex: 1, padding: '32px 28px',
        minHeight: '100vh', color: '#fff',
      }} className="main-content">
        <BannerTrial />
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-header { display: flex !important; }
          .main-content { margin-left: 0 !important; padding-top: 72px !important; padding-left: 16px !important; padding-right: 16px !important; }
        }
        @media (min-width: 769px) {
          .mobile-header { display: none !important; }
        }
      `}</style>
    </div>
  );
}

