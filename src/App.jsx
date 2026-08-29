import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Ventas from './pages/Ventas';
import Cobros from './pages/Cobros';
import Caja from './pages/Caja';
import Clientes from './pages/Clientes';
import Proveedores from './pages/Proveedores';
import Configuracion from './pages/Configuracion';
import Usuarios from './pages/Usuarios';
import Planes from './pages/Planes';
import CatalogoPublico from './pages/CatalogoPublico';
import DashboardGerencial from './pages/DashboardGerencial';
import ReporteVendedores from './pages/ReporteVendedores';
import DevSeed from './pages/DevSeed';
import AppTest from './pages/AppTest';
import Studio from './pages/Studio';
import SuperAdmin from './pages/SuperAdmin';
import Accesorios from './pages/Accesorios';
import Reparaciones from './pages/Reparaciones';

function PrivateRoute({ children, modulo }) {
  const { user, perfil, negocioId, puedeVer, planActivo, motivoBloqueo, logout } = useAuth();

  if (!user) return <Navigate to="/landing" />;

  // Solo exigir verificación a admins auto-registrados (negocioId === su propio uid)
  // Los sub-usuarios creados por un admin quedan exentos
  if (!user.emailVerified && negocioId === user.uid) return <Navigate to="/login" />;

  if (!planActivo) return <Navigate to={`/planes?motivo=${motivoBloqueo || 'vencido'}`} />;

  // Un admin puede desactivar a un vendedor desde Usuarios sin borrar su cuenta.
  // Si `perfil` todavía no cargó (carrera al registrarse) no se bloquea.
  if (perfil && perfil.activo === false) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--rv-text-dim)', fontFamily: 'Manrope, sans-serif' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <p>Tu cuenta fue desactivada. Consultá con el administrador de tu negocio.</p>
      <button onClick={logout} style={{ marginTop: 16, background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '10px 20px', color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cerrar sesión</button>
    </div>
  );

  if (modulo && !puedeVer(modulo)) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--rv-text-dim)', fontFamily: 'Manrope, sans-serif' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <p>No tenés permiso para acceder a esta sección.</p>
    </div>
  );

  return children;
}

function AppRoutes() {
  const { user, negocioId, plan } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirectTo = params.get('redirect') || '/';
  // Compra directa en curso (?comprar=1, plan todavía no es promax): no envolver en Layout
  // para que el sidebar/panel interno no se vea ni un instante antes de ir a MercadoPago.
  const comprandoSinLayout = params.get('comprar') === '1' && negocioId && plan && plan !== 'promax';

  return (
    <Routes>
      {/* Rutas de desarrollo: SOLO existen en `npm run dev` local. import.meta.env.DEV es
          false en el build de producción, así que ni siquiera quedan estas rutas armadas
          (antes /dev/seed y /test estaban vivas en reventapp.com.ar sin ningún login —
          /dev/seed crea cuentas reales en la base de producción con contraseñas
          hardcodeadas en el código fuente que se manda al navegador). */}
      {import.meta.env.DEV && <Route path="/dev/seed" element={<DevSeed />} />}
      {import.meta.env.DEV && <Route path="/test" element={<AppTest />} />}

      {/* Rutas públicas */}
      <Route path="/landing" element={<Landing />} />
      <Route path="/registro" element={user && user.emailVerified ? <Navigate to="/" /> : <Registro />} />
      <Route path="/login" element={user && user.emailVerified ? <Navigate to={redirectTo} /> : <Login />} />
      <Route path="/catalogo/:negocioId" element={<CatalogoPublico />} />

      {/* /planes no usa PrivateRoute con planActivo para evitar loop cuando vence.
          Si no hay sesión (ej: click desde un mail en otro dispositivo), manda a
          /login con un redirect de vuelta a /planes en vez de perderse en /landing. */}
      <Route path="/planes" element={
        user
          ? (comprandoSinLayout ? <Planes /> : <Layout><Planes /></Layout>)
          // Preserva query params (ej: ?comprar=1 de un link directo de pago) a través del
          // login -- antes se perdían y el modal de pago no se abría solo después de loguearse.
          : <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} />
      } />

      {/* /studio — privado, acceso solo al owner. El componente hace la verificación de email. */}
      <Route path="/studio" element={<Studio />} />

      {/* /superadmin — privado, acceso solo al owner. El componente y el endpoint /api/superadmin
          verifican el email por separado (nunca confiar solo en el chequeo del cliente). */}
      <Route path="/superadmin" element={<SuperAdmin />} />

      {/* Rutas privadas */}
      <Route path="/" element={<PrivateRoute modulo="dashboard"><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/stock" element={<PrivateRoute modulo="stock"><Layout><Stock /></Layout></PrivateRoute>} />
      <Route path="/accesorios" element={<PrivateRoute modulo="accesorios"><Layout><Accesorios /></Layout></PrivateRoute>} />
      <Route path="/ventas" element={<PrivateRoute modulo="ventas"><Layout><Ventas /></Layout></PrivateRoute>} />
      <Route path="/clientes" element={<PrivateRoute modulo="clientes"><Layout><Clientes /></Layout></PrivateRoute>} />
      <Route path="/cobros" element={<PrivateRoute modulo="cobros"><Layout><Cobros /></Layout></PrivateRoute>} />
      <Route path="/caja" element={<PrivateRoute modulo="caja"><Layout><Caja /></Layout></PrivateRoute>} />
      <Route path="/reparaciones" element={<PrivateRoute modulo="reparaciones"><Layout><Reparaciones /></Layout></PrivateRoute>} />
      <Route path="/proveedores" element={<PrivateRoute modulo="proveedores"><Layout><Proveedores /></Layout></PrivateRoute>} />
      <Route path="/config" element={<PrivateRoute modulo="config"><Layout><Configuracion /></Layout></PrivateRoute>} />
      <Route path="/usuarios" element={<PrivateRoute modulo="usuarios"><Layout><Usuarios /></Layout></PrivateRoute>} />
      <Route path="/gerencial" element={<PrivateRoute modulo="gerencial"><Layout><DashboardGerencial /></Layout></PrivateRoute>} />
      <Route path="/vendedores" element={<PrivateRoute modulo="vendedores"><Layout><ReporteVendedores /></Layout></PrivateRoute>} />

      <Route path="*" element={<Navigate to={user ? '/' : '/landing'} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

