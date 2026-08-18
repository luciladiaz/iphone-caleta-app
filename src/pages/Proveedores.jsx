import { useEffect, useState } from 'react';
import { collection, getDocs, getDoc, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconTruck, IconGear, IconCheckCircle, IconWarning, IconBox, IconPlus, IconTrash, IconX, IconCalendar, IconCard } from '../components/Icons';
import { registrarPagoProveedorCC, eliminarMovimientoPagoProveedorCC } from '../lib/caja';

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cheque', 'Otro'];
const formatCapacidad = (gb) => gb && /^\d+$/.test(String(gb).trim()) ? `${gb}GB` : gb;

// Un equipo de stock se considera pagado si el propio equipo tiene `pagadoProveedor`
// seteado explícitamente, o (mecanismo viejo, previo a la cuenta corriente) si la
// venta ligada ya lo tenía marcado. Esa plata ya pagada suma al total pagado del
// proveedor como saldo inicial, junto con los pagos de la cuenta corriente de acá.
function estaPagadoLegacy(item, venta) {
  if (typeof item.pagadoProveedor === 'boolean') return item.pagadoProveedor;
  return venta?.pagadoProveedor === true;
}

const FORM_PAGO_VACIO = { moneda: 'USD', monto: '', tipoCambio: '', formaPago: 'Efectivo', fecha: new Date().toISOString().split('T')[0], nota: '' };

export default function Proveedores() {
  const { negocioId, perfil } = useAuth();
  const base = ['negocios', negocioId];
  const [proveedores, setProveedores] = useState([]);
  const [stock, setStock] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [tipoCambioGlobal, setTipoCambioGlobal] = useState('');
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(null);
  const [modalPago, setModalPago] = useState(null);
  const [formPago, setFormPago] = useState(FORM_PAGO_VACIO);
  const [guardandoPago, setGuardandoPago] = useState(false);

  const cargar = async () => {
    if (!negocioId) return;
    const [pSnap, stockSnap, ventasSnap, pagosSnap, cfgSnap] = await Promise.all([
      getDocs(collection(db, ...base, 'proveedores')),
      getDocs(collection(db, ...base, 'stock')),
      getDocs(collection(db, ...base, 'ventas')),
      getDocs(query(collection(db, ...base, 'pagosProveedores'), orderBy('fecha', 'desc'))),
      getDoc(doc(db, ...base, 'config', 'general')),
    ]);
    setProveedores(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setStock(stockSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setVentas(ventasSnap.docs.map(d => d.data()));
    setPagos(pagosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const cfg = cfgSnap.data() || {};
    if (cfg.tipoCambio) setTipoCambioGlobal(String(cfg.tipoCambio));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const abrirModalPago = (p) => {
    setModalPago(p);
    setFormPago({ ...FORM_PAGO_VACIO, tipoCambio: tipoCambioGlobal });
  };

  const guardarPago = async (e) => {
    e.preventDefault();
    const montoNum = Number(formPago.monto) || 0;
    if (montoNum <= 0 || !modalPago) return;
    setGuardandoPago(true);
    try {
      const tc = formPago.moneda === 'ARS' ? Number(formPago.tipoCambio) || 0 : 0;
      const montoUsd = formPago.moneda === 'ARS' ? (tc > 0 ? montoNum / tc : 0) : montoNum;
      const pagoData = {
        proveedor: modalPago.nombre,
        fecha: new Date(formPago.fecha),
        moneda: formPago.moneda,
        monto: montoNum,
        tipoCambio: formPago.moneda === 'ARS' ? tc : null,
        montoUsd,
        formaPago: formPago.formaPago,
        nota: formPago.nota,
        registradoPor: perfil?.nombre || '',
      };
      const ref = await addDoc(collection(db, ...base, 'pagosProveedores'), pagoData);
      await registrarPagoProveedorCC(negocioId, ref.id, pagoData);
      setModalPago(null);
      cargar();
    } catch (err) { console.error(err); }
    finally { setGuardandoPago(false); }
  };

  const eliminarPago = async (pago) => {
    if (!window.confirm(`¿Eliminás este pago de ${pago.moneda === 'USD' ? 'USD' : '$'} ${pago.monto}? Esto también lo saca de Caja.`)) return;
    await deleteDoc(doc(db, ...base, 'pagosProveedores', pago.id));
    await eliminarMovimientoPagoProveedorCC(negocioId, pago.id);
    cargar();
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando...</div>;

  const detalle = proveedores.map(p => {
    const items = stock
      .filter(s => s.proveedor === p.nombre && Number(s.costoUsd) > 0)
      .map(item => ({ ...item, pagado: estaPagadoLegacy(item, ventas.find(v => v.equipoId === item.id)) }));
    const totalDebido = items.reduce((s, i) => s + (Number(i.costoUsd) || 0), 0);
    const pagadoLegacy = items.reduce((s, i) => s + (i.pagado ? Number(i.costoUsd) || 0 : 0), 0);
    const pagosDelProveedor = pagos.filter(pg => pg.proveedor === p.nombre);
    const pagadoCC = pagosDelProveedor.reduce((s, pg) => s + (Number(pg.montoUsd) || 0), 0);
    const totalPagado = pagadoLegacy + pagadoCC;
    return {
      ...p,
      items,
      pagosDelProveedor,
      totalDebido,
      totalPagado,
      pendiente: totalDebido - totalPagado,
      disponibles: items.filter(i => i.estado === 'disponible').length,
      vendidos: items.filter(i => i.estado === 'vendido').length,
      consignacion: items.filter(i => i.tipo === 'consignacion').length,
    };
  }).sort((a, b) => b.pendiente - a.pendiente);

  const totalPendienteGeneral = detalle.reduce((s, p) => s + Math.max(0, p.pendiente), 0);

  const montoUsdPreview = (() => {
    if (formPago.moneda !== 'ARS') return null;
    const tc = Number(formPago.tipoCambio) || 0;
    const monto = Number(formPago.monto) || 0;
    return tc > 0 && monto > 0 ? monto / tc : null;
  })();

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}><IconTruck size={22} style={{ color: 'var(--rv-accent)' }} />Proveedores</h1>
      <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        Cargá los proveedores desde <IconGear size={12} />Configuración. El costo que cargás al agregar un equipo al Stock se atribuye acá solo, como cuenta corriente.
      </p>
      {totalPendienteGeneral > 0 && (
        <div style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <IconWarning size={14} style={{ color: 'var(--rv-danger)' }} />
          Debés en total <strong>USD {totalPendienteGeneral.toFixed(0)}</strong> entre todos los proveedores
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {detalle.map(p => (
          <div key={p.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}><IconTruck size={16} style={{ color: 'var(--rv-accent)' }} />{p.nombre}</div>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 4 }}>
                  {p.items.length} equipo{p.items.length === 1 ? '' : 's'} · {p.disponibles} disponible{p.disponibles === 1 ? '' : 's'} · {p.vendidos} vendido{p.vendidos === 1 ? '' : 's'}
                  {p.consignacion > 0 && ` · ${p.consignacion} en consignación`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => abrirModalPago(p)} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconPlus size={12} />Registrar pago
                </button>
                {(p.items.length > 0 || p.pagosDelProveedor.length > 0) && (
                  <button onClick={() => setAbierto(a => a === p.id ? null : p.id)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-text-mid)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {abierto === p.id ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
              <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>TOTAL DEBIDO</div>
                <div style={{ fontWeight: 700 }}>USD {p.totalDebido.toFixed(0)}</div>
              </div>
              <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>PAGADO</div>
                <div style={{ fontWeight: 700, color: 'var(--rv-text-mid)' }}>USD {p.totalPagado.toFixed(0)}</div>
              </div>
              <div style={{ background: p.pendiente > 0 ? 'var(--rv-danger-soft)' : 'var(--rv-accent-soft)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>{p.pendiente > 0 ? 'PENDIENTE' : p.pendiente < 0 ? 'A FAVOR' : 'PENDIENTE'}</div>
                <div style={{ fontWeight: 800, color: p.pendiente > 0 ? 'var(--rv-danger)' : 'var(--rv-accent)' }}>
                  {p.pendiente > 0 ? `USD ${p.pendiente.toFixed(0)}` : p.pendiente < 0 ? `USD ${(-p.pendiente).toFixed(0)}` : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCheckCircle size={13} />Al día</span>}
                </div>
              </div>
            </div>

            {abierto === p.id && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--rv-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {p.items.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>Equipos</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {p.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '9px 14px', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ fontSize: 13 }}>
                            <span style={{ fontWeight: 600 }}>{item.modelo}{item.gb ? ` ${formatCapacidad(item.gb)}` : ''} {item.color}</span>
                            <span style={{ color: 'var(--rv-text-dim)', marginLeft: 8 }}>{item.estado === 'vendido' ? 'Vendido' : item.estado === 'asignado' ? 'Asignado' : 'Disponible'}{item.tipo === 'consignacion' ? ' · Consignación' : ''}</span>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>USD {item.costoUsd}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rv-text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>Historial de pagos</div>
                  {p.pagosDelProveedor.length === 0 ? (
                    <p style={{ color: 'var(--rv-text-dim)', fontSize: 13 }}>Todavía no le registraste ningún pago a este proveedor.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {p.pagosDelProveedor.map(pg => {
                        const fecha = pg.fecha?.toDate ? pg.fecha.toDate() : new Date(pg.fecha);
                        return (
                          <div key={pg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '9px 14px', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontSize: 13 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--rv-text-dim)', fontSize: 11, marginRight: 8 }}><IconCalendar size={10} />{fecha.toLocaleDateString('es-AR')}</span>
                              <span style={{ fontWeight: 600 }}>{pg.formaPago}</span>
                              {pg.nota && <span style={{ color: 'var(--rv-text-dim)' }}> · {pg.nota}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--rv-accent)' }}>
                                {pg.moneda === 'USD' ? 'USD' : '$'} {Number(pg.monto).toLocaleString('es-AR')}
                                {pg.moneda === 'ARS' && <span style={{ color: 'var(--rv-text-dim)', fontWeight: 400 }}> · ≈USD {Number(pg.montoUsd || 0).toFixed(0)}</span>}
                              </span>
                              <button onClick={() => eliminarPago(pg)} style={{ background: 'none', border: 'none', color: 'var(--rv-danger)', cursor: 'pointer', display: 'flex' }}><IconTrash size={13} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {proveedores.length === 0 && <div style={{ color: 'var(--rv-text-dim)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>No hay proveedores. Agregá desde <IconGear size={12} />Configuración.</div>}
        {proveedores.length > 0 && detalle.every(p => p.items.length === 0) && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
            <IconBox size={36} style={{ marginBottom: 12 }} />
            <p>Todavía no cargaste equipos de stock con costo y proveedor asignado.</p>
          </div>
        )}
      </div>

      {modalPago && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><IconCard size={16} />Registrar pago</h2>
              <button onClick={() => setModalPago(null)} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--rv-accent)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <IconTruck size={13} />{modalPago.nombre}
            </div>
            <form onSubmit={guardarPago} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Moneda</label>
                  <select value={formPago.moneda} onChange={e => setFormPago({ ...formPago, moneda: e.target.value })} style={inputStyle}>
                    <option value="USD">Dólares (USD)</option>
                    <option value="ARS">Pesos (ARS)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Forma de pago</label>
                  <select value={formPago.formaPago} onChange={e => setFormPago({ ...formPago, formaPago: e.target.value })} style={inputStyle}>
                    {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Monto</label>
                <input type="number" value={formPago.monto} onChange={e => setFormPago({ ...formPago, monto: e.target.value })} placeholder="0" required style={inputStyle} />
              </div>
              {formPago.moneda === 'ARS' && (
                <div>
                  <label style={labelStyle}>Tipo de cambio usado</label>
                  <input type="number" value={formPago.tipoCambio} onChange={e => setFormPago({ ...formPago, tipoCambio: e.target.value })} placeholder={tipoCambioGlobal || '1430'} style={inputStyle} />
                  {montoUsdPreview != null && <div style={{ fontSize: 11, color: 'var(--rv-accent)', marginTop: 4 }}>≈ USD {montoUsdPreview.toFixed(2)}</div>}
                </div>
              )}
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type="date" value={formPago.fecha} onChange={e => setFormPago({ ...formPago, fecha: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nota (opcional)</label>
                <input value={formPago.nota} onChange={e => setFormPago({ ...formPago, nota: e.target.value })} placeholder="Ej: seña, factura #123..." style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setModalPago(null)} style={{ padding: '10px 18px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardandoPago} style={{ padding: '10px 22px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{guardandoPago ? 'Guardando...' : 'Registrar pago'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
