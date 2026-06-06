import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import FeatureBloqueada from '../components/FeatureBloqueada';

const fmt = (n) => new Intl.NumberFormat('es-AR').format(Math.round(n));

export default function DashboardGerencial() {
  const { tieneFeature, negocioId } = useAuth();
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !tieneFeature('dashboardGerencial')) { setLoading(false); return; }
    cargar();
  }, [negocioId]);

  const cargar = async () => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [ventasSnap, stockSnap] = await Promise.all([
      getDocs(query(collection(db, 'negocios', negocioId, 'ventas'), orderBy('fecha', 'desc'))),
      getDocs(collection(db, 'negocios', negocioId, 'stock')),
    ]);

    const todas = ventasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const ventasMes = todas.filter(v => {
      const f = v.fecha?.toDate?.() || new Date(v.fecha);
      return f >= inicioMes && v.estado !== 'cancelado';
    });

    let totalARS = 0;
    let totalUSD = 0;
    ventasMes.forEach(v => {
      (v.cobros || []).forEach(c => {
        const m = parseFloat(c.monto) || 0;
        if (c.moneda === 'USD') totalUSD += m;
        else totalARS += m;
      });
    });

    const stockItems = stockSnap.docs.map(d => d.data());
    const disponibles = stockItems.filter(s => s.estado === 'disponible').length;
    const pendienteEntrega = ventasMes.filter(v => v.estado === 'pendiente').length;
    const entregadas = ventasMes.filter(v => v.estado === 'entregado').length;

    setDatos({
      totalVentasMes: ventasMes.length,
      entregadas,
      pendienteEntrega,
      totalARS,
      totalUSD,
      disponibles,
      recientes: todas.slice(0, 6),
    });
    setLoading(false);
  };

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

  const KPI = ({ label, valor, sub, color }) => (
    <div style={{ background: '#1e293b', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 14, padding: '20px 24px', flex: '1 1 160px' }}>
      <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: color || '#fff', letterSpacing: '-1px' }}>{valor}</div>
      {sub && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const estadoColor = { pendiente: '#f59e0b', entregado: '#10b981', cancelado: '#ef4444' };
  const estadoLabel = { pendiente: 'Pendiente', entregado: 'Entregado', cancelado: 'Cancelado' };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>📈 Dashboard Gerencial</h1>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28 }}>
        Resumen del mes · {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
      </p>

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 60 }}>Cargando datos...</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
            <KPI label="Ventas del mes" valor={datos.totalVentasMes} sub={`${datos.entregadas} entregadas · ${datos.pendienteEntrega} pendientes`} color="#7DD3FC" />
            <KPI label="Stock disponible" valor={datos.disponibles} sub="equipos listos para vender" />
            <KPI label="Facturado ARS" valor={`$${fmt(datos.totalARS)}`} sub="cobros en pesos este mes" color="#10b981" />
            {datos.totalUSD > 0 && (
              <KPI label="Facturado USD" valor={`u$s${fmt(datos.totalUSD)}`} sub="cobros en dólares este mes" color="#f59e0b" />
            )}
          </div>

          {/* Ventas recientes */}
          <div style={{ background: '#1e293b', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(37,99,235,0.15)', fontWeight: 700, fontSize: 15 }}>
              Ventas recientes
            </div>
            {datos.recientes.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                No hay ventas registradas todavía.
              </div>
            ) : (
              datos.recientes.map(v => {
                const fecha = v.fecha?.toDate?.() || new Date(v.fecha);
                const totalVenta = (v.cobros || []).reduce((acc, c) => {
                  const m = parseFloat(c.monto) || 0;
                  return acc + (c.moneda === 'ARS' ? m : m * (v.tipoCambio || 1200));
                }, 0);
                return (
                  <div key={v.id} style={{ padding: '14px 24px', borderBottom: '1px solid rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{v.cliente || '—'}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                        {v.vendedor && <span>{v.vendedor} · </span>}
                        {fecha.toLocaleDateString('es-AR')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {totalVenta > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#7DD3FC' }}>${fmt(totalVenta)}</span>
                      )}
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: estadoColor[v.estado] || '#94a3b8',
                        background: `${estadoColor[v.estado] || '#94a3b8'}20`,
                        padding: '3px 10px', borderRadius: 99,
                      }}>
                        {estadoLabel[v.estado] || v.estado}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

