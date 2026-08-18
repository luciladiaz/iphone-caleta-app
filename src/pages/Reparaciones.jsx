import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconWrench, IconEdit, IconTrash, IconX, IconCheckCircle, IconFile } from '../components/Icons';
import { registrarMovimientoReparacion, registrarEgresoRepuestoReparacion, eliminarMovimientosReparacion } from '../lib/caja';
import ComprobanteReparacion from '../components/ComprobanteReparacion';
import SelectorCliente from '../components/SelectorCliente';

const ESTADOS = ['ingresado', 'diagnosticado', 'presupuestado', 'aprobado', 'en_reparacion', 'esperando_repuesto', 'listo', 'entregado', 'no_reparable', 'cancelado'];
const ESTADO_LABEL = {
  ingresado: 'Ingresado', diagnosticado: 'Diagnosticado', presupuestado: 'Presupuestado',
  aprobado: 'Aprobado por cliente', en_reparacion: 'En reparación', esperando_repuesto: 'Esperando repuesto',
  listo: 'Listo para retirar', entregado: 'Entregado', no_reparable: 'No reparable', cancelado: 'Cancelado',
};
const ESTADO_COLOR = {
  ingresado: 'var(--rv-text-mid)', diagnosticado: 'var(--rv-text-mid)', presupuestado: '#e6a700',
  aprobado: '#e6a700', en_reparacion: 'var(--rv-accent)', esperando_repuesto: '#e07b1a',
  listo: '#2fa64d', entregado: 'var(--rv-text-dim)', no_reparable: 'var(--rv-danger)', cancelado: 'var(--rv-danger)',
};

const FORM_VACIO = {
  clienteId: '', cliente: '', telefono: '', modelo: '', color: '', imei: '', claveEquipo: '',
  fallaReportada: '', diagnostico: '', estado: 'ingresado',
  costoRepuestoUsd: '', precioUsd: '', montoPagado: '', garantiaDias: '30',
  fechaEntregaManual: '', notas: '',
};

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

export default function Reparaciones() {
  const { perfil, negocioId, negocio } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const base = ['negocios', negocioId];

  const [reparaciones, setReparaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [comprobanteDe, setComprobanteDe] = useState(null);

  const cargar = async () => {
    if (!negocioId) return;
    const [snap, cliSnap] = await Promise.all([
      getDocs(query(collection(db, ...base, 'reparaciones'), orderBy('fechaIngreso', 'desc'))),
      getDocs(query(collection(db, ...base, 'clientes'), orderBy('nombre'))),
    ]);
    setReparaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setClientes(cliSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const seleccionarCliente = (c) => {
    setForm(f => ({ ...f, clienteId: c?.id || '', cliente: c?.nombre || '', telefono: c?.telefono || '' }));
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const abrirNueva = () => {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setModal(true);
  };

  const abrirEditar = (rep) => {
    setEditandoId(rep.id);
    setForm({
      clienteId: rep.clienteId || '', cliente: rep.cliente || '', telefono: rep.telefono || '', modelo: rep.modelo || '',
      color: rep.color || '', imei: rep.imei || '', claveEquipo: rep.claveEquipo || '',
      fallaReportada: rep.fallaReportada || '', diagnostico: rep.diagnostico || '',
      estado: rep.estado || 'ingresado', costoRepuestoUsd: rep.costoRepuestoUsd || '',
      precioUsd: rep.precioUsd || '', montoPagado: rep.montoPagado || '',
      garantiaDias: rep.garantiaDias ?? '30', fechaEntregaManual: '', notas: rep.notas || '',
    });
    setModal(true);
  };

  const cerrarModal = () => {
    setModal(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const eliminarReparacion = async (rep) => {
    if (!window.confirm('¿Eliminás esta reparación? Esta acción no se puede deshacer.')) return;
    await deleteDoc(doc(db, ...base, 'reparaciones', rep.id));
    try { await eliminarMovimientosReparacion(negocioId, rep.id); } catch {}
    cargar();
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const datos = {
        clienteId: form.clienteId, cliente: form.cliente, telefono: form.telefono, modelo: form.modelo, color: form.color,
        imei: form.imei, claveEquipo: form.claveEquipo, fallaReportada: form.fallaReportada,
        diagnostico: form.diagnostico, estado: form.estado,
        costoRepuestoUsd: Number(form.costoRepuestoUsd) || 0, precioUsd: Number(form.precioUsd) || 0,
        montoPagado: Number(form.montoPagado) || 0, garantiaDias: Number(form.garantiaDias) || 0,
        notas: form.notas,
      };
      if (form.fechaEntregaManual) datos.fechaEntrega = new Date(form.fechaEntregaManual);

      let idReparacion = editandoId;
      if (editandoId) {
        await updateDoc(doc(db, ...base, 'reparaciones', editandoId), datos);
      } else {
        const repRef = await addDoc(collection(db, ...base, 'reparaciones'), { ...datos, fechaIngreso: serverTimestamp() });
        idReparacion = repRef.id;
      }
      // El monto cobrado y/o el costo del repuesto pudieron cambiar (o recién cargarse):
      // se regeneran los movimientos de caja de esta reparación, tanto en alta como en edición.
      await eliminarMovimientosReparacion(negocioId, idReparacion);
      await registrarMovimientoReparacion(negocioId, idReparacion, datos);
      await registrarEgresoRepuestoReparacion(negocioId, idReparacion, datos);
      cerrarModal();
      cargar();
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
  };

  const reparacionesFiltradas = reparaciones.filter(r =>
    `${r.cliente} ${r.modelo} ${r.imei} ${r.telefono}`.toLowerCase().includes(filtro.toLowerCase())
  );

  const fechaVenceGarantia = (rep) => {
    if (!rep.fechaEntrega || !rep.garantiaDias) return null;
    const entrega = rep.fechaEntrega.toDate ? rep.fechaEntrega.toDate() : new Date(rep.fechaEntrega);
    const vence = new Date(entrega);
    vence.setDate(vence.getDate() + Number(rep.garantiaDias));
    return vence;
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando reparaciones...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><IconWrench size={22} />Reparaciones</h1>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, margin: '4px 0 0' }}>{reparaciones.length} en total</p>
        </div>
        <button onClick={abrirNueva} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Nueva reparación</button>
      </div>

      <input placeholder="Buscar por cliente, modelo, IMEI, teléfono..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...inputStyle, marginBottom: 20, maxWidth: 420 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {reparacionesFiltradas.map(rep => {
          const vence = fechaVenceGarantia(rep);
          const saldo = (rep.precioUsd || 0) - (rep.montoPagado || 0);
          return (
            <div key={rep.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 20, borderTop: `3px solid ${ESTADO_COLOR[rep.estado] || 'var(--rv-accent)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{rep.modelo || 'Sin modelo'}</div>
                  <div style={{ fontSize: 12, color: 'var(--rv-text-dim)' }}>{rep.cliente}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', border: '1px solid var(--rv-border)', color: ESTADO_COLOR[rep.estado] }}>{ESTADO_LABEL[rep.estado] || rep.estado}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--rv-text-mid)', marginBottom: 12 }}>
                {rep.fallaReportada && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{rep.fallaReportada}</span>}
                {rep.imei && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>IMEI {rep.imei}</span>}
                {esAdmin && rep.costoRepuestoUsd > 0 && <span style={{ color: 'var(--rv-text-dim)' }}>Costo repuesto: USD {rep.costoRepuestoUsd}</span>}
                {rep.precioUsd > 0 && <span style={{ color: 'var(--rv-accent)', fontWeight: 600 }}>Precio: USD {rep.precioUsd}{saldo > 0 && ` · Debe USD ${saldo}`}</span>}
                {vence && <span style={{ color: 'var(--rv-text-dim)' }}>Garantía hasta {vence.toLocaleDateString('es-AR')}</span>}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setComprobanteDe(rep)} style={{ flex: 1, background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: rep.comprobante ? 'var(--rv-text)' : 'var(--rv-text-mid)', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><IconFile size={13} />{rep.comprobante ? 'Ver comprobante' : 'Comprobante'}</button>
                <button onClick={() => abrirEditar(rep)} style={{ flex: 1, background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-accent)', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><IconEdit size={13} />Editar</button>
                {esAdmin && <button onClick={() => eliminarReparacion(rep)} style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', color: 'var(--rv-danger)', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconTrash size={14} /></button>}
              </div>
            </div>
          );
        })}
      </div>

      {reparacionesFiltradas.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
          <IconWrench size={36} style={{ marginBottom: 12 }} />
          <p>No hay reparaciones cargadas</p>
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}>{editandoId ? <><IconEdit size={16} />Editar reparación</> : 'Nueva reparación'}</h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SelectorCliente
                  negocioId={negocioId}
                  clientes={clientes}
                  clienteId={form.clienteId}
                  onSeleccionar={seleccionarCliente}
                  onClienteCreado={(c) => setClientes(cs => [...cs, c].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
                />
                <div><label style={labelStyle}>Teléfono</label><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+54 9 11 1234-5678" style={inputStyle} /></div>
                <div><label style={labelStyle}>Modelo</label><input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} placeholder="iPhone 13" required style={inputStyle} /></div>
                <div><label style={labelStyle}>Color</label><input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="Negro" style={inputStyle} /></div>
                <div><label style={labelStyle}>IMEI</label><input value={form.imei} onChange={e => setForm({ ...form, imei: e.target.value })} placeholder="123456789012345" style={inputStyle} /></div>
                <div><label style={labelStyle}>Clave / patrón</label><input value={form.claveEquipo} onChange={e => setForm({ ...form, claveEquipo: e.target.value })} placeholder="Para poder testear" style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Falla reportada por el cliente</label><textarea value={form.fallaReportada} onChange={e => setForm({ ...form, fallaReportada: e.target.value })} rows={2} placeholder="No carga, pantalla rota..." style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Diagnóstico técnico</label><textarea value={form.diagnostico} onChange={e => setForm({ ...form, diagnostico: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><label style={labelStyle}>Estado</label><select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={inputStyle}>{ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}</select></div>
                <div><label style={labelStyle}>Garantía (días)</label><input type="number" min="0" value={form.garantiaDias} onChange={e => setForm({ ...form, garantiaDias: e.target.value })} placeholder="30" style={inputStyle} /></div>
                {esAdmin && <div><label style={labelStyle}>Costo repuesto USD</label><input type="number" value={form.costoRepuestoUsd} onChange={e => setForm({ ...form, costoRepuestoUsd: e.target.value })} placeholder="60" style={inputStyle} /></div>}
                <div><label style={labelStyle}>Precio al cliente USD</label><input type="number" value={form.precioUsd} onChange={e => setForm({ ...form, precioUsd: e.target.value })} placeholder="90" style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>Monto ya cobrado USD</label>
                  <input type="number" value={form.montoPagado} onChange={e => setForm({ ...form, montoPagado: e.target.value })} placeholder="0" style={inputStyle} />
                  <div style={{ fontSize: 11, color: 'var(--rv-text-dim)', marginTop: 3 }}>Se carga solo a Caja al guardar.</div>
                </div>
                <div><label style={labelStyle}>Fecha de entrega</label><input type="date" value={form.fechaEntregaManual} onChange={e => setForm({ ...form, fechaEntregaManual: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Notas</label><textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              </div>

              {Number(form.precioUsd) > 0 && (() => {
                const precio = Number(form.precioUsd) || 0;
                const pagado = Number(form.montoPagado) || 0;
                const saldo = precio - pagado;
                return (
                  <div style={{ borderRadius: 10, border: '1px solid rgba(47,111,237,0.3)', background: 'var(--rv-accent-soft)', padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rv-text-dim)', marginBottom: 8, textTransform: 'uppercase' }}>Resumen de pago</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--rv-text-dim)' }}>Precio al cliente</span>
                        <span style={{ fontWeight: 700 }}>USD {precio}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--rv-text-dim)' }}>Cobrado</span>
                        <span style={{ fontWeight: 700 }}>USD {pagado}</span>
                      </div>
                      <div style={{ borderTop: '1px solid var(--rv-border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ fontWeight: 700 }}>Saldo restante</span>
                        <span style={{ fontWeight: 800, color: saldo <= 0 ? 'var(--rv-text)' : 'var(--rv-text-mid)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {saldo <= 0 ? <><IconCheckCircle size={14} style={{ color: 'var(--rv-accent)' }} />Saldado</> : `USD ${saldo}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear reparación'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {comprobanteDe && (
        <ComprobanteReparacion
          reparacion={comprobanteDe}
          negocioId={negocioId}
          negocioNombre={negocio?.nombre}
          entregadoPor={perfil?.nombre}
          onClose={() => setComprobanteDe(null)}
          onGuardado={(comprobante) => {
            setReparaciones(rs => rs.map(r => r.id === comprobanteDe.id ? { ...r, comprobante } : r));
            setComprobanteDe(null);
          }}
        />
      )}
    </div>
  );
}
