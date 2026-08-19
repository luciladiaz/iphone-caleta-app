import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconWallet, IconBell, IconCheck, IconCheckCircle, IconWarning, IconPhone } from '../components/Icons';
import { registrarMovimientoCuota, eliminarMovimientoCuota } from '../lib/caja';
import { formatCapacidad } from '../lib/categoriasProducto';

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
const etiquetaSem = { rojo: 'URGENTE', amarillo: 'ATENCIÓN', verde: 'AL DÍA' };
const ORDEN_SEM = { rojo: 0, amarillo: 1, verde: 2 };

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
  { key: 'vencidas', label: 'Vencidas', dot: 'var(--rv-danger)' },
  { key: 'semana', label: 'Esta semana', dot: '#e6a700' },
  { key: 'mes', label: 'Este mes', dot: '#e07b1a' },
  { key: 'aldia', label: 'Al día', dot: '#2fa64d' },
  { key: 'todas', label: 'Todas', dot: null },
];

export default function Cobros() {
  const { negocioId } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [tipoCambio, setTipoCambio] = useState(null);
  const [modalWA, setModalWA] = useState(null); // grupo (cliente) seleccionado para enviar WA
  const [abierto, setAbierto] = useState(null); // clave del cliente con el detalle desplegado

  useEffect(() => {
    if (!negocioId) return;
    const base = ['negocios', negocioId];
    const cargar = async () => {
      const [ventasSnap, cliSnap, cfgSnap] = await Promise.all([
        getDocs(query(collection(db, ...base, 'ventas'), orderBy('fecha', 'desc'))),
        getDocs(collection(db, ...base, 'clientes')),
        getDoc(doc(db, ...base, 'config', 'general')),
      ]);
      setVentas(ventasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClientes(cliSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    if (pagada) {
      const i = cuotasPagadas.indexOf(cuotaIdx); if (i > -1) cuotasPagadas.splice(i, 1);
      await eliminarMovimientoCuota(negocioId, ventaId, cobroIdx, cuotaIdx);
    } else {
      cuotasPagadas.push(cuotaIdx);
      await registrarMovimientoCuota(negocioId, ventaId, venta, cobroIdx, cuotaIdx, cobros[cobroIdx]);
    }
    cobros[cobroIdx] = { ...cobros[cobroIdx], cuotasPagadas };
    await updateDoc(doc(db, ...base, 'ventas', ventaId), { cobros });
    setVentas(vs => vs.map(v => v.id === ventaId ? { ...v, cobros } : v));
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando...</div>;

  // Calcular deudas sueltas (por cuota vencida o por saldo pendiente de una venta)
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  const deudas = [];
  for (const venta of ventas) {
    if (!venta.cobros) continue;
    for (let ci = 0; ci < venta.cobros.length; ci++) {
      const cobro = venta.cobros[ci];
      if (cobro.tipo !== 'Cuotas personales' || !cobro.cuotas || !cobro.fechaInicio) continue;
      const pagadas = cobro.cuotasPagadas || [];
      const total = Number(cobro.cuotas);
      const monto = Number(cobro.montoCuota) || 0;
      let vencidas = [], montoTotal = 0, maxDias = 0;
      let pendientesFuturo = 0;

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
          pendientesFuturo++;
        }
      }

      const sem = vencidas.length > 0 ? calcSemaforo(maxDias) : 'verde';

      deudas.push({
        tipoDeuda: 'cuotas',
        ventaId: venta.id, cobroIdx: ci,
        clienteId: venta.clienteId || null,
        cliente: venta.cliente || 'Sin nombre',
        telefono: venta.telefono || '',
        modelo: `${venta.modelo || ''}${venta.gb ? ' ' + formatCapacidad(venta.gb) : ''}`.trim(),
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
      if (c.tipo === 'Equipo como parte de pago' || c.tipo === 'iPhone como parte de pago') return sum;
      const monto = Number(c.monto) || 0;
      return sum + (c.moneda === 'USD' ? monto : tc > 0 ? monto / tc : 0);
    }, 0);
    const partesUsd = (venta.partesDePago || []).reduce((s, p) => s + (Number(p.costoUsd) || 0), 0);
    const saldoUsd = (Number(venta.pvUsd) || 0) - (cobradoUsd + partesUsd);
    if (saldoUsd <= 0.01) continue;

    const fechaVenta = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
    const diasDesdeVenta = diasDesde(fechaVenta);
    const sem = calcSemaforo(diasDesdeVenta);

    deudas.push({
      tipoDeuda: 'saldo',
      ventaId: venta.id, cobroIdx: null,
      clienteId: venta.clienteId || null,
      cliente: venta.cliente || 'Sin nombre',
      telefono: venta.telefono || '',
      modelo: `${venta.modelo || ''}${venta.gb ? ' ' + formatCapacidad(venta.gb) : ''}`.trim(),
      cuotasVencidas: 1, montoVencido: saldoUsd,
      moneda: 'USD', maxDias: diasDesdeVenta, sem, pendientesFuturo: 0,
      totalCuotas: 1, cobro: null,
      venta,
    });
  }

  // Agrupar por cliente (por clienteId si la venta lo tiene, si no por nombre+teléfono)
  // — esto es lo que convierte la lista suelta en una cuenta corriente por cliente.
  const gruposMap = new Map();
  deudas.forEach(d => {
    const clave = d.clienteId || `${d.cliente}|${d.telefono}`;
    if (!gruposMap.has(clave)) {
      gruposMap.set(clave, { clave, clienteId: d.clienteId, nombre: d.cliente, telefono: d.telefono, deudas: [], totalesPorMoneda: {} });
    }
    const g = gruposMap.get(clave);
    g.deudas.push(d);
    g.totalesPorMoneda[d.moneda] = (g.totalesPorMoneda[d.moneda] || 0) + d.montoVencido;
    if (!g.telefono && d.telefono) g.telefono = d.telefono;
  });

  const grupos = Array.from(gruposMap.values()).map(g => {
    const vencidas = g.deudas.filter(d => d.cuotasVencidas > 0);
    const semPeor = vencidas.some(d => d.sem === 'rojo') ? 'rojo' : vencidas.some(d => d.sem === 'amarillo') ? 'amarillo' : 'verde';
    const maxDias = Math.max(0, ...g.deudas.map(d => d.maxDias));
    const clienteDoc = clientes.find(c => c.id === g.clienteId);
    return { ...g, semPeor, maxDias, numero: clienteDoc?.numero || null, tieneAtraso: vencidas.length > 0 };
  }).sort((a, b) => ORDEN_SEM[a.semPeor] - ORDEN_SEM[b.semPeor] || b.maxDias - a.maxDias);

  const gruposFiltrados = grupos.filter(g => {
    if (filtro === 'todas') return true;
    if (filtro === 'vencidas') return g.tieneAtraso;
    if (filtro === 'semana') return g.maxDias <= 7 && g.maxDias >= 1;
    if (filtro === 'mes') return g.maxDias <= 31 && g.maxDias >= 1;
    if (filtro === 'aldia') return !g.tieneAtraso;
    return true;
  });

  const construirMensaje = (g, convertirARS) => {
    const lineas = g.deudas.map(d => {
      let montoTxt;
      if (convertirARS && d.moneda === 'USD' && tipoCambio) {
        montoTxt = `$${Math.round(d.montoVencido * tipoCambio).toLocaleString('es-AR')} ARS`;
      } else {
        montoTxt = `${d.moneda} ${d.montoVencido.toLocaleString('es-AR')}`;
      }
      return `• ${d.modelo || 'Compra'} — ${textoDeuda(d)}: ${montoTxt}`;
    });
    return `Hola ${g.nombre}! Te recuerdo que tenés pendiente:\n${lineas.join('\n')}\nCualquier consulta avisame. Gracias!`;
  };

  // Modal: elegir cómo mandar el recordatorio por WhatsApp
  const ModalWhatsApp = () => {
    if (!modalWA) return null;
    const g = modalWA;
    const monedas = Object.keys(g.totalesPorMoneda);
    const tieneUSD = monedas.includes('USD');

    const enviar = (convertirARS) => { abrirWA(g.telefono, construirMensaje(g, convertirARS)); setModalWA(null); };

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
        <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 18, padding: 28, maxWidth: 420, width: '100%' }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}><IconBell size={16} />Enviar recordatorio por WhatsApp</div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 16 }}>{g.nombre}{g.numero ? ` · Cliente #${g.numero}` : ''}</div>

          <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 12, color: 'var(--rv-text-mid)', whiteSpace: 'pre-line' }}>
            {construirMensaje(g, false)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <button onClick={() => enviar(false)} style={{ background: 'var(--rv-accent-soft)', border: '1px solid rgba(47,111,237,0.4)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', color: 'var(--rv-accent)', fontWeight: 700, fontSize: 14 }}>
              Enviar como está
            </button>
            {tieneUSD && tipoCambio ? (
              <button onClick={() => enviar(true)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rv-text)' }}>Convertir USD a ARS</div>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 3 }}>Al TC del día · 1 USD = ${tipoCambio.toLocaleString('es-AR')}</div>
              </button>
            ) : tieneUSD && !tipoCambio ? (
              <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 12, padding: '12px 16px', color: 'var(--rv-text-dim)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                <IconWarning size={14} />No hay tipo de cambio cargado para convertir a ARS.
              </div>
            ) : null}
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
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}><IconWallet size={22} style={{ color: 'var(--rv-accent)' }} />Cobros</h1>
      <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 24 }}>
        Cuenta corriente de clientes: solo aparecen acá los que todavía te deben algo (cuotas o saldo). En cuanto un cliente termina de pagar, sale de esta lista solo — su historial completo lo seguís viendo en <strong>Clientes</strong>.
      </p>

      {grupos.length === 0 && (
        <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No hay clientes con deuda pendiente</div>
          <div style={{ color: 'var(--rv-text-dim)', fontSize: 13, maxWidth: 420, margin: '0 auto' }}>
            En cuanto registres una venta en <strong>Ventas</strong> que quede en cuotas o pagada solo en parte, vas a poder verla acá con semáforo de atraso y mandar recordatorios por WhatsApp.
          </div>
        </div>
      )}

      {grupos.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Deudores</span>
            <span style={{ background: 'var(--rv-danger-soft)', color: 'var(--rv-danger)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{grupos.filter(g => g.tieneAtraso).length} con atraso</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)} style={{ background: filtro === f.key ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtro === f.key ? '#fff' : 'var(--rv-text-mid)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {f.dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: f.dot, flexShrink: 0 }} />}
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {gruposFiltrados.map(g => (
              <div key={g.clave} style={{
                background: g.tieneAtraso && g.semPeor === 'rojo' ? 'var(--rv-danger-soft)' : 'var(--rv-surface)',
                border: g.tieneAtraso && g.semPeor === 'rojo' ? '1px solid rgba(212,61,61,0.3)' : '1px solid var(--rv-border)',
                borderLeft: g.tieneAtraso ? `4px solid ${colorSem[g.semPeor]}` : '4px solid var(--rv-border)',
                borderRadius: 14, padding: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      {g.tieneAtraso && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid var(--rv-border)', color: colorSem[g.semPeor] }}>{etiquetaSem[g.semPeor]}</span>}
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{g.nombre}</span>
                      {g.numero && <span style={{ color: 'var(--rv-text-dim)', fontSize: 12, fontWeight: 600 }}>Cliente #{g.numero}</span>}
                    </div>
                    <div style={{ color: 'var(--rv-text-dim)', fontSize: 12 }}>
                      {g.deudas.length} ítem{g.deudas.length === 1 ? '' : 's'} pendiente{g.deudas.length === 1 ? '' : 's'}
                      {g.tieneAtraso && <span style={{ color: colorSem[g.semPeor], fontWeight: 600 }}> · Hace {g.maxDias} días</span>}
                      {g.telefono && <a href={`tel:${g.telefono}`} style={{ color: 'var(--rv-accent)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPhone size={11} />{g.telefono}</a>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => g.telefono ? setModalWA(g) : null}
                      title={!g.telefono ? 'Agregá el teléfono del cliente en la venta' : ''}
                      style={{ background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: g.telefono ? 'pointer' : 'not-allowed', opacity: g.telefono ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconBell size={13} />WhatsApp
                    </button>
                    <button onClick={() => setAbierto(a => a === g.clave ? null : g.clave)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-text-mid)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {abierto === g.clave ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
                  {Object.entries(g.totalesPorMoneda).map(([moneda, monto]) => (
                    <div key={moneda} style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>DEBE {moneda}</div>
                      <div style={{ fontWeight: 800, color: 'var(--rv-danger)' }}>{moneda} {monto.toLocaleString('es-AR')}</div>
                    </div>
                  ))}
                </div>

                {abierto === g.clave && (
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--rv-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {g.deudas.map((d, di) => (
                      <div key={di} style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{d.modelo || 'Compra'}</span>
                          <span style={{ color: colorSem[d.sem], fontWeight: 700, fontSize: 13 }}>{d.moneda} {d.montoVencido.toLocaleString('es-AR')} · {textoDeuda(d)}</span>
                        </div>
                        {d.tipoDeuda === 'cuotas' && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {Array.from({ length: Number(d.totalCuotas) }).map((_, qi) => {
                              const pagada = (d.cobro.cuotasPagadas || []).includes(qi);
                              const fc = d.cobro.fechaInicio ? fechaCuota(d.cobro.fechaInicio, qi) : null;
                              const vencida = fc && fc < hoy && !pagada;
                              const fecha = fc ? fc.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }) : `Cuota ${qi + 1}`;
                              return (
                                <button key={qi} onClick={() => marcarCuota(d.ventaId, d.cobroIdx, qi, pagada)} style={{
                                  padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--rv-border)',
                                  background: vencida ? 'var(--rv-danger-soft)' : 'var(--rv-surface)',
                                  color: pagada ? 'var(--rv-text-mid)' : vencida ? 'var(--rv-danger)' : 'var(--rv-text-dim)',
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                }}>
                                  {pagada ? <IconCheck size={11} /> : vencida ? <IconWarning size={11} /> : null} {fecha}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {gruposFiltrados.length === 0 && <div style={{ textAlign: 'center', color: 'var(--rv-text-dim)', padding: 20, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IconCheckCircle size={15} style={{ color: 'var(--rv-accent)' }} />No hay clientes en esta categoría</div>}
          </div>
        </>
      )}
    </div>
  );
}
