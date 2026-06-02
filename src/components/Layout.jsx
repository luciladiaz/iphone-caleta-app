import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/',            label: 'Dashboard',    icon: '📊', modulo: 'dashboard' },
  { to: '/stock',       label: 'Stock',        icon: '📦', modulo: 'stock' },
  { to: '/ventas',      label: 'Ventas',       icon: '💰', modulo: 'ventas' },
  { to: '/cobros',      label: 'Cobros',       icon: '💳', modulo: 'cobros' },
  { to: '/proveedores', label: 'Proveedores',  icon: '🏭', modulo: 'proveedores' },
  { to: '/pagos',       label: 'Pagos Prov.',  icon: '📤', modulo: 'pagos' },
  { to: '/config',      label: 'Configuración',icon: '⚙️', modulo: 'config' },
  { to: '/usuarios',    label: 'Usuarios',     icon: '👥', modulo: 'usuarios' },
];

export default function Layout({ children }) {
  const { perfil, logout, puedeVer } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const navItems = NAV.filter(n => puedeVer(n.modulo));

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid #2c2c2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: '#fff', flexShrink: 0 }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>iPhone Caleta</div>
            <div style={{ color: '#c9a96e', fontSize: 11, fontWeight: 600 }}>
              {perfil?.rol === 'admin' ? 'Administrador' : 'Vendedor'}
            </div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
        {navItems.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={() => setMenuOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, marginBottom: 2,
              textDecoration: 'none', fontSize: 14, fontWeight: 500,
              background: isActive ? 'rgba(201,169,110,0.12)' : 'transparent',
              color: isActive ? '#c9a96e' : '#ebebf5cc',
              borderLeft: isActive ? '3px solid #c9a96e' : '3px solid transparent',
              transition: 'all .15s'
            })}
          >
            <span style={{ fontSize: 18 }}>{icon}</span> {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid #2c2c2e' }}>
        <div style={{ color: '#86868b', fontSize: 12, marginBottom: 8, paddingLeft: 4 }}>
          {perfil?.nombre || perfil?.email}
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '9px', background: 'rgba(255,59,48,0.1)',
          border: '1px solid rgba(255,59,48,0.2)', borderRadius: 8,
          color: '#ff3b30', fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>Cerrar sesión</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0d0d', fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar desktop */}
      <aside style={{
        width: 220, background: '#1c1c1e', borderRight: '1px solid #2c2c2e',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        display: window.innerWidth < 768 ? 'none' : 'flex',
        flexDirection: 'column'
      }} className="sidebar-desktop">
        <SidebarContent />
      </aside>

      {/* Header mobile */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        background: '#1c1c1e', borderBottom: '1px solid #2c2c2e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 60
      }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: '#fff' }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>iPhone Caleta</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{
          background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer'
        }}>☰</button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 70, background: '#1c1c1e'
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }}>
            <button onClick={() => setMenuOpen(false)} style={{
              background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer'
            }}>✕</button>
          </div>
          <SidebarContent />
        </div>
      )}

      {/* Main content */}
      <main style={{
        marginLeft: 220, flex: 1, padding: '32px 28px',
        minHeight: '100vh', color: '#fff'
      }} className="main-content">
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
