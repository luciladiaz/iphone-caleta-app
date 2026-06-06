import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import FeatureBloqueada from '../components/FeatureBloqueada';

const fmt = (n) => new Intl.NumberFormat('es-AR').format(Math.round(n));

export default function ReporteVendedores() {
  const { tieneFeature, negocioId } = useAuth();
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesLabel, setMesLabel] = useState('');

  useEffect(() => {
    if (!negocioId || !tieneFeature('reportesPorVendedor')) { setLoading(false); return; }
    cargar();
  }, [negocioId]);

  const cargar = async () => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    setMesLabel(inicioMes.toLocaleString('es-AR', { month: 'long', year: 'numeric' }));

    const snap = await getDocs(query(collection(db, 'negocios', negocioId, 'ventas'), orderBy('fecha', 'desc')));
    const ventasMes = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => {
        const f = v.fecha?.toDate?.() || new Date(v.fecha);
        return f >= inicioMes && v.estado !== 'cancelado';
      });

    // Agrupar por vendedor
    const mapa = {};
    ventasMes.forEach(v => {
      const nombre = v.vendedor || 'Sin asignar';
      if (!mapa[nombre]) mapa[nombre] = { nombre, ventas: 0, totalARS: 0, totalUSD: 0, entregadas: 0 };
      mapa[nombre].ventas++;
      if (v.estado === 'entregado') mapa[nombre].entregadas++;
      (v.cobros || []).forEach(c => {
        const m = parseFloat(c.monto) || 0;
        if (c.moneda === 'USD') mapa[nombre].totalUSD += m;
        else mapa[nombre].totalARS += m;
      });
    });

    const lista = Object.values(mapa).sort((a, b) => b.ventas - a.ventas);
    setRanking(lista);
    setLoading(false);
  };

  if (!tieneFeature('reportesPorVendedor')) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>🏅 Rendimiento por Vendedor</h1>
        <FeatureBloqueada
          feature="Reportes por Vendedor"
          planRequerido="promax"
          descripcion="Conocé el rendimiento de cada vendedor. Quién vendió más, quién tiene más cobros pendientes, y el ranking del mes."
        />
      </div>
    );
  }

  const medallas = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>🏅 Rendimiento por Vendedor</h1>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28 }}>Ranking del mes · {mesLabel}</p>

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 60 }}>Cargando datos...</div>
      ) : ranking.length === 0 ? (
        <div style={{ background: '#1e293b', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 14, padding: 48, textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 8 }}>No hay ventas registradas este mes</p>
          <p style={{ fontSize: 13 }}>Cuando registres ventas con un vendedor asignado, aparecerán acá.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ranking.map((v, i) => (
            <div key={v.nombre} style={{
              background: i === 0 ? 'rgba(37,99,235,0.1)' : '#1e293b',
              border: `1px solid ${i === 0 ? 'rgba(37,99,235,0.4)' : 'rgba(37,99,235,0.15)'}`,
              borderRadius: 14, padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 28, width: 40, textAlign: 'center' }}>{medallas[i] || `${i + 1}°`}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: i === 0 ? '#7DD3FC' : '#fff' }}>{v.nombre}</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>
                  {v.ventas} venta{v.ventas !== 1 ? 's' : ''} · {v.entregadas} entregada{v.entregadas !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {v.totalARS > 0 && (
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#10b981' }}>${fmt(v.totalARS)} ARS</div>
                )}
                {v.totalUSD > 0 && (
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>u$s{fmt(v.totalUSD)} USD</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
