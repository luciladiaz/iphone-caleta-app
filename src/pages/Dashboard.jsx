import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14,
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ color: '#86868b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || '#c9a96e', letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#86868b' }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { perfil } = useAuth();
  const [stats, setStats] = useState({ stockTotal: 0, ventasMes: 0, pendientesCobro: 0, stockDisponible: 0 });
  const [ventasRecientes, setVentasRecientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [stockSnap, ventasSnap] = await Promise.all([
          getDocs(collection(db, 'stock')),
          getDocs(query(collection(db, 'ventas'), orderBy('fecha', 'desc'), limit(5)))
        ]);

        const stock = stockSnap.docs.map(d => d.data());
        const ventas = ventasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        const ventasMes = ventas.filter(v => {
          const fecha = v.fecha?.toDate?.() || new Date(v.fecha);
          return fecha >= primerDiaMes;
        });

        setStats({
          stockTotal: stock.length,
          stockDisponible: stock.filter(s => s.estado === 'disponible').length,
          ventasMes: ventasMes.length,
          pendientesCobro: ventas.filter(v => v.estado === 'pendiente').length,
        });
        setVentasRecientes(ventas);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.5px' }}>Dashboard</h1>
      <p style={{ color: '#86868b', fontSize: 14, marginBottom: 32 }}>
        Bienvenido, {perfil?.nombre || 'Admin'} 👋
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
        <StatCard icon="📦" label="Stock total" value={stats.stockTotal} sub={`${stats.stockDisponible} disponibles`} />
        <StatCard icon="💰" label="Ventas este mes" value={stats.ventasMes} color="#30d158" />
        <StatCard icon="⏳" label="Ventas pendientes" value={stats.pendientesCobro} color="#ff9f0a" />
      </div>

      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Últimas ventas</h2>
        {ventasRecientes.length === 0 ? (
          <p style={{ color: '#86868b', fontSize: 14 }}>No hay ventas registradas aún.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ventasRecientes.map(v => (
              <div key={v.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#2c2c2e', borderRadius: 10
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.modelo || 'Equipo'}</div>
                  <div style={{ color: '#86868b', fontSize: 12 }}>{v.cliente || 'Sin cliente'} · {v.vendedor || ''}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                  background: v.estado === 'entregado' ? 'rgba(48,209,88,.15)' : v.estado === 'cancelado' ? 'rgba(255,59,48,.15)' : 'rgba(255,159,10,.15)',
                  color: v.estado === 'entregado' ? '#30d158' : v.estado === 'cancelado' ? '#ff3b30' : '#ff9f0a'
                }}>
                  {v.estado || 'pendiente'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
