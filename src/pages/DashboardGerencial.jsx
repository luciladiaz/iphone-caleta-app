import { useAuth } from '../context/AuthContext';
import FeatureBloqueada from '../components/FeatureBloqueada';

export default function DashboardGerencial() {
  const { tieneFeature } = useAuth();

  if (!tieneFeature('dashboardGerencial')) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>📈 Dashboard Gerencial</h1>
        <FeatureBloqueada
          feature="Dashboard Gerencial"
          planRequerido="promax"
          descripcion="Vista ejecutiva de tu negocio completo. Ventas totales, rendimiento por vendedor, punto de venta más rentable y más."
        />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>📈 Dashboard Gerencial</h1>
      <p style={{ color: '#86868b', fontSize: 14, marginBottom: 28 }}>Próximamente — Estamos construyendo esta sección.</p>
      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 40, textAlign: 'center', color: '#86868b' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
        <p>El dashboard gerencial estará disponible pronto.</p>
      </div>
    </div>
  );
}
