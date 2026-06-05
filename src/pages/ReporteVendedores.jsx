import { useAuth } from '../context/AuthContext';
import FeatureBloqueada from '../components/FeatureBloqueada';

export default function ReporteVendedores() {
  const { tieneFeature } = useAuth();

  if (!tieneFeature('reportesPorVendedor')) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>🤝 Rendimiento por Vendedor</h1>
        <FeatureBloqueada
          feature="Reportes por Vendedor"
          planRequerido="promax"
          descripcion="Conocé el rendimiento de cada vendedor. Quién vendió más, quién tiene más cobros pendientes, y el ranking del mes."
        />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>🤝 Rendimiento por Vendedor</h1>
      <p style={{ color: '#86868b', fontSize: 14, marginBottom: 28 }}>Próximamente — Estamos construyendo esta sección.</p>
      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 40, textAlign: 'center', color: '#86868b' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
        <p>Los reportes por vendedor estarán disponibles pronto.</p>
      </div>
    </div>
  );
}
