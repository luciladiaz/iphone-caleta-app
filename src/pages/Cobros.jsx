import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import FeatureBloqueada from '../components/FeatureBloqueada';

function diasDesde(fecha) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const d = new Date(fecha); d.setHours(0,0,0,0);
  return Math.floor((hoy - d) / 86400000);
}

function fechaCuota(fechaInicio, idx) {
  if (!fechaInicio) return null;
  const d = new Date(fechaInicio);
  d.setMonth(d.getMonth() + idx);
  return d;
}

function calcSemaforo(diasVencidos) {
  if (diasVencidos > 7) return 'rojo';
  if (diasVencidos >= 1) return 'amarillo';
  return 'verde';
}

const colorSem = { rojo: '#ff3b30', amarillo: '#ff9f0a', verde: '#30d158' };
const bgSem = { rojo: 'rgba(255,59,48,0.10)', amarillo: 'rgba(255,159,10,0.10)', verde: 'rgba(48,209,88,0.10)' };
const etiquetaSem = { rojo: 'URGENTE', amarillo: 'ATENCIÓN', verde: 'AL DÍA' };

const generarMensajeWA = (cliente, telefono, modelo, gb, numeroCuota, totalCuotas, monto) => {
  const msg = `Hola ${cliente}! Te recuerdo que vence la cuota ${numeroCuota} de ${totalCuotas} de tu ${modelo} ${gb}GB. El monto es $${Number(monto).toLocaleString('es-AR')} ARS. Cualquier consulta avisame. Gracias!`;
  const tel = telefono?.replace(/\D/g, '');
  const telAR = tel?.startsWith('54') ? tel : `54${tel}`;
  window.open(`https://wa.me/${telAR}?text=${encodeURIComponent(msg)}`, '_blank');
};

const FILTROS = [
  { key: 'vencidas', label: '🔴 Vencidas' },
  { key: 'semana', label: '🟡 Esta semana' },
  { key: 'mes', label: '🟠 Este mes' },
  { key: 'aldia', label: '✅ Al día' },
  { key: 'todas', label: 'Todas' },
];

export default function Cobros() {
  const { negocioId, tieneFeature } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => {
    if (!negocioId) return;
    const base = ['negocios', negocioId];
    const cargar = async () => {
      const snap = await getDocs(query(collection(db, ...base, 'ventas'), orderBy('fecha', 'desc')));
      setVentas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    cargar();
  }, [negocioId]);

  const marcarCuota = async (ventaId, cobroIdx, cuotaIdx, pagada) => {
    const base = ['negocios', negocioId];
    const venta = ventas.find(v => v.id === ventaId);
    const cobros = [...(venta.cobros || [])];
    const cuotasPagadas = [...(cobros[cobroIdx].cuotasPagadas || [])];
    if (pagada) { const i = cuotasPagadas.indexOf(cuotaIdx); if (i > -1) cuotasPagadas.splice(i, 1); }
    else cuotasPagadas.push(cuotaIdx);
    cobros[cobroIdx] = { ...cobros[cobroIdx], cuotasPagadas };
    await updateDoc(doc(db, ...base, 'ventas', ventaId), { cobros });
    setVentas(vs => vs.map(v => v.id === ventaId ? { ...v, cobros } : v));
  };

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando...</div>;

  // Calcular deudores
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const finSemana = new Date(hoy); finSemana.setDate(finSemana.getDate() + 7);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  const deudores = [];
  for (const venta of ventas) {
    if (!venta.cobros) continue;
    for (let ci = 0; ci < venta.cobros.length; ci++) {
      const cobro = venta.cobros[ci];
      if (cobro.tipo !== 'Cuotas personales' || !cobro.cuotas || !cobro.fechaInicio) continue;
      const pagadas = cobro.cuotasPagadas || [];
      const total = Number(cobro.cuotas);
      const monto = Number(cobro.montoCuota) || 0;
      let vencidas = [], montoTotal = 0, maxDias = 0;
      let proximasNoVencidas = [];

      for (let qi = 0; qi < total; qi++) {
        if (pagadas.includes(qi)) continue;
        const fc = fechaCuota(cobro.fechaInicio, qi);
        if (!fc) continue;
        fc.setHours(0,0,0,0);
        const diff = Math.floor((hoy - fc) / 86400000);
        if (diff >= 1) {
          vencidas.push(qi);
          montoTotal += monto;
          if (diff > maxDias) maxDias = diff;
        } else {
          proximasNoVencidas.push({ idx: qi, fecha: fc });
        }
      }

      const sem = vencidas.length > 0 ? calcSemaforo(maxDias) : 'verde';
      const pendientesFuturo = proximasNoVencidas.length;

      deudores.push({
        ventaId: venta.id, cobroIdx: ci,
        cliente: venta.cliente || 'Sin nombre',
        telefono: venta.telefono || '',
        modelo: `${venta.modelo || ''} ${venta.gb || ''}GB`.trim(),
        cuotasVencidas: vencidas.length, montoVencido: montoTotal,
        moneda: cobro.moneda || 'ARS', maxDias, sem, pendientesFuturo,
        totalCuotas: total, cobro,
        venta,
      });
    }
  }

  deudores.sort((a, b) => ({ rojo: 0, amarillo: 1, verde: 2 }[a.sem] - { rojo: 0, amarillo: 1, verde: 2 }[b.sem] || b.maxDias - a.maxDias));

  const deudoresFiltrados = deudores.filter(d => {
    if (filtro === 'todas') return true;
    if (filtro === 'vencidas') return d.cuotasVencidas > 0;
    if (filtro === 'semana') return d.maxDias <= 7 && d.maxDias >= 1;
    if (filtro === 'mes') return d.maxDias <= 31 && d.maxDias >= 1;
    if (filtro === 'aldia') return d.cuotasVencidas === 0;
    return true;
  });

  const ventasConCobros = ventas.filter(v => v.cobros && v.cobros.length > 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>💳 Cobros</h1>

      {/* Panel deudores */}
      {!tieneFeature('panelDeudores') && (
        <div style={{ marginBottom: 32 }}>
          <FeatureBloqueada
            feature="Panel de deudores con semáforo"
            planRequerido="pro"
            descripcion="Mirá quién te debe, cuánto y hace cuántos días. Semáforo de urgencia para no perderte ningún cobro."
          />
        </div>
      )}
      {tieneFeature('panelDeudores') && deudores.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Deudores con cuotas pendientes</span>
            <span style={{ background: 'rgba(255,59,48,0.15)', color: '#ff3b30', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{deudores.filter(d => d.cuotasVencidas > 0).length} con atraso</span>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)} style={{ background: filtro === f.key ? '#c9a96e' : '#2c2c2e', color: filtro === f.key ? '#000' : '#ebebf5cc', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deudoresFiltrados.map((d, idx) => (
              <div key={idx} style={{ background: d.cuotasVencidas > 0 ? bgSem[d.sem] : '#1c1c1e', border: `1px solid ${d.cuotasVencidas > 0 ? colorSem[d.sem] + '44' : '#2c2c2e'}`, borderLeft: d.cuotasVencidas > 0 ? `4px solid ${colorSem[d.sem]}` : '4px solid #2c2c2e', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      {d.cuotasVencidas > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: colorSem[d.sem] + '22', color: colorSem[d.sem] }}>{etiquetaSem[d.sem]}</span>}
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{d.cliente}</span>
                      <span style={{ color: '#86868b', fontSize: 12 }}>{d.modelo}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#86868b' }}>
                      {d.cuotasVencidas > 0 && (
                        <span style={{ color: colorSem[d.sem], fontWeight: 600 }}>
                          {d.cuotasVencidas} cuota{d.cuotasVencidas > 1 ? 's' : ''} vencida{d.cuotasVencidas > 1 ? 's' : ''} · Hace {d.maxDias} días
                        </span>
                      )}
                      {d.cuotasVencidas > 0 && d.montoVencido > 0 && <span style={{ color: '#fff', fontWeight: 600, marginLeft: 8 }}>· Debe {d.moneda} {d.montoVencido.toLocaleString('es-AR')}</span>}
                      {d.cuotasVencidas === 0 && <span style={{ color: '#30d158' }}>Al día ✓</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {tieneFeature('botonWhatsappDeudores') ? (
                      <button
                        onClick={() => d.telefono ? generarMensajeWA(d.cliente, d.telefono, d.modelo, '', d.cuotasVencidas, d.totalCuotas, d.montoVencido) : null}
                        title={!d.telefono ? 'Agregá el teléfono del cliente en la venta' : ''}
                        style={{ background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: d.telefono ? 'pointer' : 'not-allowed', opacity: d.telefono ? 1 : 0.4 }}>
                        📲 WhatsApp
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: '#86868b', alignSelf: 'center' }}>📲 WhatsApp · Plan Pro Max</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {deudoresFiltrados.length === 0 && <div style={{ textAlign: 'center', color: '#30d158', padding: 20, fontSize: 14 }}>✅ No hay deudores en esta categoría</div>}
          </div>
        </div>
      )}

      {/* Lista de cobros con cuotas */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Detalle de cuotas</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ventasConCobros.map(v => (
          <div key={v.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{v.modelo} {v.gb}GB · {v.cliente || 'Sin cliente'}</div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 2 }}>
                Vendedor: {v.vendedor || '-'}
                {v.telefono && <a href={`tel:${v.telefono}`} style={{ color: '#c9a96e', marginLeft: 8 }}>📞 {v.telefono}</a>}
              </div>
            </div>
            {v.cobros.map((cobro, ci) => (
              <div key={ci} style={{ background: '#2c2c2e', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cobro.tipo}</span>
                  {cobro.monto && <span style={{ color: '#c9a96e', fontWeight: 700 }}>{cobro.moneda} {cobro.monto}</span>}
                </div>
                {cobro.tipo === 'Cuotas personales' && cobro.cuotas && (
                  <div>
                    <div style={{ color: '#86868b', fontSize: 12, marginBottom: 8 }}>{cobro.cuotas} cuotas de {cobro.moneda} {cobro.montoCuota}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: Number(cobro.cuotas) }).map((_, qi) => {
                        const pagada = (cobro.cuotasPagadas || []).includes(qi);
                        const fc = cobro.fechaInicio ? fechaCuota(cobro.fechaInicio, qi) : null;
                        const vencida = fc && fc < hoy && !pagada;
                        const fecha = fc ? fc.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }) : `Cuota ${qi + 1}`;
                        return (
                          <button key={qi} onClick={() => marcarCuota(v.id, ci, qi, pagada)} style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                            background: pagada ? 'rgba(48,209,88,0.15)' : vencida ? 'rgba(255,59,48,0.15)' : 'rgba(255,159,10,0.15)',
                            color: pagada ? '#30d158' : vencida ? '#ff3b30' : '#ff9f0a',
                          }}>
                            {pagada ? '✓' : vencida ? '⚠' : ''} {fecha}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {cobro.tipo === 'iPhone como parte de pago' && <div style={{ color: '#c9a96e', fontSize: 13 }}>📱 iPhone recibido como parte de pago</div>}
              </div>
            ))}
          </div>
        ))}
        {ventasConCobros.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#86868b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
            <p>No hay cobros registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}
