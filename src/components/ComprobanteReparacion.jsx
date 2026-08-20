import { useRef, useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { db } from '../firebase/config';
import { IconFile, IconX, IconCheck, IconDownload, IconSave, IconTrash, IconShare } from './Icons';

// Normaliza un teléfono argentino cargado en cualquier formato común al formato
// que WhatsApp necesita en el link wa.me: 549 + código de área + número.
function numeroWhatsapp(telefono) {
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('0')) n = n.slice(1);
  if (n.startsWith('15')) n = n.slice(2);
  if (n.startsWith('54')) n = n.slice(2);
  if (n.startsWith('9')) n = n.slice(1);
  return `549${n}`;
}

const ITEMS_CHECKLIST_DEFAULT = [
  'Equipo probado funcionando delante del cliente',
  'Se informó el diagnóstico y la reparación realizada',
  'Se explicó la garantía y sus condiciones',
  'Se entregó el equipo con todos sus accesorios',
];

// Comprobantes viejos guardan el checklist como {key: true/false} con textos fijos;
// los nuevos, como lista [{label, checked}] editable por el negocio. Esto traduce
// el formato viejo al nuevo para poder seguir mostrándolo.
const LABEL_POR_KEY_VIEJA = {
  probado: ITEMS_CHECKLIST_DEFAULT[0], diagnostico: ITEMS_CHECKLIST_DEFAULT[1],
  garantia: ITEMS_CHECKLIST_DEFAULT[2], accesorios: ITEMS_CHECKLIST_DEFAULT[3],
};
function checklistDeComprobante(c) {
  if (!c?.checklist) return null;
  if (Array.isArray(c.checklist)) return c.checklist;
  return Object.entries(c.checklist).map(([key, checked]) => ({ label: LABEL_POR_KEY_VIEJA[key] || key, checked }));
}

export default function ComprobanteReparacion({ reparacion, negocioId, negocioNombre, entregadoPor, onClose, onGuardado }) {
  const yaExiste = !!reparacion.comprobante;
  const [items, setItems] = useState(
    checklistDeComprobante(reparacion.comprobante) || ITEMS_CHECKLIST_DEFAULT.map(label => ({ label, checked: false }))
  );
  const [modoFirma, setModoFirma] = useState(!yaExiste);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [enviandoWA, setEnviandoWA] = useState(false);
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const reciboRef = useRef(null);
  const [firmaParaRecibo, setFirmaParaRecibo] = useState(reparacion.comprobante?.firma || null);

  useEffect(() => {
    if (!modoFirma) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
  }, [modoFirma]);

  // Si esta reparación todavía no tiene su propio checklist guardado, arranca con el
  // último que el negocio dejó configurado (para no tener que reescribir los puntos
  // agregados/editados en cada reparación nueva).
  useEffect(() => {
    if (reparacion.comprobante) return;
    (async () => {
      try {
        const cfgSnap = await getDoc(doc(db, 'negocios', negocioId, 'config', 'general'));
        const guardado = cfgSnap.data()?.checklistReparacion;
        if (guardado?.length) setItems(guardado.map(label => ({ label, checked: false })));
      } catch (err) { console.error('Error cargando checklist configurado:', err); }
    })();
  }, [negocioId]);

  const editarLabel = (idx, label) => setItems(its => its.map((it, i) => i === idx ? { ...it, label } : it));
  const toggleItem = (idx) => setItems(its => its.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it));
  const agregarItem = () => setItems(its => [...its, { label: '', checked: false }]);
  const quitarItem = (idx) => setItems(its => its.filter((_, i) => i !== idx));

  const posDesdeEvento = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const empezarTrazo = (e) => {
    dibujando.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = posDesdeEvento(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const trazar = (e) => {
    if (!dibujando.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = posDesdeEvento(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (firmaVacia) setFirmaVacia(false);
  };

  const terminarTrazo = () => { dibujando.current = false; };

  const borrarFirma = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setFirmaVacia(true);
  };

  const todoTildado = items.length > 0 && items.every(it => it.checked);
  const precio = Number(reparacion.precioUsd) || 0;
  const pagado = Number(reparacion.montoPagado) || 0;
  const saldo = precio - pagado;
  const garantiaDias = Number(reparacion.garantiaDias) || 0;
  const fechaEntregaBase = reparacion.fechaEntrega
    ? (reparacion.fechaEntrega.toDate ? reparacion.fechaEntrega.toDate() : new Date(reparacion.fechaEntrega))
    : new Date();
  const venceGarantia = garantiaDias > 0
    ? new Date(fechaEntregaBase.getTime() + garantiaDias * 86400000)
    : null;

  const nombreArchivo = () => `comprobante-reparacion-${(reparacion.cliente || 'cliente').replace(/\s+/g, '_')}-${reparacion.id}.png`;

  const renderizarRecibo = async (dataUrlFirma) => {
    setFirmaParaRecibo(dataUrlFirma);
    await new Promise(r => setTimeout(r, 50));
    return html2canvas(reciboRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
  };

  const generarImagen = async (dataUrlFirma) => {
    const canvas = await renderizarRecibo(dataUrlFirma);
    const link = document.createElement('a');
    link.download = nombreArchivo();
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // En el celular usa el selector nativo para compartir el PNG directo por WhatsApp
  // (con WhatsApp entre las opciones y el archivo ya adjunto). Los links wa.me no
  // permiten adjuntar archivos, así que en desktop (o si el navegador no soporta
  // compartir archivos) se descarga el PNG y se abre el chat para adjuntarlo a mano.
  const enviarPorWhatsapp = async (dataUrlFirma) => {
    const canvas = await renderizarRecibo(dataUrlFirma);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const archivo = nombreArchivo();
    const mensaje = `Hola${reparacion.cliente ? ' ' + reparacion.cliente : ''}! Te paso el comprobante de tu reparación.`;

    const file = new File([blob], archivo, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: mensaje });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const link = document.createElement('a');
    link.download = archivo;
    link.href = URL.createObjectURL(blob);
    link.click();
    const numero = numeroWhatsapp(reparacion.telefono);
    const url = numero
      ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje + ' Un segundo que te adjunto la imagen que se acaba de descargar.')}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const guardarComprobante = async () => {
    const firma = canvasRef.current.toDataURL('image/png');
    const comprobante = {
      checklist: items,
      firma,
      fecha: serverTimestamp(),
      generadoPor: entregadoPor || 'Vendedor',
    };
    await updateDoc(doc(db, 'negocios', negocioId, 'reparaciones', reparacion.id), { comprobante });
    // Esta versión del checklist (con lo agregado/editado) queda como la default del
    // negocio para la próxima reparación.
    await setDoc(doc(db, 'negocios', negocioId, 'config', 'general'), { checklistReparacion: items.map(it => it.label) }, { merge: true });
    return { comprobante, firma };
  };

  const validarAntesDeGuardar = () => {
    if (!todoTildado) { alert('Tildá los puntos del checklist antes de generar el comprobante.'); return false; }
    if (firmaVacia) { alert('Falta la firma del cliente.'); return false; }
    return true;
  };

  const guardarYGenerar = async () => {
    if (!validarAntesDeGuardar()) return;
    setGuardando(true);
    try {
      const { comprobante, firma } = await guardarComprobante();
      await generarImagen(firma);
      onGuardado({ ...comprobante, fecha: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      alert('Error al guardar el comprobante. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarYEnviarWhatsapp = async () => {
    if (!validarAntesDeGuardar()) return;
    setEnviandoWA(true);
    try {
      const { comprobante, firma } = await guardarComprobante();
      await enviarPorWhatsapp(firma);
      onGuardado({ ...comprobante, fecha: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      alert('Error al guardar el comprobante. Probá de nuevo.');
    } finally {
      setEnviandoWA(false);
    }
  };

  const volverADescargar = async () => {
    setGuardando(true);
    try { await generarImagen(reparacion.comprobante.firma); }
    finally { setGuardando(false); }
  };

  const volverAEnviarWhatsapp = async () => {
    setEnviandoWA(true);
    try { await enviarPorWhatsapp(reparacion.comprobante.firma); }
    finally { setEnviandoWA(false); }
  };

  const c = reparacion.comprobante;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><IconFile size={16} />Comprobante de reparación</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
        </div>

        <div style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 20 }}>
          {reparacion.modelo} {reparacion.color} · {reparacion.cliente || 'Sin cliente'}
        </div>

        {!modoFirma && c ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--rv-text-mid)', alignItems: 'center' }}>
                  <IconCheck size={12} /> {it.label}
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--rv-border)', borderRadius: 10, padding: 8, marginBottom: 12 }}>
              <img src={c.firma} alt="Firma del cliente" style={{ width: '100%', display: 'block' }} />
            </div>
            <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginBottom: 20 }}>
              Generado por {c.generadoPor}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={volverADescargar} disabled={guardando || enviandoWA} style={{ flex: 1, background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {guardando ? 'Generando...' : <><IconDownload size={15} />Descargar</>}
              </button>
              <button onClick={() => setModoFirma(true)} style={{ background: 'var(--rv-surface-alt)', color: 'var(--rv-text-mid)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Rehacer
              </button>
            </div>
            <button onClick={volverAEnviarWhatsapp} disabled={guardando || enviandoWA} style={{ width: '100%', background: '#25D366', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: enviandoWA ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {enviandoWA ? 'Preparando...' : <><IconShare size={15} />Enviar por WhatsApp</>}
            </button>
          </>
        ) : (
          <>
            <div style={{ color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Chequeo delante del cliente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={() => toggleItem(idx)}
                    style={{ width: 18, height: 18, accentColor: 'var(--rv-accent)', flexShrink: 0 }}
                  />
                  <input
                    value={it.label}
                    onChange={e => editarLabel(idx, e.target.value)}
                    placeholder="Punto a chequear"
                    style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--rv-border)', color: 'var(--rv-text)', fontSize: 13, padding: '4px 2px', outline: 'none' }}
                  />
                  <button type="button" onClick={() => quitarItem(idx)} title="Quitar este punto" style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={agregarItem} style={{ background: 'none', border: '1px solid var(--rv-accent)', color: 'var(--rv-accent)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 20 }}>
              + Agregar punto
            </button>

            {saldo > 0 && (
              <div style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--rv-danger)', marginBottom: 16 }}>
                El cliente todavía debe USD {saldo} de esta reparación.
              </div>
            )}

            <div style={{ color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Firma del cliente al retirar
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--rv-border)', borderRadius: 10, marginBottom: 8, touchAction: 'none' }}>
              <canvas
                ref={canvasRef}
                width={420} height={160}
                style={{ width: '100%', height: 160, borderRadius: 10, cursor: 'crosshair', display: 'block' }}
                onPointerDown={empezarTrazo}
                onPointerMove={trazar}
                onPointerUp={terminarTrazo}
                onPointerLeave={terminarTrazo}
              />
            </div>
            <button onClick={borrarFirma} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', fontSize: 12, cursor: 'pointer', marginBottom: 20 }}>
              Borrar y firmar de nuevo
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={guardarYGenerar}
                disabled={guardando || enviandoWA || !todoTildado || firmaVacia}
                style={{
                  flex: 1, background: (!todoTildado || firmaVacia) ? 'var(--rv-surface-alt)' : 'var(--rv-accent)',
                  color: (!todoTildado || firmaVacia) ? 'var(--rv-text-dim)' : '#fff',
                  border: (!todoTildado || firmaVacia) ? '1px solid var(--rv-border)' : 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700,
                  cursor: (guardando || enviandoWA || !todoTildado || firmaVacia) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {guardando ? 'Guardando...' : <><IconSave size={15} />Guardar</>}
              </button>
              <button
                onClick={guardarYEnviarWhatsapp}
                disabled={guardando || enviandoWA || !todoTildado || firmaVacia}
                style={{
                  flex: 1, background: (!todoTildado || firmaVacia) ? 'var(--rv-surface-alt)' : '#25D366',
                  color: (!todoTildado || firmaVacia) ? 'var(--rv-text-dim)' : '#fff',
                  border: (!todoTildado || firmaVacia) ? '1px solid var(--rv-border)' : 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700,
                  cursor: (guardando || enviandoWA || !todoTildado || firmaVacia) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {enviandoWA ? 'Preparando...' : <><IconShare size={15} />WhatsApp</>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Plantilla del recibo, fuera de pantalla — se captura con html2canvas para el PNG */}
      <div style={{ position: 'fixed', left: -9999, top: 0 }}>
        <div ref={reciboRef} style={{ width: 560, background: '#ffffff', color: '#111', fontFamily: "'Manrope', Arial, sans-serif", padding: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{negocioNombre || 'Negocio'}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Comprobante de reparación</div>
          </div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>CLIENTE</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{reparacion.cliente || 'Sin nombre'} {reparacion.telefono ? `· ${reparacion.telefono}` : ''}</div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>EQUIPO</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{reparacion.modelo} {reparacion.color}</div>
          <div style={{ fontSize: 13, color: '#333', marginBottom: 16 }}>IMEI: {reparacion.imei || 'no registrado'}</div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>FALLA REPORTADA</div>
          <div style={{ fontSize: 13, color: '#333', marginBottom: 12 }}>{reparacion.fallaReportada || '—'}</div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>DIAGNÓSTICO Y REPARACIÓN REALIZADA</div>
          <div style={{ fontSize: 13, color: '#333', marginBottom: 16 }}>{reparacion.diagnostico || '—'}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
            <div>
              <div style={{ color: '#555', marginBottom: 4 }}>PRECIO</div>
              <div style={{ fontWeight: 700 }}>USD {precio}</div>
            </div>
            <div>
              <div style={{ color: '#555', marginBottom: 4 }}>COBRADO</div>
              <div style={{ fontWeight: 700 }}>USD {pagado}</div>
            </div>
            <div>
              <div style={{ color: '#555', marginBottom: 4 }}>SALDO</div>
              <div style={{ fontWeight: 700, color: saldo > 0 ? '#d43d3d' : '#111' }}>{saldo > 0 ? `USD ${saldo}` : 'Saldado'}</div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>VERIFICADO DELANTE DEL CLIENTE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ fontSize: 13 }}>✓ {it.label}</div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>FIRMA DEL CLIENTE</div>
          {firmaParaRecibo && <img src={firmaParaRecibo} alt="firma" style={{ width: 240, border: '1px solid #ccc', borderRadius: 6, marginBottom: 20 }} />}

          <div style={{ fontSize: 11, color: '#777', lineHeight: 1.6, borderTop: '1px solid #ccc', paddingTop: 12 }}>
            {garantiaDias > 0
              ? `Esta reparación cuenta con ${garantiaDias} días de garantía sobre el trabajo realizado${venceGarantia ? `, hasta el ${venceGarantia.toLocaleDateString('es-AR')}` : ''}. La garantía cubre exclusivamente la falla reparada y no daños posteriores, humedad o mal uso.`
              : 'Esta reparación no incluye garantía adicional sobre el trabajo realizado.'}
            {' '}El cliente probó el equipo en persona antes de retirarlo, según el detalle anterior.
          </div>

          <div style={{ fontSize: 10, color: '#999', marginTop: 16, textAlign: 'right' }}>
            Generado con ReventApp · {new Date().toLocaleDateString('es-AR')}
          </div>
        </div>
      </div>
    </div>
  );
}
