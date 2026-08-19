import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconChart } from '../components/Icons';

const fmt = (n) => new Intl.NumberFormat('es-AR').format(Math.round(n));

export default function DashboardGerencial() {
  const { negocioId } = useAuth();
  const [datos, setDatos] = useState(null);
  const [tipoCambio, setTipoCambio] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) { setLoading(false); return; }
    cargar();
  }, [negocioId]);

  const cargar = async () => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [ventasSnap, stockSnap, cfgSnap] = await Promise.all([
      getDocs(query(collection(db, 'negocios', negocioId, 'ventas'), orderBy('fecha', 'desc'))),
      getDocs(collection(db, 'negocios', negocioId, 'stock')),
      getDoc(doc(db, 'negocios', negocioId, 'config', 'general')),
    ]);
    setTipoCambio(Number(cfgSnap.data()?.tipoCambio) || 0);

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

  const KPI = ({ label, valor, sub, color }) => (
    <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '20px 24px', flex: '1 1 160px' }}>
      <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: color || 'var(--rv-text)', letterSpacing: '-1px' }}>{valor}</div>
      {sub && <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const estadoLabel = { pendiente: 'Pendiente', entregado: 'Entregado', cancelado: 'Cancelado' };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}><IconChart size={22} style={{ color: 'var(--rv-accent)' }} />Dashboard Gerencial</h1>
      <p style={{ color: 'var(--rv-text-dim)', fontSize: 14, marginBottom: 28 }}>
        Resumen del mes · {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
      </p>

      {loading ? (
        <div style={{ color: 'var(--rv-text-dim)', textAlign: 'center', padding: 60 }}>Cargando datos...</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
            <KPI label="Ventas del mes" valor={datos.totalVentasMes} sub={`${datos.entregadas} entregadas · ${datos.pendienteEntrega} pendientes`} />
            <KPI label="Stock disponible" valor={datos.disponibles} sub="equipos listos para vender" />
            <KPI label="Facturado ARS" valor={`$${fmt(datos.totalARS)}`} sub="cobros en pesos este mes" />
            {datos.totalUSD > 0 && (
              <KPI label="Facturado USD" valor={`u$s${fmt(datos.totalUSD)}`} sub="cobros en dólares este mes" />
            )}
          </div>

          {/* Ventas recientes */}
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--rv-border-soft)', fontWeight: 700, fontSize: 15 }}>
              Ventas recientes
            </div>
            {datos.recientes.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--rv-text-dim)' }}>
                No hay ventas registradas todavía.
              </div>
            ) : (
              datos.recientes.map(v => {
                const fecha = v.fecha?.toDate?.() || new Date(v.fecha);
                const totalVenta = (v.cobros || []).reduce((acc, c) => {
                  const m = parseFloat(c.monto) || 0;
                  return acc + (c.moneda === 'ARS' ? m : m * (Number(v.tipoCambio) || tipoCambio || 0));
                }, 0);
                return (
                  <div key={v.id} style={{ padding: '14px 24px', borderBottom: '1px solid var(--rv-border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--rv-text)' }}>{v.cliente || '—'}</div>
                      <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 2 }}>
                        {v.vendedor && <span>{v.vendedor} · </span>}
                        {fecha.toLocaleDateString('es-AR')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {totalVenta > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rv-text)' }}>${fmt(totalVenta)}</span>
                      )}
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--rv-text-mid)',
                        background: 'var(--rv-surface-alt)',
                        border: '1px solid var(--rv-border)',
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

