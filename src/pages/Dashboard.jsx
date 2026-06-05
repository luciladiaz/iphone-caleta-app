import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

function StatCard({ icon, label, value, sub, color, bg }) {
  return (
    <div style={{
      background: bg || '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14,
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ color: '#86868b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || '#c9a96e', letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#86868b' }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { perfil, negocioId } = useAuth();
  const [stats, setStats] = useState({ stockTotal: 0, stockDisponible: 0, ventasMes: 0, pendientesCobro: 0, gananciaUSD: 0, gananciaARS: 0, stockValorUSD: 0, stockValorARS: 0, deudoresUrgentes: 0 });
  const [ventasRecientes, setVentasRecientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) return;
    const cargar = async () => {
      try {
        const base = ['negocios', negocioId];
        const [stockSnap, ventasSnap, cfgSnap] = await Promise.all([
          getDocs(collection(db, ...base, 'stock')),
          getDocs(query(collection(db, ...base, 'ventas'), orderBy('fecha', 'desc'), limit(100))),
          getDoc(doc(db, ...base, 'config', 'general')),
        ]);

        const stock = stockSnap.docs.map(d => d.data());
        const ventas = ventasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const tc = cfgSnap.data()?.tipoCambio || 1;

        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        const ventasMes = ventas.filter(v => {
          const fecha = v.fecha?.toDate?.() || new Date(v.fecha);
          return fecha >= primerDiaMes && v.estado === 'entregado';
        });

        const gananciaUSD = ventasMes.reduce((acc, v) => acc + (Number(v.pvUsd || 0) - Number(v.costoUsd || 0)), 0);
        const stockDisponible = stock.filter(s => s.estado === 'disponible');
        const stockValorUSD = stockDisponible.reduce((acc, s) => acc + Number(s.pvUsd || 0), 0);

        // Deudores urgentes: cuotas vencidas no pagadas
        const deudoresUrgentes = ventas.filter(v => {
          return (v.cobros || []).some(c => {
            if (c.tipo !== 'Cuotas personales' || !c.fechaInicio || !c.cuotas) return false;
            return Array.from({ length: Number(c.cuotas) }).some((_, qi) => {
              if ((c.cuotasPagadas || []).includes(qi)) return false;
              const fechaCuota = new Date(new Date(c.fechaInicio).setMonth(new Date(c.fechaInicio).getMonth() + qi));
              return fechaCuota < hoy;
            });
          });
        }).length;

        setStats({
          stockTotal: stock.length,
          stockDisponible: stockDisponible.length,
          ventasMes: ventasMes.length,
          pendientesCobro: ventas.filter(v => v.estado === 'pendiente').length,
          gananciaUSD: gananciaUSD.toFixed(2),
          gananciaARS: (gananciaUSD * tc).toLocaleString('es-AR'),
          stockValorUSD: stockValorUSD.toFixed(2),
          stockValorARS: (stockValorUSD * tc).toLocaleString('es-AR'),
          deudoresUrgentes,
        });
        setVentasRecientes(ventas.slice(0, 5));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    cargar();
  }, [negocioId]);

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.5px' }}>Dashboard</h1>
      <p style={{ color: '#86868b', fontSize: 14, marginBottom: 28 }}>Bienvenido, {perfil?.nombre || 'Admin'} 👋</p>

      {/* Ganancia del mes */}
      <div style={{ background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ color: '#86868b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>💰 Ganancia este mes</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#30d158', letterSpacing: '-1px' }}>USD {stats.gananciaUSD}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#30d158', opacity: 0.7, marginTop: 2 }}>ARS {stats.gananciaARS}</div>
        <div style={{ fontSize: 12, color: '#86868b', marginTop: 6 }}>en {stats.ventasMes} ventas entregadas</div>
      </div>

      {/* Valor del stock */}
      <div style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ color: '#86868b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>📦 Tu stock disponible vale</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#c9a96e', letterSpacing: '-1px' }}>USD {stats.stockValorUSD}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#c9a96e', opacity: 0.7, marginTop: 2 }}>ARS {stats.stockValorARS}</div>
        <div style={{ fontSize: 12, color: '#86868b', marginTop: 6 }}>{stats.stockDisponible} equipos disponibles de {stats.stockTotal} totales</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatCard icon="⏳" label="Ventas pendientes" value={stats.pendientesCobro} color="#ff9f0a" />
        <StatCard icon="🚨" label="Deudores urgentes" value={stats.deudoresUrgentes} color={stats.deudoresUrgentes > 0 ? '#ff3b30' : '#30d158'} />
      </div>

      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Últimas ventas</h2>
        {ventasRecientes.length === 0 ? (
          <p style={{ color: '#86868b', fontSize: 14 }}>No hay ventas registradas aún.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ventasRecientes.map(v => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#2c2c2e', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.modelo} {v.gb}GB {v.color}</div>
                  <div style={{ color: '#86868b', fontSize: 12 }}>{v.cliente || 'Sin cliente'} · {v.vendedor || '-'}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                  background: v.estado === 'entregado' ? '#d4edda22' : v.estado === 'cancelado' ? '#f8d7da22' : '#fff3cd22',
                  color: v.estado === 'entregado' ? '#30d158' : v.estado === 'cancelado' ? '#ff3b30' : '#ff9f0a'
                }}>{v.estado || 'pendiente'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
