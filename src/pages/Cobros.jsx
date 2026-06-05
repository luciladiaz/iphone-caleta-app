import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

// Calcula cuántos días de diferencia hay entre hoy y una fecha (negativo = pasado)
function diasDesde(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d - hoy) / (1000 * 60 * 60 * 24));
}

// Genera la fecha de cada cuota a partir de fechaInicio + N meses
function fechaCuota(fechaInicio, idx) {
  if (!fechaInicio) return null;
  const d = new Date(fechaInicio);
  d.setMonth(d.getMonth() + idx);
  return d;
}

// Devuelve semáforo: 'rojo' (>30 días vencida), 'naranja' (1-30 días), 'verde' (al día)
function semaforo(diasVencidos) {
  if (diasVencidos > 30) return 'rojo';
  if (diasVencidos >= 1) return 'naranja';
  return 'verde';
}

const colorSemaforo = { rojo: '#ff3b30', naranja: '#ff9f0a', verde: '#30d158' };
const bgSemaforo = { rojo: 'rgba(255,59,48,0.10)', naranja: 'rgba(255,159,10,0.10)', verde: 'rgba(48,209,88,0.10)' };
const etiquetaSemaforo = { rojo: 'URGENTE', naranja: 'ATENCIÓN', verde: 'AL DÍA' };

export default function Cobros() {
  const { negocioId } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (pagada) cuotasPagadas.splice(cuotasPagadas.indexOf(cuotaIdx), 1);
    else cuotasPagadas.push(cuotaIdx);
    cobros[cobroIdx] = { ...cobros[cobroIdx], cuotasPagadas };
    await updateDoc(doc(db, ...base, 'ventas', ventaId), { cobros });
    setVentas(vs => vs.map(v => v.id === ventaId ? { ...v, cobros } : v));
  };

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando...</div>;

  // --- Calcular deudores urgentes ---
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const deudores = [];
  for (const venta of ventas) {
    if (!venta.cobros) continue;
    for (let ci = 0; ci < venta.cobros.length; ci++) {
      const cobro = venta.cobros[ci];
      if (cobro.tipo !== 'Cuotas personales' || !cobro.cuotas || !cobro.fechaInicio) continue;
      const cuotasPagadas = cobro.cuotasPagadas || [];
      const totalCuotas = Number(cobro.cuotas);
      const montoCuota = Number(cobro.montoCuota) || 0;

      let cuotasVencidas = [];
      let maxDiasVencida = 0;

      for (let qi = 0; qi < totalCuotas; qi++) {
        if (cuotasPagadas.includes(qi)) continue;
        const fCuota = fechaCuota(cobro.fechaInicio, qi);
        if (!fCuota) continue;
        fCuota.setHours(0, 0, 0, 0);
        const diff = Math.floor((hoy - fCuota) / (1000 * 60 * 60 * 24)); // positivo = vencida
        if (diff >= 1) {
          cuotasVencidas.push({ idx: qi, diasVencida: diff });
          if (diff > maxDiasVencida) maxDiasVencida = diff;
        }
      }

      if (cuotasVencidas.length > 0) {
        deudores.push({
          ventaId: venta.id,
          cobroIdx: ci,
          cliente: venta.cliente || 'Sin nombre',
          telefono: venta.telefono || '',
          modelo: `${venta.modelo || ''} ${venta.gb || ''}GB`.trim(),
          cuotasVencidas: cuotasVencidas.length,
          montoVencido: cuotasVencidas.length * montoCuota,
          moneda: cobro.moneda || 'ARS',
          maxDiasVencida,
          semaforo: semaforo(maxDiasVencida),
        });
      }
    }
  }

  // Ordenar: rojo primero, luego naranja
  const ordenSemaforo = { rojo: 0, naranja: 1, verde: 2 };
  deudores.sort((a, b) => ordenSemaforo[a.semaforo] - ordenSemaforo[b.semaforo] || b.maxDiasVencida - a.maxDiasVencida);

  const ventasConCobros = ventas.filter(v => v.cobros && v.cobros.length > 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Cobros</h1>

      {/* Panel deudores urgentes */}
      {deudores.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff3b30' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ff3b30', textTransform: 'uppercase', letterSpacing: 1 }}>
              Deudores con cuotas vencidas
            </span>
            <span style={{ background: 'rgba(255,59,48,0.15)', color: '#ff3b30', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
              {deudores.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deudores.map((d, idx) => (
              <div key={idx} style={{
                background: bgSemaforo[d.semaforo],
                border: `1px solid ${colorSemaforo[d.semaforo]}44`,
                borderLeft: `4px solid ${colorSemaforo[d.semaforo]}`,
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: colorSemaforo[d.semaforo] + '22',
                      color: colorSemaforo[d.semaforo],
                      letterSpacing: 0.5,
                    }}>
                      {etiquetaSemaforo[d.semaforo]}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{d.cliente}</span>
                    <span style={{ color: '#86868b', fontSize: 12 }}>{d.modelo}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#86868b' }}>
                    <span style={{ color: colorSemaforo[d.semaforo], fontWeight: 600 }}>
                      {d.cuotasVencidas} cuota{d.cuotasVencidas > 1 ? 's' : ''} vencida{d.cuotasVencidas > 1 ? 's' : ''}
                    </span>
                    {' '}· Hace {d.maxDiasVencida} días la más antigua
                    {d.montoVencido > 0 && (
                      <span style={{ color: '#fff', fontWeight: 600, marginLeft: 8 }}>
                        · Debe {d.moneda} {d.montoVencido.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                </div>
                {d.telefono && (
                  <a
                    href={`tel:${d.telefono}`}
                    style={{
                      background: '#30d158',
                      color: '#000',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📞 Llamar
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel de cobros por venta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ventasConCobros.map(v => (
          <div key={v.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {v.modelo} {v.gb}GB · {v.cliente || 'Sin cliente'}
              </div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Vendedor: {v.vendedor || '-'}</span>
                {v.telefono && (
                  <a href={`tel:${v.telefono}`} style={{ color: '#c9a96e', textDecoration: 'none', fontSize: 12 }}>
                    📞 {v.telefono}
                  </a>
                )}
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
                    <div style={{ color: '#86868b', fontSize: 12, marginBottom: 8 }}>
                      {cobro.cuotas} cuotas de {cobro.moneda} {cobro.montoCuota}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: Number(cobro.cuotas) }).map((_, qi) => {
                        const pagada = (cobro.cuotasPagadas || []).includes(qi);
                        const fCuota = fechaCuota(cobro.fechaInicio, qi);
                        const label = fCuota
                          ? fCuota.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
                          : `Cuota ${qi + 1}`;
                        // Calcular si está vencida y no pagada
                        let vencida = false;
                        if (!pagada && fCuota) {
                          fCuota.setHours(0, 0, 0, 0);
                          const hoyLocal = new Date();
                          hoyLocal.setHours(0, 0, 0, 0);
                          vencida = fCuota < hoyLocal;
                        }
                        return (
                          <button
                            key={qi}
                            onClick={() => marcarCuota(v.id, ci, qi, pagada)}
                            title={fCuota ? fCuota.toLocaleDateString('es-AR') : ''}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: vencida && !pagada ? '1px solid rgba(255,59,48,0.5)' : 'none',
                              background: pagada
                                ? 'rgba(48,209,88,0.15)'
                                : vencida
                                  ? 'rgba(255,59,48,0.15)'
                                  : 'rgba(255,159,10,0.15)',
                              color: pagada
                                ? '#30d158'
                                : vencida
                                  ? '#ff3b30'
                                  : '#ff9f0a',
                            }}
                          >
                            {pagada ? '✓ ' : ''}{label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {cobro.tipo === 'iPhone como parte de pago' && (
                  <div style={{ color: '#c9a96e', fontSize: 13 }}>📱 iPhone recibido como parte de pago (ya agregado al stock)</div>
                )}
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
