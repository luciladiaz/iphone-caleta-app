import { useRef, useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { db } from '../firebase/config';

const ITEMS_CHECKLIST = [
  { key: 'bateria', label: 'Batería revisada delante del cliente' },
  { key: 'pantalla', label: 'Pantalla sin fisuras, táctil funciona correctamente' },
  { key: 'camaras', label: 'Cámaras (foto y video) probadas' },
  { key: 'botones', label: 'Botones de volumen y encendido funcionan' },
  { key: 'carga', label: 'Carga y conexión (WiFi/datos) probadas' },
  { key: 'faceId', label: 'Face ID / Touch ID funciona' },
];

export default function ComprobanteVenta({ venta, negocioId, negocioNombre, vendedorNombre, onClose, onGuardado }) {
  const yaExiste = !!venta.comprobante;
  const [checklist, setChecklist] = useState(
    venta.comprobante?.checklist || Object.fromEntries(ITEMS_CHECKLIST.map(i => [i.key, false]))
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
    if (!todoTildado) { alert('Tildá los 6 puntos del checklist antes de generar el comprobante.'); return; }
    if (firmaVacia) { alert('Falta la firma del cliente.'); return; }
    setGuardando(true);
    try {
      const firma = canvasRef.current.toDataURL('image/png');
      const comprobante = {
        checklist,
        firma,
        fecha: serverTimestamp(),
        generadoPor: vendedorNombre || 'Vendedor',
      };
      await updateDoc(doc(db, 'negocios', negocioId, 'ventas', venta.id), { comprobante });
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
      <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>📄 Comprobante de venta</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ color: '#86868b', fontSize: 13, marginBottom: 20 }}>
          {venta.modelo} {venta.gb}GB {venta.color} · {venta.cliente || 'Sin cliente'}
        </div>

        {!modoFirma && c ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {ITEMS_CHECKLIST.map(i => (
                <div key={i.key} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#ebebf5cc' }}>
                  <span style={{ color: '#30d158' }}>✓</span> {i.label}
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: 10, padding: 8, marginBottom: 12 }}>
              <img src={c.firma} alt="Firma del cliente" style={{ width: '100%', display: 'block' }} />
            </div>
            <div style={{ color: '#86868b', fontSize: 12, marginBottom: 20 }}>
              Generado por {c.generadoPor}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={volverADescargar} disabled={guardando} style={{ flex: 1, background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.7 : 1 }}>
                {guardando ? 'Generando...' : '⬇️ Volver a descargar'}
              </button>
              <button onClick={() => setModoFirma(true)} style={{ background: '#2c2c2e', color: '#ff9f0a', border: '1px solid #3a3a3c', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Rehacer
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#86868b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Chequeo delante del cliente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {ITEMS_CHECKLIST.map(i => (
                <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#ebebf5cc', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checklist[i.key]}
                    onChange={e => setChecklist(ch => ({ ...ch, [i.key]: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: '#2563EB' }}
                  />
                  {i.label}
                </label>
              ))}
            </div>

            <div style={{ color: '#86868b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Firma del cliente al retirar
            </div>
            <div style={{ background: '#fff', borderRadius: 10, marginBottom: 8, touchAction: 'none' }}>
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
            <button onClick={borrarFirma} style={{ background: 'none', border: 'none', color: '#86868b', fontSize: 12, cursor: 'pointer', marginBottom: 20 }}>
              Borrar y firmar de nuevo
            </button>

            <button
              onClick={guardarYGenerar}
              disabled={guardando || !todoTildado || firmaVacia}
              style={{
                width: '100%', background: (!todoTildado || firmaVacia) ? '#2c2c2e' : '#2563EB',
                color: (!todoTildado || firmaVacia) ? '#86868b' : '#fff',
                border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700,
                cursor: (guardando || !todoTildado || firmaVacia) ? 'not-allowed' : 'pointer',
              }}
            >
              {guardando ? 'Guardando...' : '💾 Guardar y generar comprobante'}
            </button>
          </>
        )}
      </div>

      {/* Plantilla del recibo, fuera de pantalla — se captura con html2canvas para el PNG */}
      <div style={{ position: 'fixed', left: -9999, top: 0 }}>
        <div ref={reciboRef} style={{ width: 560, background: '#ffffff', color: '#111', fontFamily: "'Inter', Arial, sans-serif", padding: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{negocioNombre || 'Negocio'}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Comprobante de venta</div>
          </div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>CLIENTE</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{venta.cliente || 'Sin nombre'} {venta.telefono ? `· ${venta.telefono}` : ''}</div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>EQUIPO</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{venta.modelo} {venta.gb}GB {venta.color}</div>
          <div style={{ fontSize: 13, color: '#333', marginBottom: 16 }}>
            IMEI: {venta.imei || 'no registrado'} · Batería al momento de la venta: {venta.bateria ? `${venta.bateria}%` : 'no registrada'}
          </div>

          <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>ESTADO VERIFICADO DELANTE DEL CLIENTE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
            {ITEMS_CHECKLIST.map(i => (
              <div key={i.key} style={{ fontSize: 13 }}>✓ {i.label}</div>
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
