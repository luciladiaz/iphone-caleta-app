import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

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

const colorSem = { rojo: 'var(--rv-danger)', amarillo: 'var(--rv-text-mid)', verde: 'var(--rv-text-dim)' };
const bgSem = { rojo: 'var(--rv-danger-soft)', amarillo: 'var(--rv-surface-alt)', verde: 'var(--rv-surface-alt)' };
const etiquetaSem = { rojo: 'URGENTE', amarillo: 'ATENCIÓN', verde: 'AL DÍA' };

function textoDeuda(d) {
  if (d.tipoDeuda === 'saldo') return 'saldo pendiente';
  return `${d.cuotasVencidas} cuota${d.cuotasVencidas > 1 ? 's' : ''} vencida${d.cuotasVencidas > 1 ? 's' : ''}`;
}

const abrirWA = (telefono, mensaje) => {
  const tel = telefono?.replace(/\D/g, '');
  const telAR = tel?.startsWith('54') ? tel : `54${tel}`;
  window.open(`https://wa.me/${telAR}?text=${encodeURIComponent(mensaje)}`, '_blank');
};

const FILTROS = [
  { key: 'vencidas', label: '🔴 Vencidas' },
  { key: 'semana', label: '🟡 Esta semana' },
  { key: 'mes', label: '🟠 Este mes' },
  { key: 'aldia', label: '✅ Al día' },
  { key: 'todas', label: 'Todas' },
];

export default function Cobros() {
  const { negocioId } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [tipoCambio, setTipoCambio] = useState(null);
  const [modalWA, setModalWA] = useState(null); // deudor seleccionado para enviar WA

  useEffect(() => {
    if (!negocioId) return;
    const base = ['negocios', negocioId];
    const cargar = async () => {
      const [ventasSnap, cfgSnap] = await Promise.all([
        getDocs(query(collection(db, ...base, 'ventas'), orderBy('fecha', 'desc'))),
        getDoc(doc(db, ...base, 'config', 'general')),
      ]);
      setVentas(ventasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const tc = cfgSnap.data()?.tipoCambio;
      if (tc) setTipoCambio(Number(tc));
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

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando...</div>;

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
        tipoDeuda: 'cuotas',
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

  // Saldo pendiente: ventas pagadas parcialmente con cualquier forma de pago
  // (no solo "Cuotas personales") — ej. pagó una seña y falta el resto.
  // Si la venta ya tiene cuotas personales, ese saldo se sigue por cuota más arriba.
  for (const venta of ventas) {
    const tieneCuotasPersonales = (venta.cobros || []).some(c => c.tipo === 'Cuotas personales');
    if (tieneCuotasPersonales || !venta.fecha) continue;

    const tc = tipoCambio || 0;
    const cobradoUsd = (venta.cobros || []).reduce((sum, c) => {
      if (c.tipo === 'iPhone como parte de pago') return sum;
      const monto = Number(c.monto) || 0;
      return sum + (c.moneda === 'USD' ? monto : tc > 0 ? monto / tc : 0);
    }, 0);
    const partesUsd = (venta.partesDePago || []).reduce((s, p) => s + (Number(p.costoUsd) || 0), 0);
    const saldoUsd = (Number(venta.pvUsd) || 0) - (cobradoUsd + partesUsd);
    if (saldoUsd <= 0.01) continue;

    const fechaVenta = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
    const diasDesdeVenta = diasDesde(fechaVenta);
    const sem = calcSemaforo(diasDesdeVenta);

    deudores.push({
      tipoDeuda: 'saldo',
      ventaId: venta.id, cobroIdx: null,
      cliente: venta.cliente || 'Sin nombre',
      telefono: venta.telefono || '',
      modelo: `${venta.modelo || ''} ${venta.gb || ''}GB`.trim(),
      cuotasVencidas: 1, montoVencido: saldoUsd,
      moneda: 'USD', maxDias: diasDesdeVenta, sem, pendientesFuturo: 0,
      totalCuotas: 1, cobro: null,
      venta,
    });
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

  // Modal: elegir moneda del mensaje de WhatsApp
  const ModalWhatsApp = () => {
    if (!modalWA) return null;
    const d = modalWA;
    const esUSD = d.moneda === 'USD';
    const montoUSD = d.montoVencido;
    const montoARS = tipoCambio ? montoUSD * tipoCambio : null;

    const enviar = (enARS) => {
      let montoTexto;
      if (esUSD && !enARS) {
        montoTexto = `USD ${montoUSD.toLocaleString('es-AR')}`;
      } else if (esUSD && enARS && montoARS) {
        montoTexto = `$${Math.round(montoARS).toLocaleString('es-AR')} ARS`;
      } else {
        montoTexto = `$${montoUSD.toLocaleString('es-AR')} ARS`;
      }
      const msg = `Hola ${d.cliente}! Te recuerdo que tenés ${textoDeuda(d)} de tu ${d.modelo}. El monto pendiente es ${montoTexto}. Cualquier consulta avisame. Gracias!`;
      abrirWA(d.telefono, msg);
      setModalWA(null);
    };

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
        <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 18, padding: 28, maxWidth: 380, width: '100%' }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>📲 Enviar recordatorio por WhatsApp</div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 20 }}>
            {d.cliente} · {textoDeuda(d)}
          </div>

          <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            ¿Cómo querés mostrar la deuda?
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {esUSD && (
              <button onClick={() => enviar(false)} style={{ background: 'var(--rv-accent-soft)', border: '1px solid rgba(47,111,237,0.4)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rv-accent)' }}>USD {montoUSD.toLocaleString('es-AR')}</div>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3 }}>Enviar en dólares (monto acordado)</div>
              </button>
            )}
            {esUSD && montoARS ? (
              <button onClick={() => enviar(true)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rv-text)' }}>${Math.round(montoARS).toLocaleString('es-AR')} ARS</div>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3 }}>Equivalente al TC del día · 1 USD = ${tipoCambio?.toLocaleString('es-AR')}</div>
              </button>
            ) : esUSD && !montoARS ? (
              <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 13 }}>⚠️ No hay tipo de cambio cargado. Actualizalo en Configuración.</div>
              </div>
            ) : (
              <button onClick={() => enviar(false)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rv-text)' }}>${montoUSD.toLocaleString('es-AR')} ARS</div>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3 }}>Monto en pesos argentinos</div>
              </button>
            )}
          </div>

          <button onClick={() => setModalWA(null)} style={{ width: '100%', background: 'var(--rv-surface-alt)', border: 'none', borderRadius: 10, padding: '11px', color: 'var(--rv-text-dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <ModalWhatsApp />
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>💳 Cobros</h1>

      {/* Panel deudores */}
      {deudores.length === 0 && (
        <div style={{ marginBottom: 32, background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Deudores con cuotas pendientes</div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 13, maxWidth: 420, margin: '0 auto' }}>
            Por ahora no tenés ventas con saldo pendiente. En cuanto registres una venta en <strong>Ventas</strong> que quede en cuotas o pagada solo en parte (cualquier forma de pago), vas a poder verla acá con semáforo de atraso y mandar recordatorios por WhatsApp.
          </div>
        </div>
      )}
      {deudores.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Deudores con cuotas pendientes</span>
            <span style={{ background: 'var(--rv-danger-soft)', color: 'var(--rv-danger)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{deudores.filter(d => d.cuotasVencidas > 0).length} con atraso</span>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)} style={{ background: filtro === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtro === f.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deudoresFiltrados.map((d, idx) => (
              <div key={idx} style={{
                background: d.cuotasVencidas > 0 && d.sem === 'rojo' ? 'var(--rv-danger-soft)' : 'var(--rv-surface)',
                border: d.cuotasVencidas > 0 && d.sem === 'rojo' ? '1px solid rgba(212,61,61,0.3)' : '1px solid var(--rv-border)',
                borderLeft: d.cuotasVencidas > 0 ? `4px solid ${colorSem[d.sem]}` : '4px solid var(--rv-border)',
                borderRadius: 12, padding: '14px 18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      {d.cuotasVencidas > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid var(--rv-border)', color: colorSem[d.sem] }}>{etiquetaSem[d.sem]}</span>}
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{d.cliente}</span>
                      <span style={{ color: 'var(--rv-text-dim)', fontSize: 12 }}>{d.modelo}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--rv-text-dim)' }}>
                      {d.cuotasVencidas > 0 && (
                        <span style={{ color: colorSem[d.sem], fontWeight: 600 }}>
                          {textoDeuda(d)} · Hace {d.maxDias} días
                        </span>
                      )}
                      {d.cuotasVencidas > 0 && d.montoVencido > 0 && <span style={{ color: 'var(--rv-text)', fontWeight: 600, marginLeft: 8 }}>· Debe {d.moneda} {d.montoVencido.toLocaleString('es-AR')}</span>}
                      {d.cuotasVencidas === 0 && <span style={{ color: 'var(--rv-text-dim)' }}>Al día ✓</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => d.telefono ? setModalWA(d) : null}
                      title={!d.telefono ? 'Agregá el teléfono del cliente en la venta' : ''}
                      style={{ background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: d.telefono ? 'pointer' : 'not-allowed', opacity: d.telefono ? 1 : 0.4 }}>
                      📲 WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {deudoresFiltrados.length === 0 && <div style={{ textAlign: 'center', color: 'var(--rv-text-dim)', padding: 20, fontSize: 14 }}>✅ No hay deudores en esta categoría</div>}
          </div>
        </div>
      )}

      {/* Lista de cobros con cuotas */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Detalle de cuotas</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ventasConCobros.map(v => (
          <div key={v.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{v.modelo} {v.gb}GB · {v.cliente || 'Sin cliente'}</div>
              <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 2 }}>
                Vendedor: {v.vendedor || '-'}
                {v.telefono && <a href={`tel:${v.telefono}`} style={{ color: 'var(--rv-accent)', marginLeft: 8 }}>📞 {v.telefono}</a>}
              </div>
            </div>
            {v.cobros.map((cobro, ci) => (
              <div key={ci} style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cobro.tipo}</span>
                  {cobro.monto && <span style={{ color: 'var(--rv-accent)', fontWeight: 700 }}>{cobro.moneda} {cobro.monto}</span>}
                </div>
                {cobro.tipo === 'Cuotas personales' && cobro.cuotas && (
                  <div>
                    <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 8 }}>{cobro.cuotas} cuotas de {cobro.moneda} {cobro.montoCuota}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: Number(cobro.cuotas) }).map((_, qi) => {
                        const pagada = (cobro.cuotasPagadas || []).includes(qi);
                        const fc = cobro.fechaInicio ? fechaCuota(cobro.fechaInicio, qi) : null;
                        const vencida = fc && fc < hoy && !pagada;
                        const fecha = fc ? fc.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }) : `Cuota ${qi + 1}`;
                        return (
                          <button key={qi} onClick={() => marcarCuota(v.id, ci, qi, pagada)} style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--rv-border)',
                            background: vencida ? 'var(--rv-danger-soft)' : 'var(--rv-surface-alt)',
                            color: pagada ? 'var(--rv-text-mid)' : vencida ? 'var(--rv-danger)' : 'var(--rv-text-dim)',
                          }}>
                            {pagada ? '✓' : vencida ? '⚠' : ''} {fecha}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {cobro.tipo === 'iPhone como parte de pago' && <div style={{ color: 'var(--rv-accent)', fontSize: 13 }}>📱 iPhone recibido como parte de pago</div>}
              </div>
            ))}
          </div>
        ))}
        {ventasConCobros.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
            <p>No hay cobros registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}

