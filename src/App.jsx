import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Ventas from './pages/Ventas';
import Cobros from './pages/Cobros';
import Proveedores from './pages/Proveedores';
import PagosProveedores from './pages/PagosProveedores';
import Configuracion from './pages/Configuracion';
import Usuarios from './pages/Usuarios';
import Planes from './pages/Planes';
import CatalogoPublico from './pages/CatalogoPublico';
import DashboardGerencial from './pages/DashboardGerencial';
import ReporteVendedores from './pages/ReporteVendedores';
import DevSeed from './pages/DevSeed';
import AppTest from './pages/AppTest';
import TestPagos from './pages/TestPagos';

function PrivateRoute({ children, modulo }) {
  const { user, puedeVer, planActivo, motivoBloqueo } = useAuth();

  if (!user) return <Navigate to="/landing" />;

  if (!planActivo) return <Navigate to={`/planes?motivo=${motivoBloqueo || 'vencido'}`} />;

  if (modulo && !puedeVer(modulo)) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#86868b', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <p>No tenés permiso para acceder a esta sección.</p>
    </div>
  );

  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Rutas de desarrollo */}
      <Route path="/dev/seed" element={<DevSeed />} />
      <Route path="/test" element={<AppTest />} />
      <Route path="/test-pagos" element={<TestPagos />} />

      {/* Rutas públicas */}
      <Route path="/landing" element={<Landing />} />
      <Route path="/registro" element={user ? <Navigate to="/" /> : <Registro />} />
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/catalogo/:negocioId" element={<CatalogoPublico />} />

      {/* /planes no usa PrivateRoute con planActivo para evitar loop cuando vence */}
      <Route path="/planes" element={user ? <Layout><Planes /></Layout> : <Navigate to="/landing" />} />

      {/* Rutas privadas */}
      <Route path="/" element={<PrivateRoute modulo="dashboard"><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/stock" element={<PrivateRoute modulo="stock"><Layout><Stock /></Layout></PrivateRoute>} />
      <Route path="/ventas" element={<PrivateRoute modulo="ventas"><Layout><Ventas /></Layout></PrivateRoute>} />
      <Route path="/cobros" element={<PrivateRoute modulo="cobros"><Layout><Cobros /></Layout></PrivateRoute>} />
      <Route path="/proveedores" element={<PrivateRoute modulo="proveedores"><Layout><Proveedores /></Layout></PrivateRoute>} />
      <Route path="/pagos" element={<PrivateRoute modulo="pagos"><Layout><PagosProveedores /></Layout></PrivateRoute>} />
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
