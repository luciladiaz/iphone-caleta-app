import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconWrench, IconCamera, IconEdit, IconTrash, IconX, IconWarning } from '../components/Icons';

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
  cliente: '', telefono: '', modelo: '', color: '', imei: '', claveEquipo: '',
  fallaReportada: '', diagnostico: '', estado: 'ingresado',
  costoRepuestoUsd: '', precioUsd: '', montoPagado: '', garantiaDias: '30',
  fechaEntregaManual: '', notas: '',
};

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

// Redimensiona a 1600px de ancho máx y comprime a JPEG calidad 0.85 antes de subir.
// Sigue viéndose nítido para documentar rayones/golpes, pero pesa una fracción de la
// foto original de cámara (que puede ser de varios MB) — así no genera costo de Storage.
async function comprimirImagen(file, maxAncho = 1600, calidad = 0.85) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxAncho / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

export default function Reparaciones() {
  const { perfil, negocioId } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const base = ['negocios', negocioId];

  const [reparaciones, setReparaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [fotos, setFotos] = useState([]); // [{ url, path }]
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const carpetaFotos = useRef(null);
  const fileInputRef = useRef(null);

  const cargar = async () => {
    if (!negocioId) return;
    const snap = await getDocs(query(collection(db, ...base, 'reparaciones'), orderBy('fechaIngreso', 'desc')));
    setReparaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const abrirNueva = () => {
    carpetaFotos.current = `nueva-${Date.now()}`;
    setForm(FORM_VACIO);
    setFotos([]);
    setEditandoId(null);
    setModal(true);
  };

  const abrirEditar = (rep) => {
    carpetaFotos.current = rep.id;
    setEditandoId(rep.id);
    setForm({
      cliente: rep.cliente || '', telefono: rep.telefono || '', modelo: rep.modelo || '',
      color: rep.color || '', imei: rep.imei || '', claveEquipo: rep.claveEquipo || '',
      fallaReportada: rep.fallaReportada || '', diagnostico: rep.diagnostico || '',
      estado: rep.estado || 'ingresado', costoRepuestoUsd: rep.costoRepuestoUsd || '',
      precioUsd: rep.precioUsd || '', montoPagado: rep.montoPagado || '',
      garantiaDias: rep.garantiaDias ?? '30', fechaEntregaManual: '', notas: rep.notas || '',
    });
    setFotos(rep.fotosIngreso || []);
    setModal(true);
  };

  const cerrarModal = () => {
    setModal(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFotos([]);
  };

  const subirFotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !negocioId) return;
    setSubiendoFoto(true);
    try {
      for (const file of files) {
        const blob = await comprimirImagen(file);
        const path = `negocios/${negocioId}/reparaciones/${carpetaFotos.current}/${Date.now()}-${file.name.replace(/\.[^.]+$/, '')}.jpg`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        setFotos(f => [...f, { url, path }]);
      }
    } catch (err) {
      console.error('Error subiendo foto:', err);
      alert('No pudimos subir alguna foto. Intentá de nuevo.');
    } finally {
      setSubiendoFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const quitarFoto = async (foto) => {
    setFotos(f => f.filter(x => x.url !== foto.url));
    try { if (foto.path) await deleteObject(ref(storage, foto.path)); } catch { /* ya no existía, no importa */ }
  };

  const eliminarReparacion = async (rep) => {
    if (!window.confirm('¿Eliminás esta reparación? Esta acción no se puede deshacer.')) return;
    await deleteDoc(doc(db, ...base, 'reparaciones', rep.id));
    for (const foto of (rep.fotosIngreso || [])) {
      try { if (foto.path) await deleteObject(ref(storage, foto.path)); } catch { /* ignorar */ }
    }
    cargar();
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const datos = {
        cliente: form.cliente, telefono: form.telefono, modelo: form.modelo, color: form.color,
        imei: form.imei, claveEquipo: form.claveEquipo, fallaReportada: form.fallaReportada,
        diagnostico: form.diagnostico, estado: form.estado,
        costoRepuestoUsd: Number(form.costoRepuestoUsd) || 0, precioUsd: Number(form.precioUsd) || 0,
        montoPagado: Number(form.montoPagado) || 0, garantiaDias: Number(form.garantiaDias) || 0,
        notas: form.notas, fotosIngreso: fotos,
      };
      if (form.fechaEntregaManual) datos.fechaEntrega = new Date(form.fechaEntregaManual);

      if (editandoId) {
        await updateDoc(doc(db, ...base, 'reparaciones', editandoId), datos);
      } else {
        await addDoc(collection(db, ...base, 'reparaciones'), { ...datos, fechaIngreso: serverTimestamp() });
      }
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

              {rep.fotosIngreso?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
                  {rep.fotosIngreso.map((f, i) => (
                    <img key={i} src={f.url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--rv-border)', flexShrink: 0 }} />
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--rv-text-mid)', marginBottom: 12 }}>
                {rep.fallaReportada && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{rep.fallaReportada}</span>}
                {rep.imei && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>IMEI {rep.imei}</span>}
                {esAdmin && rep.costoRepuestoUsd > 0 && <span style={{ color: 'var(--rv-text-dim)' }}>Costo repuesto: USD {rep.costoRepuestoUsd}</span>}
                {rep.precioUsd > 0 && <span style={{ color: 'var(--rv-accent)', fontWeight: 600 }}>Precio: USD {rep.precioUsd}{saldo > 0 && ` · Debe USD ${saldo}`}</span>}
                {vence && <span style={{ color: 'var(--rv-text-dim)' }}>Garantía hasta {vence.toLocaleDateString('es-AR')}</span>}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
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
                <div><label style={labelStyle}>Cliente</label><input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} placeholder="Nombre del cliente" required style={inputStyle} /></div>
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
                <div><label style={labelStyle}>Monto ya cobrado USD</label><input type="number" value={form.montoPagado} onChange={e => setForm({ ...form, montoPagado: e.target.value })} placeholder="0" style={inputStyle} /></div>
                <div><label style={labelStyle}>Fecha de entrega</label><input type="date" value={form.fechaEntregaManual} onChange={e => setForm({ ...form, fechaEntregaManual: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Notas</label><textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              </div>

              <div>
                <label style={labelStyle}>Fotos del estado al ingresar</label>
                <p style={{ fontSize: 11, color: 'var(--rv-text-dim)', margin: '0 0 8px' }}>
                  <IconWarning size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                  Sacale foto a cualquier rayón o golpe antes de empezar — te cubre ante un reclamo de &quot;esto ya estaba roto&quot;.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {fotos.map((f, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={f.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--rv-border)' }} />
                      <button type="button" onClick={() => quitarFoto(f)} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--rv-danger)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconX size={11} /></button>
                    </div>
                  ))}
                  <label style={{ width: 64, height: 64, background: 'var(--rv-surface-alt)', border: '1px dashed var(--rv-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--rv-text-dim)' }}>
                    {subiendoFoto ? '...' : <IconCamera size={20} />}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={subirFotos} disabled={subiendoFoto} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear reparación'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
