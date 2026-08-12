import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => new Intl.NumberFormat('es-AR').format(Math.round(n));

export default function ReporteVendedores() {
  const { negocioId } = useAuth();
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesLabel, setMesLabel] = useState('');

  useEffect(() => {
    if (!negocioId) { setLoading(false); return; }
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

  const medallas = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>🏅 Rendimiento por Vendedor</h1>
      <p style={{ color: 'var(--rv-text-dim)', fontSize: 14, marginBottom: 28 }}>Ranking del mes · {mesLabel}</p>

      {loading ? (
        <div style={{ color: 'var(--rv-text-dim)', textAlign: 'center', padding: 60 }}>Cargando datos...</div>
      ) : ranking.length === 0 ? (
        <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 48, textAlign: 'center', color: 'var(--rv-text-dim)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--rv-text)', marginBottom: 8 }}>No hay ventas registradas este mes</p>
          <p style={{ fontSize: 13 }}>Cuando registres ventas con un vendedor asignado, aparecerán acá.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ranking.map((v, i) => (
            <div key={v.nombre} style={{
              background: 'var(--rv-surface)',
              border: `1px solid var(--rv-border)`,
              borderLeft: i === 0 ? '3px solid var(--rv-accent)' : '1px solid var(--rv-border)',
              borderRadius: 14, padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 28, width: 40, textAlign: 'center' }}>{medallas[i] || `${i + 1}°`}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--rv-text)' }}>{v.nombre}</div>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3 }}>
                  {v.ventas} venta{v.ventas !== 1 ? 's' : ''} · {v.entregadas} entregada{v.entregadas !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {v.totalARS > 0 && (
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rv-text)' }}>${fmt(v.totalARS)} ARS</div>
                )}
                {v.totalUSD > 0 && (
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rv-text-mid)' }}>u$s{fmt(v.totalUSD)} USD</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

