import { useRef, useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { db } from '../firebase/config';
import { IconFile, IconX, IconCheck, IconDownload, IconSave } from './Icons';

const ITEMS_CHECKLIST = [
  { key: 'probado', label: 'Equipo probado funcionando delante del cliente' },
  { key: 'diagnostico', label: 'Se informó el diagnóstico y la reparación realizada' },
  { key: 'garantia', label: 'Se explicó la garantía y sus condiciones' },
  { key: 'accesorios', label: 'Se entregó el equipo con todos sus accesorios' },
];

export default function ComprobanteReparacion({ reparacion, negocioId, negocioNombre, entregadoPor, onClose, onGuardado }) {
  const yaExiste = !!reparacion.comprobante;
  const [checklist, setChecklist] = useState(
    reparacion.comprobante?.checklist || Object.fromEntries(ITEMS_CHECKLIST.map(i => [i.key, false]))
  );
  const [modoFirma, setModoFirma] = useState(!yaExiste);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const [guardando, setGuardando] = useState(false);
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

  const todoTildado = ITEMS_CHECKLIST.every(i => checklist[i.key]);
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

  const generarImagen = async (dataUrlFirma) => {
    setFirmaParaRecibo(dataUrlFirma);
    await new Promise(r => setTimeout(r, 50));
    const canvas = await html2canvas(reciboRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const link = document.createElement('a');
    link.download = `comprobante-reparacion-${(reparacion.cliente || 'cliente').replace(/\s+/g, '_')}-${reparacion.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const guardarYGenerar = async () => {
    if (!todoTildado) { alert('Tildá los puntos del checklist antes de generar el comprobante.'); return; }
    if (firmaVacia) { alert('Falta la firma del cliente.'); return; }
    setGuardando(true);
    try {
      const firma = canvasRef.current.toDataURL('image/png');
      const comprobante = {
        checklist,
        firma,
        fecha: serverTimestamp(),
        generadoPor: entregadoPor || 'Vendedor',
      };
      await updateDoc(doc(db, 'negocios', negocioId, 'reparaciones', reparacion.id), { comprobante });
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
    try { await generarImagen(reparacion.comprobante.firma); }
    finally { setGuardando(false); }
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
              {ITEMS_CHECKLIST.map(i => (
                <div key={i.key} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--rv-text-mid)', alignItems: 'center' }}>
                  <IconCheck size={12} /> {i.label}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {ITEMS_CHECKLIST.map(i => (
                <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--rv-text-mid)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checklist[i.key]}
                    onChange={e => setChecklist(ch => ({ ...ch, [i.key]: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--rv-accent)' }}
                  />
                  {i.label}
                </label>
              ))}
            </div>

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
            {ITEMS_CHECKLIST.map(i => (
              <div key={i.key} style={{ fontSize: 13 }}>✓ {i.label}</div>
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
