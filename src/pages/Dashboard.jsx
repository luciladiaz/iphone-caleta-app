import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconCoin, IconBox, IconClock, IconWarning, IconBell, IconCheckCircle, IconCheck } from '../components/Icons';
import { formatCapacidad } from '../lib/categoriasProducto';

function StatCard({ Icon, label, value, sub, urgente }) {
  return (
    <div style={{
      background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14,
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden',
      borderLeft: urgente ? '3px solid var(--rv-danger)' : '1px solid var(--rv-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={17} style={{ color: urgente ? 'var(--rv-danger)' : 'var(--rv-text-dim)' }} />
        <span style={{ color: 'var(--rv-text-dim)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: urgente ? 'var(--rv-danger)' : 'var(--rv-text)', letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--rv-text-dim)' }}>{sub}</div>}
    </div>
  );
}

function fechaCuotaCalc(fechaInicio, idx) {
  const d = new Date(fechaInicio);
  d.setMonth(d.getMonth() + idx);
  return d;
}

const generarMensajeWA = (cliente, telefono, modelo, gb, numeroCuota, totalCuotas, monto) => {
  const mensaje = `Hola ${cliente}! Te recuerdo que vence la cuota ${numeroCuota} de ${totalCuotas} de tu ${modelo}${gb ? ' ' + formatCapacidad(gb) : ''}. El monto es $${Number(monto).toLocaleString('es-AR')} ARS. Cualquier consulta avisame. Gracias!`;
  const tel = telefono?.replace(/\D/g, '');
  const telAR = tel?.startsWith('54') ? tel : `54${tel}`;
  window.open(`https://wa.me/${telAR}?text=${encodeURIComponent(mensaje)}`, '_blank');
};

export default function Dashboard() {
  const { perfil, negocioId } = useAuth();
  const [stats, setStats] = useState({ stockTotal: 0, stockDisponible: 0, ventasMes: 0, pendientesCobro: 0, gananciaUSD: 0, gananciaARS: 0, stockValorUSD: 0, stockValorARS: 0, deudoresUrgentes: 0 });
  const [ventasRecientes, setVentasRecientes] = useState([]);
  const [todasVentas, setTodasVentas] = useState([]);
  const [tabCobros, setTabCobros] = useState('vencidas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) return;
    const cargar = async () => {
      try {
        const base = ['negocios', negocioId];
        const [stockSnap, ventasSnap, cfgSnap] = await Promise.all([
          getDocs(collection(db, ...base, 'stock')),
          getDocs(query(collection(db, ...base, 'ventas'), orderBy('fecha', 'desc'), limit(200))),
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

        const deudoresUrgentes = ventas.filter(v => {
          return (v.cobros || []).some(c => {
            if (c.tipo !== 'Cuotas personales' || !c.fechaInicio || !c.cuotas) return false;
            return Array.from({ length: Number(c.cuotas) }).some((_, qi) => {
              if ((c.cuotasPagadas || []).includes(qi)) return false;
              const fechaCuota = fechaCuotaCalc(c.fechaInicio, qi);
              return fechaCuota < hoy;
            });
          });
        }).length;

        setStats({
          stockTotal: stock.length, stockDisponible: stockDisponible.length,
          ventasMes: ventasMes.length,
          pendientesCobro: ventas.filter(v => v.estado === 'pendiente').length,
          gananciaUSD: gananciaUSD.toFixed(2),
          gananciaARS: (gananciaUSD * tc).toLocaleString('es-AR'),
          stockValorUSD: stockValorUSD.toFixed(2),
          stockValorARS: (stockValorUSD * tc).toLocaleString('es-AR'),
          deudoresUrgentes,
        });
        setVentasRecientes(ventas.slice(0, 5));
        setTodasVentas(ventas);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    cargar();
  }, [negocioId]);

  // Calcular cobros del día
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en3dias = new Date(hoy); en3dias.setDate(en3dias.getDate() + 3);

  const cobrosCalculados = [];
  todasVentas.forEach(v => {
    (v.cobros || []).forEach((c, ci) => {
      if (c.tipo !== 'Cuotas personales' || !c.cuotas || !c.fechaInicio) return;
      const total = Number(c.cuotas);
      Array.from({ length: total }).forEach((_, qi) => {
        if ((c.cuotasPagadas || []).includes(qi)) return;
        const fechaCuota = fechaCuotaCalc(c.fechaInicio, qi);
        fechaCuota.setHours(0, 0, 0, 0);
        const diff = Math.floor((hoy - fechaCuota) / 86400000);
        let tipo = null;
        if (diff > 0) tipo = 'vencidas';
        else if (diff === 0) tipo = 'hoy';
        else if (fechaCuota <= en3dias) tipo = 'proximos';
        if (!tipo) return;
        cobrosCalculados.push({
          tipo, ventaId: v.id, cobroIdx: ci, cuotaIdx: qi,
          cliente: v.cliente || 'Sin nombre', telefono: v.telefono || '',
          modelo: v.modelo || '', gb: v.gb || '',
          cuotaNum: qi + 1, totalCuotas: total,
          monto: c.montoCuota || 0, moneda: c.moneda || 'ARS',
          diasAtraso: diff > 0 ? diff : 0,
        });
      });
    });
  });

  const cobrosFiltrados = cobrosCalculados.filter(c => c.tipo === tabCobros);
  const tabs = [
    { key: 'vencidas', label: 'Vencidas', dot: 'var(--rv-danger)', count: cobrosCalculados.filter(c => c.tipo === 'vencidas').length },
    { key: 'hoy', label: 'Vencen hoy', dot: '#e6a700', count: cobrosCalculados.filter(c => c.tipo === 'hoy').length },
    { key: 'proximos', label: 'Próximos 3 días', dot: '#e07b1a', count: cobrosCalculados.filter(c => c.tipo === 'proximos').length },
  ];

  const marcarCuotaPagada = async (cobro) => {
    const base = ['negocios', negocioId];
    const venta = todasVentas.find(v => v.id === cobro.ventaId);
    if (!venta) return;
    const cobros = [...(venta.cobros || [])];
    const cuotasPagadas = [...(cobros[cobro.cobroIdx].cuotasPagadas || [])];
    cuotasPagadas.push(cobro.cuotaIdx);
    cobros[cobro.cobroIdx] = { ...cobros[cobro.cobroIdx], cuotasPagadas };
    await updateDoc(doc(db, ...base, 'ventas', cobro.ventaId), { cobros });
    setTodasVentas(vs => vs.map(v => v.id === cobro.ventaId ? { ...v, cobros } : v));
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.5px' }}>Dashboard</h1>
      <p style={{ color: 'var(--rv-text-dim)', fontSize: 14, marginBottom: 28 }}>Bienvenido, {perfil?.nombre || 'Admin'} 👋</p>

      {/* Ganancia del mes */}
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><IconCoin size={14} />Ganancia este mes</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--rv-text)', letterSpacing: '-1px' }}>USD {stats.gananciaUSD}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--rv-text-dim)', marginTop: 2 }}>ARS {stats.gananciaARS}</div>
        <div style={{ fontSize: 12, color: 'var(--rv-text-dim)', marginTop: 6 }}>en {stats.ventasMes} ventas entregadas</div>
      </div>

      {/* Valor del stock */}
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><IconBox size={14} />Tu stock disponible vale</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--rv-text)', letterSpacing: '-1px' }}>USD {stats.stockValorUSD}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--rv-text-dim)', marginTop: 2 }}>ARS {stats.stockValorARS}</div>
        <div style={{ fontSize: 12, color: 'var(--rv-text-dim)', marginTop: 6 }}>{stats.stockDisponible} equipos disponibles de {stats.stockTotal} totales</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatCard Icon={IconClock} label="Ventas pendientes" value={stats.pendientesCobro} />
        <StatCard Icon={IconWarning} label="Deudores urgentes" value={stats.deudoresUrgentes} urgente={stats.deudoresUrgentes > 0} />
      </div>

      {/* Cobros del día */}
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><IconBell size={16} />Cobros del día</h2>

        <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTabCobros(t.key)} style={{
                  background: tabCobros === t.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)',
                  color: tabCobros === t.key ? '#fff' : 'var(--rv-text-mid)',
                  border: 'none', borderRadius: 8, padding: '7px 14px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.dot, flexShrink: 0 }} />
                  {t.label}
                  {t.count > 0 && <span style={{ background: tabCobros === t.key ? 'rgba(255,255,255,0.25)' : 'var(--rv-danger-soft)', color: tabCobros === t.key ? '#fff' : 'var(--rv-danger)', fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 99 }}>{t.count}</span>}
                </button>
              ))}
            </div>

            {cobrosFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--rv-text-dim)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <IconCheckCircle size={16} style={{ color: 'var(--rv-accent)' }} />Todo al día — No tenés cobros pendientes por hoy
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cobrosFiltrados.map((c, i) => (
                  <div key={i} style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rv-text)' }}>{c.cliente}</div>
                      <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 2 }}>
                        {c.modelo}{c.gb ? ` ${formatCapacidad(c.gb)}` : ''} · Cuota {c.cuotaNum} de {c.totalCuotas}
                        {c.diasAtraso > 0 && <span style={{ color: 'var(--rv-danger)', marginLeft: 8, fontWeight: 600 }}>· {c.diasAtraso} días de atraso</span>}
                      </div>
                      <div style={{ color: 'var(--rv-text)', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                        {c.moneda} {Number(c.monto).toLocaleString('es-AR')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => c.telefono ? generarMensajeWA(c.cliente, c.telefono, c.modelo, c.gb, c.cuotaNum, c.totalCuotas, c.monto) : null}
                        title={!c.telefono ? 'Agregá el teléfono del cliente en la venta para usar esta función' : ''}
                        style={{
                          background: '#25D366', color: '#fff', border: 'none', borderRadius: 8,
                          padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: c.telefono ? 'pointer' : 'not-allowed',
                          opacity: c.telefono ? 1 : 0.4,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                        <IconBell size={13} />Recordatorio
                      </button>
                      <button onClick={() => marcarCuotaPagada(c)} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', color: 'var(--rv-text-mid)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconCheck size={13} />Pagada
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </>
      </div>

      {/* Últimas ventas */}
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Últimas ventas</h2>
        {ventasRecientes.length === 0 ? (
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 14 }}>No hay ventas registradas aún.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ventasRecientes.map(v => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--rv-surface-alt)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--rv-text)' }}>{v.modelo}{v.gb ? ` ${formatCapacidad(v.gb)}` : ''} {v.color}</div>
                  <div style={{ color: 'var(--rv-text-dim)', fontSize: 12 }}>{v.cliente || 'Sin cliente'} · {v.vendedor || '-'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--rv-border)', color: 'var(--rv-text-mid)' }}>
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

