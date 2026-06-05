import { useEffect, useState } from 'react';
import { collection, getDocs, getDoc, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import ModalLimiteAlcanzado from '../components/ModalLimiteAlcanzado';

const inputStyle = { width: '100%', padding: '10px 12px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: '#86868b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };
const estadoColor = { pendiente: '#ff9f0a', entregado: '#30d158', cancelado: '#ff3b30' };

const ORIGENES = ['Instagram iPhone Caleta', 'WhatsApp', 'Local físico', 'Referido', 'Facebook', 'TikTok', 'Otro'];
const FORMAS_PAGO = ['Efectivo ARS', 'Efectivo USD', 'Transferencia ARS', 'Transferencia USD', 'Cuotas personales', 'iPhone como parte de pago'];

export default function Ventas() {
  const { perfil, negocioId, plan, limitesPlan } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const [ventas, setVentas] = useState([]);
  const [stock, setStock] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [origenes, setOrigenes] = useState(ORIGENES);
  const [tipoCambioGlobal, setTipoCambioGlobal] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [modalLimite, setModalLimite] = useState(false);
  const [form, setForm] = useState({
    equipoId: '', cliente: '', telefono: '', vendedor: '', origen: '',
    estado: 'pendiente', notas: '', tipoCambio: '',
    cobros: [{ tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }],
    partesDePago: []
  });
  const [nuevaParte, setNuevaParte] = useState({ modelo: '', gb: '', color: '', bateria: '', imei: '', costoUsd: '', pvUsd: '' });

  const cargar = async () => {
    if (!negocioId) return;
    const base = ['negocios', negocioId];
    const [vSnap, sSnap, vendSnap, cfgSnap] = await Promise.all([
      getDocs(query(collection(db, ...base, 'ventas'), orderBy('fecha', 'desc'))),
      getDocs(collection(db, ...base, 'stock')),
      getDocs(collection(db, ...base, 'vendedores')),
      getDoc(doc(db, ...base, 'config', 'general')),
    ]);
    setVentas(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setStock(sSnap.docs.filter(d => d.data().estado === 'disponible').map(d => ({ id: d.id, ...d.data() })));
    setVendedores(vendSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const cfg = cfgSnap.data() || {};
    if (cfg.origenes) setOrigenes(cfg.origenes);
    if (cfg.tipoCambio) setTipoCambioGlobal(String(cfg.tipoCambio));
    setLoading(false);
  };

  useEffect(() => {
    if (!negocioId) return;
    cargar();
  }, [negocioId]);

  const equipoSeleccionado = stock.find(s => s.id === form.equipoId);

  const agregarCobro = () => setForm(f => ({ ...f, cobros: [...f.cobros, { tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }] }));
  const quitarCobro = (i) => setForm(f => ({ ...f, cobros: f.cobros.filter((_, idx) => idx !== i) }));
  const updateCobro = (i, campo, val) => setForm(f => ({ ...f, cobros: f.cobros.map((c, idx) => idx === i ? { ...c, [campo]: val } : c) }));

  const agregarParte = () => {
    if (!nuevaParte.modelo) return;
    setForm(f => ({ ...f, partesDePago: [...f.partesDePago, { ...nuevaParte }] }));
    setNuevaParte({ modelo: '', gb: '', color: '', bateria: '', imei: '', costoUsd: '', pvUsd: '' });
  };

  const eliminarVenta = async (v) => {
    if (!window.confirm(`¿Eliminás la venta de ${v.modelo} ${v.gb}GB? Esta acción no se puede deshacer.`)) return;
    const base = ['negocios', negocioId];
    await deleteDoc(doc(db, ...base, 'ventas', v.id));
    if (v.equipoId) {
      try { await updateDoc(doc(db, ...base, 'stock', v.equipoId), { estado: 'disponible' }); } catch {}
    }
    cargar();
  };

  const abrirEditar = (v) => {
    setEditando(v.id);
    setForm({
      equipoId: v.equipoId || '',
      cliente: v.cliente || '',
      telefono: v.telefono || '',
      vendedor: v.vendedor || '',
      origen: v.origen || '',
      estado: v.estado || 'pendiente',
      notas: v.notas || '',
      tipoCambio: v.tipoCambio || '',
      cobros: v.cobros || [{ tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }],
      partesDePago: v.partesDePago || [],
    });
    setModal(true);
  };

  const cerrarModal = () => {
    setModal(false);
    setEditando(null);
    setForm({
      equipoId: '', cliente: '', telefono: '', vendedor: '', origen: '',
      estado: 'pendiente', notas: '', tipoCambio: '',
      cobros: [{ tipo: 'Efectivo ARS', monto: '', moneda: 'ARS', cuotas: '', montoCuota: '', fechaInicio: '' }],
      partesDePago: []
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    const base = ['negocios', negocioId];
    try {
      if (editando) {
        await updateDoc(doc(db, ...base, 'ventas', editando), {
          cliente: form.cliente,
          telefono: form.telefono,
          vendedor: form.vendedor,
          origen: form.origen,
          estado: form.estado,
          notas: form.notas,
          cobros: form.cobros,
        });
      } else {
        const equipo = stock.find(s => s.id === form.equipoId);
        const ventaData = {
          ...form,
          fecha: serverTimestamp(),
          modelo: equipo?.modelo || '',
          gb: equipo?.gb || '',
          color: equipo?.color || '',
          proveedor: equipo?.proveedor || '',
          costoUsd: equipo?.costoUsd || '',
          pvUsd: equipo?.pvUsd || '',
          equipoId: form.equipoId,
          telefono: form.telefono,
        };
        await addDoc(collection(db, ...base, 'ventas'), ventaData);
        if (form.equipoId) await updateDoc(doc(db, ...base, 'stock', form.equipoId), { estado: 'vendido' });
        for (const parte of form.partesDePago) {
          await addDoc(collection(db, ...base, 'stock'), {
            ...parte,
            tipo: 'parte_de_pago',
            estado: 'disponible',
            fechaIngreso: serverTimestamp(),
            costoUsd: parte.costoUsd || '',
            pvUsd: parte.pvUsd || '',
          });
        }
      }
      cerrarModal();
      cargar();
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
  };

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando ventas...</div>;

  const hoyV = new Date();
  const primerDiaMesV = new Date(hoyV.getFullYear(), hoyV.getMonth(), 1);
  const ventasMesCount = ventas.filter(v => {
    const fecha = v.fecha?.toDate?.() || new Date(v.fecha);
    return fecha >= primerDiaMesV;
  }).length;
  const maxVentasMes = limitesPlan?.maxVentasMes ?? Infinity;
  const limiteVentasAlcanzado = maxVentasMes !== Infinity && ventasMesCount >= maxVentasMes;

  const handleNuevaVenta = () => {
    if (limiteVentasAlcanzado) { setModalLimite(true); return; }
    setEditando(null);
    setModal(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Ventas</h1>
          <p style={{ color: '#86868b', fontSize: 13, margin: '4px 0 0' }}>{ventas.length} ventas registradas</p>
        </div>
        <button onClick={handleNuevaVenta} style={{ background: '#c9a96e', color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + Nueva venta
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ventas.map(v => (
          <div key={v.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{v.modelo} {v.gb}GB {v.color}</div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 3 }}>
                👤 {v.cliente || 'Sin cliente'}
                {v.telefono ? (
                  <a href={`tel:${v.telefono}`} style={{ color: '#c9a96e', marginLeft: 4, textDecoration: 'none' }}>
                    📞 {v.telefono}
                  </a>
                ) : (
                  <span title="Sin teléfono — editá la venta para agregarlo" style={{ marginLeft: 4, opacity: 0.5, cursor: 'help', textDecoration: 'line-through' }}>📵</span>
                )}
                {' '}· 🧑‍💼 {v.vendedor || '-'} · 📣 {v.origen || '-'}
                {v.tipoCambio && <span style={{ color: '#c9a96e', marginLeft: 6 }}>· TC ${v.tipoCambio}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: `${estadoColor[v.estado]}22`, color: estadoColor[v.estado] }}>
                {v.estado}
              </span>
              <button onClick={() => abrirEditar(v)} style={{ background: '#2c2c2e', border: '1px solid #3a3a3c', color: '#c9a96e', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ✏️ Editar
              </button>
              <button onClick={() => eliminarVenta(v)} style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', color: '#ff3b30', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                🗑️
              </button>
            </div>
          </div>
        ))}
        {ventas.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#86868b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
            <p>No hay ventas registradas</p>
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editando ? '✏️ Editar venta' : 'Nueva venta'}</h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Equipo */}
              {!editando && (
                <div>
                  <label style={labelStyle}>Equipo</label>
                  <select value={form.equipoId} onChange={e => setForm({ ...form, equipoId: e.target.value })} required style={inputStyle}>
                    <option value="">Elegir equipo...</option>
                    {stock.map(s => <option key={s.id} value={s.id}>{s.modelo} {s.gb}GB {s.color} · Bat {s.bateria}%</option>)}
                  </select>
                </div>
              )}
              {equipoSeleccionado && (
                <div style={{ background: '#2c2c2e', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#c9a96e' }}>
                  📦 {equipoSeleccionado.modelo} · {equipoSeleccionado.gb}GB · {equipoSeleccionado.color} · Bat {equipoSeleccionado.bateria}% · Costo USD {equipoSeleccionado.costoUsd}
                </div>
              )}

              {/* Cliente y Teléfono */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cliente</label>
                  <input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} placeholder="Nombre del comprador" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                    placeholder="+54 9 11 1234-5678"
                    type="tel"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Vendedor</label>
                  <select value={form.vendedor} onChange={e => setForm({ ...form, vendedor: e.target.value })} style={inputStyle}>
                    <option value="">Elegir...</option>
                    {vendedores.map(v => <option key={v.id}>{v.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Origen de la venta</label>
                  <select value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} style={inputStyle}>
                    <option value="">Elegir...</option>
                    {origenes.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estado</label>
                  <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={inputStyle}>
                    <option value="pendiente">Pendiente</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>
                    Tipo de cambio (ARS/USD)
                    {tipoCambioGlobal && <span style={{ color: '#86868b', fontWeight: 400, marginLeft: 6 }}>— Global: ${tipoCambioGlobal}</span>}
                  </label>
                  <input
                    type="number"
                    value={form.tipoCambio}
                    onChange={e => setForm({ ...form, tipoCambio: e.target.value })}
                    placeholder={tipoCambioGlobal || '1430'}
                    style={inputStyle}
                  />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 11, color: '#86868b' }}>
                    Si no modificás el TC, se usa el tipo de cambio global de configuración.
                  </div>
                </div>
              </div>

              {/* Cobros */}
              <div style={{ borderTop: '1px solid #2c2c2e', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Formas de pago</label>
                  <button type="button" onClick={agregarCobro} style={{ background: 'none', border: '1px solid #c9a96e', color: '#c9a96e', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>+ Agregar</button>
                </div>
                {form.cobros.map((cobro, i) => (
                  <div key={i} style={{ background: '#2c2c2e', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Tipo</label>
                        <select value={cobro.tipo} onChange={e => updateCobro(i, 'tipo', e.target.value)} style={inputStyle}>
                          {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      {cobro.tipo !== 'iPhone como parte de pago' && (
                        <>
                          <div>
                            <label style={labelStyle}>Monto</label>
                            <input type="number" value={cobro.monto} onChange={e => updateCobro(i, 'monto', e.target.value)} placeholder="0" style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Moneda</label>
                            <select value={cobro.moneda} onChange={e => updateCobro(i, 'moneda', e.target.value)} style={inputStyle}>
                              <option>ARS</option><option>USD</option>
                            </select>
                          </div>
                        </>
                      )}
                      {cobro.tipo === 'Cuotas personales' && (
                        <>
                          <div>
                            <label style={labelStyle}>Cant. cuotas</label>
                            <input type="number" value={cobro.cuotas} onChange={e => updateCobro(i, 'cuotas', e.target.value)} placeholder="12" style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Monto por cuota</label>
                            <input type="number" value={cobro.montoCuota} onChange={e => updateCobro(i, 'montoCuota', e.target.value)} placeholder="0" style={inputStyle} />
                          </div>
                          <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelStyle}>Fecha primera cuota</label>
                            <input type="date" value={cobro.fechaInicio} onChange={e => updateCobro(i, 'fechaInicio', e.target.value)} style={inputStyle} />
                          </div>
                        </>
                      )}
                    </div>
                    {form.cobros.length > 1 && (
                      <button type="button" onClick={() => quitarCobro(i)} style={{ marginTop: 8, background: 'none', border: 'none', color: '#ff3b30', fontSize: 12, cursor: 'pointer' }}>Quitar</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Partes de pago iPhone */}
              {!editando && (
                <div style={{ borderTop: '1px solid #2c2c2e', paddingTop: 16 }}>
                  <label style={{ ...labelStyle, marginBottom: 12 }}>iPhones recibidos como parte de pago</label>
                  {form.partesDePago.map((p, i) => (
                    <div key={i} style={{ background: '#2c2c2e', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: '#c9a96e', fontWeight: 600 }}>📱 {p.modelo} {p.gb}GB {p.color}</span>
                        <div style={{ color: '#86868b', fontSize: 11, marginTop: 3 }}>
                          Toma: USD {p.costoUsd} · Venta: USD {p.pvUsd}
                        </div>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, partesDePago: f.partesDePago.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: 18 }}>✕</button>
                    </div>
                  ))}
                  <div style={{ background: '#2c2c2e', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div><label style={labelStyle}>Modelo</label><input value={nuevaParte.modelo} onChange={e => setNuevaParte({ ...nuevaParte, modelo: e.target.value })} placeholder="iPhone 13" style={inputStyle} /></div>
                      <div><label style={labelStyle}>GB</label><input value={nuevaParte.gb} onChange={e => setNuevaParte({ ...nuevaParte, gb: e.target.value })} placeholder="128" style={inputStyle} /></div>
                      <div><label style={labelStyle}>Color</label><input value={nuevaParte.color} onChange={e => setNuevaParte({ ...nuevaParte, color: e.target.value })} placeholder="Negro" style={inputStyle} /></div>
                      <div><label style={labelStyle}>Batería %</label><input type="number" value={nuevaParte.bateria} onChange={e => setNuevaParte({ ...nuevaParte, bateria: e.target.value })} placeholder="85" style={inputStyle} /></div>
                      <div><label style={labelStyle}>IMEI</label><input value={nuevaParte.imei} onChange={e => setNuevaParte({ ...nuevaParte, imei: e.target.value })} style={inputStyle} /></div>
                      <div style={{ gridColumn: '1/-1', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: 8, padding: 10 }}>
                        <div style={{ color: '#c9a96e', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>VALUACIÓN DEL EQUIPO RECIBIDO</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={labelStyle}>Lo tomo a USD (costo)</label>
                            <input type="number" value={nuevaParte.costoUsd} onChange={e => setNuevaParte({ ...nuevaParte, costoUsd: e.target.value })} placeholder="200" style={inputStyle} />
                            <div style={{ fontSize: 10, color: '#86868b', marginTop: 3 }}>Valor que le reconocés al cliente</div>
                          </div>
                          <div>
                            <label style={labelStyle}>Lo vendo a USD (precio venta)</label>
                            <input type="number" value={nuevaParte.pvUsd} onChange={e => setNuevaParte({ ...nuevaParte, pvUsd: e.target.value })} placeholder="280" style={inputStyle} />
                            <div style={{ fontSize: 10, color: '#86868b', marginTop: 3 }}>Se carga en stock como precio de venta</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={agregarParte} style={{ background: '#c9a96e', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Agregar iPhone</button>
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: '#c9a96e', border: 'none', borderRadius: 8, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Guardar venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalLimite && (
        <ModalLimiteAlcanzado
          tipo="ventas" planActual={plan}
          cantidadActual={ventasMesCount}
          onCerrar={() => setModalLimite(false)}
        />
      )}
    </div>
  );
}
