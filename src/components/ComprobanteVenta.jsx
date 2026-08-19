import { useRef, useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { db } from '../firebase/config';
import { IconFile, IconX, IconCheck, IconDownload, IconSave, IconTrash } from './Icons';
import { formatCapacidad } from '../lib/categoriasProducto';

const ITEMS_CHECKLIST_DEFAULT = [
  'Batería revisada delante del cliente',
  'Pantalla sin fisuras, táctil funciona correctamente',
  'Cámaras (foto y video) probadas',
  'Botones de volumen y encendido funcionan',
  'Carga y conexión (WiFi/datos) probadas',
  'Face ID / Touch ID funciona',
];

// Comprobantes viejos guardan el checklist como {key: true/false} con textos fijos;
// los nuevos, como lista [{label, checked}] editable por el negocio. Esto traduce
// el formato viejo al nuevo para poder seguir mostrándolo.
const LABEL_POR_KEY_VIEJA = {
  bateria: ITEMS_CHECKLIST_DEFAULT[0], pantalla: ITEMS_CHECKLIST_DEFAULT[1], camaras: ITEMS_CHECKLIST_DEFAULT[2],
  botones: ITEMS_CHECKLIST_DEFAULT[3], carga: ITEMS_CHECKLIST_DEFAULT[4], faceId: ITEMS_CHECKLIST_DEFAULT[5],
};
function checklistDeComprobante(c) {
  if (!c?.checklist) return null;
  if (Array.isArray(c.checklist)) return c.checklist;
  return Object.entries(c.checklist).map(([key, checked]) => ({ label: LABEL_POR_KEY_VIEJA[key] || key, checked }));
}

export default function ComprobanteVenta({ venta, negocioId, negocioNombre, vendedorNombre, onClose, onGuardado }) {
  const yaExiste = !!venta.comprobante;
  const [items, setItems] = useState(
    checklistDeComprobante(venta.comprobante) || ITEMS_CHECKLIST_DEFAULT.map(label => ({ label, checked: false }))
  );
  const [modoFirma, setModoFirma] = useState(!yaExiste);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const reciboRef = useRef(null);
  const [firmaParaRecibo, setFirmaParaRecibo] = useState(venta.comprobante?.firma || null);

  useEffect(() => {
    if (!modoFirma) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
  }, [modoFirma]);

  // Si esta venta todavía no tiene su propio checklist guardado, arranca con el último
  // que el negocio dejó configurado (para no reescribir los puntos en cada venta nueva).
  useEffect(() => {
    if (venta.comprobante) return;
    (async () => {
      try {
        const cfgSnap = await getDoc(doc(db, 'negocios', negocioId, 'config', 'general'));
        const guardado = cfgSnap.data()?.checklistVenta;
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

  const generarImagen = async (dataUrlFirma) => {
    setFirmaParaRecibo(dataUrlFirma);
    // Espera al próximo frame para asegurarse de que el DOM del recibo ya está pintado con la firma nueva
    await new Promise(r => setTimeout(r, 50));
    const canvas = await html2canvas(reciboRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const link = document.createElement('a');
    link.download = `comprobante-${(venta.cliente || 'venta').replace(/\s+/g, '_')}-${venta.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const guardarYGenerar = async () => {
    if (!todoTildado) { alert('Tildá todos los puntos del checklist antes de generar el comprobante.'); return; }
    if (firmaVacia) { alert('Falta la firma del cliente.'); return; }
    setGuardando(true);
    try {
      const firma = canvasRef.current.toDataURL('image/png');
      const comprobante = {
        checklist: items,
        firma,
        fecha: serverTimestamp(),
        generadoPor: vendedorNombre || 'Vendedor',
      };
      await updateDoc(doc(db, 'negocios', negocioId, 'ventas', venta.id), { comprobante });
      // Esta versión del checklist (con lo agregado/editado) queda como la default del
      // negocio para la próxima venta.
      await setDoc(doc(db, 'negocios', negocioId, 'config', 'general'), { checklistVenta: items.map(it => it.label) }, { merge: true });
      await generarImagen(firma);
      onGuardado({ ...comprobante, fecha: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      alert('Error al guardar el comprobante. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const volverADescargar = async () => {
    setGuardando(true);
    try { await generarImagen(venta.comprobante.firma); }
    finally { setGuardando(false); }
  };

  const c = venta.comprobante;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><IconFile size={16} />Comprobante de venta</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
        </div>

        <div style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 20 }}>
          {venta.modelo}{venta.gb ? ` ${formatCapacidad(venta.gb)}` : ''} {venta.color} · {venta.cliente || 'Sin cliente'}
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
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={volverADescargar} disabled={guardando} style={{ flex: 1, background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {guardando ? 'Generando...' : <><IconDownload size={15} />Volver a descargar</>}
              </button>
              <button onClick={() => setModoFirma(true)} style={{ background: 'var(--rv-surface-alt)', color: 'var(--rv-text-mid)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Rehacer
              </button>
            </div>
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

            <button
              onClick={guardarYGenerar}
              disabled={guardando || !todoTildado || firmaVacia}
              style={{
                width: '100%', background: (!todoTildado || firmaVacia) ? 'var(--rv-surface-alt)' : 'var(--rv-accent)',
                color: (!todoTildado || firmaVacia) ? 'var(--rv-text-dim)' : '#fff',
                border: (!todoTildado || firmaVacia) ? '1px solid var(--rv-border)' : 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700,
                cursor: (guardando || !todoTildado || firmaVacia) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {guardando ? 'Guardando...' : <><IconSave size={15} />Guardar y generar comprobante</>}
            </button>
          </>
        )}
      </div>

      {/* Plantilla del recibo, fuera de pantalla — se captura con html2canvas para el PNG */}
      <div style={{ position: 'fixed', left: -9999, top: 0 }}>
        <div ref={reciboRef} style={{ width: 560, background: '#ffffff', color: '#111', fontFamily: "'Manrope', Arial, sans-serif", padding: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{negocioNombre || 'Negocio'}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Comprobante de venta</div>
          </div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>CLIENTE</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{venta.cliente || 'Sin nombre'} {venta.telefono ? `· ${venta.telefono}` : ''}</div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>EQUIPO</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{venta.modelo}{venta.gb ? ` ${formatCapacidad(venta.gb)}` : ''} {venta.color}</div>
          <div style={{ fontSize: 13, color: '#333', marginBottom: 16 }}>
            IMEI/N° de serie: {venta.imei || 'no registrado'} · Batería al momento de la venta: {venta.bateria ? `${venta.bateria}%` : 'no registrada'}
          </div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>ESTADO VERIFICADO DELANTE DEL CLIENTE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ fontSize: 13 }}>✓ {it.label}</div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>FIRMA DEL CLIENTE</div>
          {firmaParaRecibo && <img src={firmaParaRecibo} alt="firma" style={{ width: 240, border: '1px solid #ccc', borderRadius: 6, marginBottom: 20 }} />}

          <div style={{ fontSize: 11, color: '#777', lineHeight: 1.6, borderTop: '1px solid #ccc', paddingTop: 12 }}>
            Este equipo cuenta con garantía legal de 3 meses conforme a la Ley 24.240 de Defensa del Consumidor.
            La batería se considera en condiciones normales de uso mientras su capacidad de carga sea igual o mayor al 80%.
            El cliente revisó y probó el equipo en persona antes de retirarlo, según el detalle anterior.
          </div>

          <div style={{ fontSize: 10, color: '#999', marginTop: 16, textAlign: 'right' }}>
            Generado con ReventApp · {new Date().toLocaleDateString('es-AR')}
          </div>
        </div>
      </div>
    </div>
  );
}
