import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Ventas from './pages/Ventas';
import Cobros from './pages/Cobros';
import Proveedores from './pages/Proveedores';
import PagosProveedores from './pages/PagosProveedores';
import Configuracion from './pages/Configuracion';
import Usuarios from './pages/Usuarios';

function PrivateRoute({ children, modulo }) {
  const { user, puedeVer } = useAuth();
  if (!user) return <Navigate to="/login" />;
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
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute modulo="dashboard"><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/stock" element={<PrivateRoute modulo="stock"><Layout><Stock /></Layout></PrivateRoute>} />
      <Route path="/ventas" element={<PrivateRoute modulo="ventas"><Layout><Ventas /></Layout></PrivateRoute>} />
      <Route path="/cobros" element={<PrivateRoute modulo="cobros"><Layout><Cobros /></Layout></PrivateRoute>} />
      <Route path="/proveedores" element={<PrivateRoute modulo="proveedores"><Layout><Proveedores /></Layout></PrivateRoute>} />
      <Route path="/pagos" element={<PrivateRoute modulo="pagos"><Layout><PagosProveedores /></Layout></PrivateRoute>} />
      <Route path="/config" element={<PrivateRoute modulo="config"><Layout><Configuracion /></Layout></PrivateRoute>} />
      <Route path="/usuarios" element={<PrivateRoute modulo="usuarios"><Layout><Usuarios /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
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
