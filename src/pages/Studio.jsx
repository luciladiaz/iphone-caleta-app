import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

const B = {
  navy:  '#080F28',
  slate: '#1E293B',
  deep:  '#1A3A8F',
  blue:  '#2563EB',
  sky:   '#7DD3FC',
  white: '#FFFFFF',
  gray:  '#94A3B8',
  green: '#10B981',
};

// ── Logo mark (CSS-only, no image needed) ─────────────────────────────────
function LogoMark({ iconSize = 28, showText = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(iconSize * 0.28), flexShrink: 0 }}>
      <div style={{
        width: iconSize, height: iconSize, borderRadius: Math.round(iconSize * 0.22),
        background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', fontWeight: 900,
        fontSize: Math.round(iconSize * 0.52), color: '#fff', letterSpacing: '-1px',
      }}>R</div>
      {showText && (
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: Math.round(iconSize * 0.5), lineHeight: 1 }}>
          <span style={{ color: '#fff' }}>Revent</span>
          <span style={{ color: B.sky }}>App</span>
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FEED  (540 × 540 preview — exporta 1080 × 1080 con scale 2)
// ═══════════════════════════════════════════════════════════════════════════

function FeedPain({ titulo, subtitulo, handle }) {
  return (
    <div style={{ width: 540, height: 540, background: B.navy, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -100, right: -100, width: 380, height: 380, borderRadius: '50%', border: '1px solid rgba(37,99,235,0.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -48, right: -48, width: 220, height: 220, borderRadius: '50%', border: '1px solid rgba(37,99,235,0.18)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 70, left: -60, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, top: 80, width: 5, height: 110, background: `linear-gradient(180deg, ${B.blue}, transparent)`, borderRadius: '0 4px 4px 0' }} />

      <div style={{ flex: 1, padding: '52px 52px 20px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: B.sky, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 20 }}>REVENDEDOR DE iPHONE</div>
        <div style={{ fontSize: 46, fontWeight: 900, color: B.white, lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 22, whiteSpace: 'pre-line' }}>{titulo}</div>
        <div style={{ fontSize: 16, color: B.gray, lineHeight: 1.65, maxWidth: 380 }}>{subtitulo}</div>
      </div>

      <div style={{ background: B.slate, padding: '15px 52px 15px 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoMark iconSize={28} />
        <span style={{ fontSize: 12, color: B.gray, fontWeight: 600 }}>{handle}</span>
      </div>
    </div>
  );
}

function FeedFeature({ tag, titulo, subtitulo, feature1, feature2, feature3 }) {
  return (
    <div style={{ width: 540, height: 540, background: `linear-gradient(148deg, ${B.navy} 0%, ${B.deep} 100%)`, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: -120, right: -120, width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.16) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '44px 48px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(37,99,235,0.35)', borderRadius: 99, padding: '5px 14px', marginBottom: 24, width: 'fit-content' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: B.sky, letterSpacing: '2.5px', textTransform: 'uppercase' }}>{tag}</span>
        </div>
        <div style={{ fontSize: 46, fontWeight: 900, color: B.white, lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 14, whiteSpace: 'pre-line' }}>{titulo}</div>
        <div style={{ fontSize: 15, color: B.gray, lineHeight: 1.65, marginBottom: 28 }}>{subtitulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[feature1, feature2, feature3].filter(Boolean).map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: B.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>
              </div>
              <span style={{ fontSize: 14, color: B.white, fontWeight: 500, lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '13px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(37,99,235,0.2)' }}>
        <LogoMark iconSize={26} />
        <span style={{ fontSize: 13, fontWeight: 700, color: B.sky }}>reventapp.com.ar →</span>
      </div>
    </div>
  );
}

function FeedTip({ numero, titulo, tip1, tip2, tip3 }) {
  return (
    <div style={{ width: 540, height: 540, background: B.slate, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden', borderLeft: `6px solid ${B.blue}` }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '40px 44px 20px 44px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: B.sky, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>💡 TIP #{numero} PARA REVENDEDORES</div>
        <div style={{ fontSize: 34, fontWeight: 900, color: B.white, lineHeight: 1.15, letterSpacing: '-1px', marginBottom: 28 }}>{titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[tip1, tip2, tip3].filter(Boolean).map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: B.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 13, color: '#fff' }}>{i + 1}</div>
              <span style={{ fontSize: 14, color: B.white, lineHeight: 1.55 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '13px 44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(37,99,235,0.15)' }}>
        <LogoMark iconSize={24} />
        <span style={{ fontSize: 11, color: B.gray, fontWeight: 600, letterSpacing: 1 }}>@reventapp.iphone</span>
      </div>
    </div>
  );
}

function FeedSocial({ numero, titulo, subtitulo, ciudades }) {
  return (
    <div style={{ width: 540, height: 540, background: B.navy, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)', width: 460, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.09) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '40px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: B.blue, letterSpacing: 6, marginBottom: 20 }}>★★★★★</div>
        <div style={{ fontSize: 96, fontWeight: 900, color: B.blue, lineHeight: 1, letterSpacing: '-4px', marginBottom: 6 }}>{numero}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: B.white, lineHeight: 1.2, marginBottom: 6, letterSpacing: '-1px' }}>{titulo}</div>
        <div style={{ fontSize: 15, color: B.gray, marginBottom: 30 }}>{subtitulo}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {ciudades.split(',').map(c => c.trim()).filter(Boolean).map(ciudad => (
            <span key={ciudad} style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.28)', color: B.gray, borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 600 }}>{ciudad}</span>
          ))}
        </div>
      </div>

      <div style={{ background: B.slate, padding: '14px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoMark iconSize={26} />
        <span style={{ fontSize: 11, color: B.gray, fontWeight: 600, letterSpacing: 1 }}>@reventapp.iphone</span>
      </div>
    </div>
  );
}

function FeedCTA({ tag, titulo, subtitulo, precio, url }) {
  return (
    <div style={{ width: 540, height: 540, background: `linear-gradient(138deg, ${B.deep} 0%, ${B.blue} 100%)`, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: -80, right: -80, width: 340, height: 340, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -36, right: -36, width: 190, height: 190, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(0,0,0,0.1)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '52px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '7px 18px', marginBottom: 28, width: 'fit-content' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '2.5px', textTransform: 'uppercase' }}>{tag}</span>
        </div>
        <div style={{ fontSize: 80, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-5px', marginBottom: 6 }}>{titulo}</div>
        <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.75)', marginBottom: 32, fontWeight: 700 }}>{subtitulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{precio}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{url}</span>
            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>→</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 52px', display: 'flex', justifyContent: 'flex-end' }}>
        <LogoMark iconSize={26} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FEED EXTRA — Presentación, Antes/Después, Testimonio, Dato, Pasos
// ═══════════════════════════════════════════════════════════════════════════

function FeedIntro({ tagline, titulo, subtitulo, pill1, pill2, pill3, handle }) {
  return (
    <div style={{ width: 540, height: 540, background: B.navy, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(37,99,235,0.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 70, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 52px 20px' }}>
        <div style={{ width: 70, height: 70, borderRadius: 16, background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: '#fff', fontFamily: 'Inter, sans-serif', letterSpacing: '-2px' }}>R</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: B.sky, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>{tagline}</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: B.white, lineHeight: 1.1, letterSpacing: '-2px', marginBottom: 12, textAlign: 'center', whiteSpace: 'pre-line' }}>{titulo}</div>
        <div style={{ fontSize: 15, color: B.gray, lineHeight: 1.6, textAlign: 'center', marginBottom: 28, maxWidth: 360 }}>{subtitulo}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[pill1, pill2, pill3].filter(Boolean).map(p => (
            <span key={p} style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', color: B.sky, borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>{p}</span>
          ))}
        </div>
      </div>

      <div style={{ background: B.slate, padding: '15px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoMark iconSize={28} />
        <span style={{ fontSize: 12, color: B.gray, fontWeight: 600 }}>{handle}</span>
      </div>
    </div>
  );
}

function FeedAntesDespues({ titulo, antes1, antes2, antes3, despues1, despues2, despues3 }) {
  return (
    <div style={{ width: 540, height: 540, background: B.navy, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <div style={{ background: B.slate, padding: '18px 40px', textAlign: 'center', borderBottom: `2px solid ${B.blue}` }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: B.white, letterSpacing: '-0.5px' }}>{titulo}</div>
      </div>
      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ flex: 1, background: '#070e1f', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: `3px solid ${B.blue}` }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#f87171', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 16 }}>SIN REVENTAPP</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[antes1, antes2, antes3].filter(Boolean).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#f87171', fontWeight: 800, marginTop: 1 }}>×</div>
                <span style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, background: `linear-gradient(145deg, ${B.deep} 0%, #1a4db0 100%)`, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: B.green, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 16 }}>CON REVENTAPP</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[despues1, despues2, despues3].filter(Boolean).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: B.green, fontWeight: 800, marginTop: 1 }}>✓</div>
                <span style={{ fontSize: 13, color: B.white, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: B.slate, padding: '13px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoMark iconSize={24} />
        <span style={{ fontSize: 11, color: B.gray, fontWeight: 600, letterSpacing: 1 }}>@reventapp.iphone</span>
      </div>
    </div>
  );
}

function FeedTestimonio({ cita, nombre, ciudad }) {
  return (
    <div style={{ width: 540, height: 540, background: B.navy, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, left: -60, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 60, right: -40, width: 180, height: 180, borderRadius: '50%', border: '1px solid rgba(37,99,235,0.1)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '36px 52px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 70, fontWeight: 900, color: B.blue, lineHeight: 0.9, marginBottom: 14, opacity: 0.65 }}>"</div>
        <div style={{ fontSize: 15, color: B.blue, letterSpacing: 4, marginBottom: 18 }}>★★★★★</div>
        <div style={{ fontSize: 21, fontWeight: 700, color: B.white, lineHeight: 1.55, letterSpacing: '-0.5px', marginBottom: 28, whiteSpace: 'pre-line' }}>{cita}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${B.deep}, ${B.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
            {(nombre || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: B.white }}>{nombre}</div>
            <div style={{ fontSize: 12, color: B.gray }}>{ciudad}</div>
          </div>
        </div>
      </div>

      <div style={{ background: B.slate, padding: '14px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoMark iconSize={26} />
        <span style={{ fontSize: 11, color: B.gray, fontWeight: 600, letterSpacing: 1 }}>@reventapp.iphone</span>
      </div>
    </div>
  );
}

function FeedDato({ label, numero, unidad, contexto, cta }) {
  return (
    <div style={{ width: 540, height: 540, background: B.navy, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 460, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '48px 52px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: B.sky, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 16 }}>{label}</div>
        <div style={{ fontSize: 80, fontWeight: 900, color: B.blue, lineHeight: 1, letterSpacing: '-3px', marginBottom: 4 }}>{numero}</div>
        {unidad && <div style={{ fontSize: 20, fontWeight: 800, color: B.white, marginBottom: 16, letterSpacing: '-0.5px', lineHeight: 1.25, whiteSpace: 'pre-line' }}>{unidad}</div>}
        <div style={{ fontSize: 15, color: B.gray, lineHeight: 1.65, marginBottom: 28, maxWidth: 380 }}>{contexto}</div>
        <div style={{ display: 'inline-flex', background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 99, padding: '7px 18px', width: 'fit-content' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: B.sky }}>{cta}</span>
        </div>
      </div>

      <div style={{ background: B.slate, padding: '14px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoMark iconSize={26} />
        <span style={{ fontSize: 11, color: B.gray, fontWeight: 600, letterSpacing: 1 }}>@reventapp.iphone</span>
      </div>
    </div>
  );
}

function FeedPasos({ titulo, subtitulo, paso1, paso2, paso3, cta }) {
  const pasos = [paso1, paso2, paso3].filter(Boolean);
  return (
    <div style={{ width: 540, height: 540, background: B.slate, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '36px 48px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: B.sky, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>GUÍA RÁPIDA</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: B.white, lineHeight: 1.2, letterSpacing: '-1px', marginBottom: subtitulo ? 6 : 24 }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 14, color: B.gray, marginBottom: 24, lineHeight: 1.5 }}>{subtitulo}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          {pasos.map((paso, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: B.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff' }}>{i + 1}</div>
                {i < pasos.length - 1 && <div style={{ width: 2, height: 28, background: 'rgba(37,99,235,0.3)', margin: '4px 0' }} />}
              </div>
              <div style={{ paddingBottom: i < pasos.length - 1 ? 28 : 0, paddingTop: 6 }}>
                <div style={{ fontSize: 15, color: B.white, fontWeight: 600, lineHeight: 1.5 }}>{paso}</div>
              </div>
            </div>
          ))}
        </div>

        {cta && (
          <div style={{ display: 'inline-flex', background: B.blue, borderRadius: 99, padding: '9px 22px', marginTop: 16, width: 'fit-content' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{cta} →</span>
          </div>
        )}
      </div>

      <div style={{ padding: '13px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(37,99,235,0.15)' }}>
        <LogoMark iconSize={24} />
        <span style={{ fontSize: 11, color: B.gray, fontWeight: 600, letterSpacing: 1 }}>@reventapp.iphone</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORIAS  (405 × 720 preview — exporta 1080 × 1920 con scale 2.666)
// ═══════════════════════════════════════════════════════════════════════════

function StoryHook({ tag, titulo, subtitulo, handle }) {
  return (
    <div style={{ width: 405, height: 720, background: B.navy, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -100, right: -100, width: 360, height: 360, borderRadius: '50%', border: '1px solid rgba(37,99,235,0.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 100, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, top: 160, width: 5, height: 90, background: `linear-gradient(180deg, ${B.blue}, transparent)`, borderRadius: '0 4px 4px 0' }} />

      <div style={{ padding: '44px 36px 0', display: 'flex', justifyContent: 'center' }}>
        <LogoMark iconSize={30} />
      </div>

      <div style={{ flex: 1, padding: '0 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: B.sky, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 18, textAlign: 'center' }}>{tag}</div>
        <div style={{ fontSize: 50, fontWeight: 900, color: B.white, lineHeight: 1.06, letterSpacing: '-3px', marginBottom: 18, textAlign: 'center', whiteSpace: 'pre-line' }}>{titulo}</div>
        <div style={{ fontSize: 17, color: B.gray, lineHeight: 1.6, textAlign: 'center' }}>{subtitulo}</div>
      </div>

      <div style={{ padding: '0 36px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: B.gray }}>{handle}</span>
        <div style={{ width: 36, height: 4, background: B.white, borderRadius: 2, opacity: 0.25 }} />
      </div>
    </div>
  );
}

function StoryFeature({ tag, titulo, subtitulo, url, handle }) {
  return (
    <div style={{ width: 405, height: 720, background: `linear-gradient(160deg, ${B.navy} 0%, ${B.deep} 100%)`, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: -80, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ padding: '44px 36px 0', display: 'flex', justifyContent: 'center' }}>
        <LogoMark iconSize={30} />
      </div>

      <div style={{ flex: 1, padding: '0 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(37,99,235,0.35)', borderRadius: 99, padding: '5px 14px', marginBottom: 20, width: 'fit-content', alignSelf: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: B.sky, letterSpacing: '2.5px', textTransform: 'uppercase' }}>{tag}</span>
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, color: B.white, lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 16, textAlign: 'center', whiteSpace: 'pre-line' }}>{titulo}</div>
        <div style={{ fontSize: 16, color: B.gray, lineHeight: 1.65, textAlign: 'center', marginBottom: 32 }}>{subtitulo}</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: B.blue, borderRadius: 99, padding: '12px 28px' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{url} →</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 36px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: B.gray }}>{handle}</span>
        <div style={{ width: 36, height: 4, background: B.white, borderRadius: 2, opacity: 0.25 }} />
      </div>
    </div>
  );
}

function StoryCTA({ tag, titulo, subtitulo, precio, url, handle }) {
  return (
    <div style={{ width: 405, height: 720, background: `linear-gradient(165deg, ${B.deep} 0%, ${B.blue} 100%)`, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(0,0,0,0.08)', pointerEvents: 'none' }} />

      <div style={{ padding: '44px 36px 0', display: 'flex', justifyContent: 'center' }}>
        <LogoMark iconSize={30} />
      </div>

      <div style={{ flex: 1, padding: '0 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '7px 18px', marginBottom: 24 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '2.5px', textTransform: 'uppercase' }}>{tag}</span>
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-5px', marginBottom: 8, whiteSpace: 'pre-line' }}>{titulo}</div>
        <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', marginBottom: 10, lineHeight: 1.6, fontWeight: 500, whiteSpace: 'pre-line' }}>{subtitulo}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>{precio}</div>
        <div style={{ background: '#fff', borderRadius: 99, padding: '15px 36px' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: B.deep }}>{url} →</span>
        </div>
      </div>

      <div style={{ padding: '0 36px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{handle}</span>
        <div style={{ width: 36, height: 4, background: B.white, borderRadius: 2, opacity: 0.25 }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// META ADS  (600 × 314 preview — exporta 1200 × 628 con scale 2)
// ═══════════════════════════════════════════════════════════════════════════

function AdSplit({ problema, solucion, cta, precio }) {
  return (
    <div style={{ width: 600, height: 314, background: B.navy, display: 'flex', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <div style={{ width: '45%', background: B.slate, padding: '28px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: `4px solid ${B.blue}` }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#f87171', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 10 }}>EL PROBLEMA</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: B.white, lineHeight: 1.3, letterSpacing: '-0.5px' }}>{problema}</div>
        </div>
        <div style={{ fontSize: 11, color: B.gray }}>¿Te pasa esto?</div>
      </div>

      <div style={{ flex: 1, padding: '28px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: B.green, letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 10 }}>LA SOLUCIÓN</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: B.white, lineHeight: 1.3, marginBottom: 8, letterSpacing: '-0.5px' }}>{solucion}</div>
          <div style={{ fontSize: 11, color: B.gray, lineHeight: 1.5 }}>{precio}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ background: B.blue, borderRadius: 8, padding: '8px 18px' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{cta} →</span>
          </div>
          <LogoMark iconSize={22} />
        </div>
      </div>
    </div>
  );
}

function AdPricing({ headline, feature1, feature2, feature3, precio, cta }) {
  return (
    <div style={{ width: 600, height: 314, background: `linear-gradient(135deg, ${B.deep} 0%, ${B.blue} 100%)`, display: 'flex', fontFamily: 'Inter, sans-serif', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', bottom: -60, right: 160, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2, letterSpacing: '-1px', marginBottom: 18 }}>{headline}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[feature1, feature2, feature3].filter(Boolean).map((f, i) => (
              <div key={i} style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{f}</div>
            ))}
          </div>
        </div>
        <LogoMark iconSize={24} />
      </div>

      <div style={{ width: 190, background: 'rgba(255,255,255,0.1)', borderLeft: '1px solid rgba(255,255,255,0.15)', padding: '28px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Precio</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}>{precio}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>7 días de prueba gratis</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '10px 18px', width: '100%' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: B.deep }}>{cta} →</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPTIONS — texto + hashtags para Instagram, uno por template
// ═══════════════════════════════════════════════════════════════════════════

const CAPTIONS = {
  'feed-pain': `📊 ¿Cuánto ganaste exactamente este mes con tus iPhones?

Si la respuesta es "más o menos" o "creo que bien"... hay un problema. 🚨

✅ ReventApp te da el número exacto: ganancia por equipo, en pesos y en dólares, con el tipo de cambio del día.

🎯 Probalo 7 días gratis, sin tarjeta → reventapp.com.ar

.
.
.
#revendedoriphone #iphoneargentina #reventacelulares #stockiphone #negociodecelulares #celularesargentina #emprendedorargentino #reventapp #gestiondestock #pymes #iphone #argentina #vendedordecelulares #celularesusados #emprendimiento #iphone15 #revendedoresargentina`,

  'feed-feature': `📦 Cargá tu stock en minutos. Buscalo en segundos.

✅ Modelo, GB, color, batería e IMEI
✅ Todo en un solo lugar desde el celular
✅ Buscá el equipo antes de que el cliente pregunte

⚡ Cuando el cliente pregunta si tenés el equipo, vos ya sabés la respuesta.

📲 Empezá gratis → reventapp.com.ar

.
.
.
#stockiphone #gestiondestock #revendedoriphone #iphoneargentina #reventacelulares #celularesargentina #negociodecelulares #reventapp #emprendedorargentino #pymes #iphone15 #iphone14 #inventariocelulares #sistemaventas #controldestock`,

  'feed-tip': `3 errores que le hacen perder plata a todo revendedor de iPhone 👇

❌ No llevar los costos en USD → el tipo de cambio te come la ganancia
❌ No controlar cobros en cuotas → un cliente que no paga es plata perdida
❌ No tener catálogo actualizado → el cliente compra donde encuentra precio rápido

💾 Guardá este post y compartilo con alguien que lo necesite.

✅ ReventApp te ayuda a evitar los tres → reventapp.com.ar

.
.
.
#revendedoriphone #tipsventas #negociodecelulares #iphoneargentina #reventacelulares #celularesargentina #erroresemprendedor #emprendedorargentino #reventapp #pymes #consejosventas #iphone #gestiondestock #stockiphone #revendedordecelulares #negocioargentino`,

  'feed-social': `🏆 Más de 200 revendedores en Argentina ya usan ReventApp.

📍 CABA · Córdoba · Rosario · Mendoza · Mar del Plata y creciendo

No es casualidad. Es que cuando empezás a llevar los números en serio, no podés volver a la libreta. 📒 ➡️ 📱

🚀 ¿Cuándo te sumás? → reventapp.com.ar

.
.
.
#revendedoriphone #iphoneargentina #reventacelulares #celularesargentina #reventapp #negociodecelulares #comunidadrevendedores #iphone #argentina #emprendedorargentino #pymes #sistemaventas #stockiphone #gestiondestock #revendedoresargentina`,

  'feed-cta': `🎯 7 días gratis. Sin tarjeta. Sin compromisos.

La única excusa que te quedaba para no tener todo organizado era el precio.

La sacamos. ✅

🚀 Empezá hoy → reventapp.com.ar
💰 Desde $7.900/mes después. Cancelás cuando quieras.

.
.
.
#reventapp #revendedoriphone #iphoneargentina #probalogratis #reventacelulares #negociodecelulares #celularesargentina #emprendedorargentino #pymes #sistemaventas #gestiondestock #stockiphone #iphone #argentina #negociodigital #emprendimiento`,

  'feed-intro': `👋 Somos ReventApp.

La primera app diseñada específicamente para revendedores de iPhone en Argentina. 🇦🇷 📱

📦 Stock · 💰 Ventas · 💳 Cobros · 📊 Ganancias
Todo desde el celular, en tiempo real.

Si revendés iPhones, seguinos 👉 Acá vas a encontrar tips, datos del mercado y todo lo que necesitás para llevar tu negocio en serio. 💪

→ reventapp.com.ar

.
.
.
#reventapp #revendedoriphone #iphoneargentina #reventacelulares #stockiphone #negociodecelulares #celularesargentina #emprendedorargentino #iphone #argentina #pymes #sistemaventas #gestiondestock #negociodigital #emprendimiento #revendedordecelulares`,

  'feed-antesdespues': `¿Qué cambia cuando empezás a usar ReventApp? Esto 👇

❌ SIN REVENTAPP
• No sabés exactamente cuánto tenés en stock
• Perdés cobros en cuotas sin registrar
• Las ganancias son un misterio 😵

✅ CON REVENTAPP
• Stock actualizado en tiempo real 📦
• Todos los cobros controlados con alerta 💳
• Ganancia exacta en pesos y dólares 💰

El revendedor que conoce sus números siempre toma mejores decisiones. 📊

🎯 Probalo 7 días sin tarjeta → reventapp.com.ar

.
.
.
#revendedoriphone #antesydespues #iphoneargentina #reventacelulares #gestiondestock #stockiphone #negociodecelulares #celularesargentina #reventapp #emprendedorargentino #pymes #sistemaventas #organizarnegocio #iphone #emprendimiento #revendedoresargentina`,

  'feed-testimonio': `💬 "Antes perdía plata y no sabía por qué. Ahora sé exactamente cuánto gané en el mes."

⭐⭐⭐⭐⭐

Esto es lo que pasa cuando empezás a llevar los números en serio. 📊

¿Querés el mismo resultado?
🎯 Probá ReventApp 7 días gratis, sin tarjeta → reventapp.com.ar

.
.
.
#revendedoriphone #testimonios #iphoneargentina #reventacelulares #resultados #negociodecelulares #celularesargentina #reventapp #emprendedorargentino #pymes #gestiondestock #stockiphone #iphone #argentina #emprendimiento #reventadigital #revendedoresargentina`,

  'feed-dato': `📊 7 de cada 10 revendedores no controla sus costos en dólares.

🚨 ¿El resultado? No saben si realmente están ganando o perdiendo plata en cada venta.

💡 Con el tipo de cambio de Argentina, esta diferencia puede ser enorme.

✅ ReventApp registra cada compra en USD y cada venta en ARS, con el tipo de cambio del día. Automáticamente.

👉 reventapp.com.ar

.
.
.
#revendedoriphone #datosdemercado #iphoneargentina #reventacelulares #celularesargentina #tipodecambio #dolaresypesos #negociodecelulares #reventapp #emprendedorargentino #pymes #gestiondestock #stockiphone #iphone #argentina #multimoneda`,

  'feed-pasos': `¿Querés organizar tu negocio de reventa de iPhones? 3 pasos, 0 complicaciones 👇

1️⃣ Cargá tu stock: modelo, GB, color y precio de compra 📦
2️⃣ Registrá cada venta con el método de pago 💳
3️⃣ Controlá los cobros y mirá cuánto ganaste 📊

Sin planillas. Sin papeles. Todo desde el celular. 📱

🚀 Empezá gratis → reventapp.com.ar

.
.
.
#revendedoriphone #guiapasoapaso #iphoneargentina #reventacelulares #negociodecelulares #celularesargentina #reventapp #emprendedorargentino #pymes #sistemaventas #gestiondestock #stockiphone #iphone #argentina #emprendimiento #organizartunegocio`,

  'story-hook': `📱 ¿Llevás el stock en una libreta?

Hay una mejor forma. Y es más fácil de lo que pensás. 💡

👉 reventapp.com.ar

.
.
.
#revendedoriphone #iphoneargentina #reventacelulares #stockiphone #negociodecelulares #celularesargentina #reventapp #emprendedorargentino #pymes #iphone #argentina #gestiondestock`,

  'story-feature': `📲 Compartí tu catálogo de iPhones por WhatsApp en un toque.

✅ Un link, todos tus equipos disponibles
✅ Actualizado en tiempo real
✅ El cliente ve precio y disponibilidad al instante ⚡

👉 reventapp.com.ar

.
.
.
#catalogoiphone #revendedoriphone #iphoneargentina #reventacelulares #celularesargentina #reventapp #emprendedorargentino #stockiphone #iphone #argentina #whatsappnegocios`,

  'story-cta': `🎯 7 días gratis. Sin tarjeta.

✅ Stock en tiempo real 📦
✅ Cobros controlados 💳
✅ Ganancias exactas en $ y USD 💰

🚀 Probá ReventApp → reventapp.com.ar

.
.
.
#reventapp #revendedoriphone #iphoneargentina #probalogratis #reventacelulares #negociodecelulares #celularesargentina #emprendedorargentino #pymes #iphone #argentina`,

  'ad-split': `🚨 ¿Te pasa esto? ReventApp lo soluciona.

📦 Stock, ventas y cobros en tiempo real desde el celular.

🎯 Probalo 7 días gratis → reventapp.com.ar

#reventapp #revendedoriphone #iphoneargentina #reventacelulares #stockiphone #negociodecelulares #celularesargentina #emprendedorargentino`,

  'ad-pricing': `✅ Probá ReventApp 7 días gratis. Sin tarjeta.

📦 Stock · 💰 Ventas · 💳 Cobros · 📊 Ganancias

🚀 Desde $7.900/mes → reventapp.com.ar

#reventapp #revendedoriphone #iphoneargentina #reventacelulares #stockiphone #negociodecelulares`,
};

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRO DE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

const TEMPLATES = {
  feed: [
    {
      id: 'feed-pain', nombre: 'Pain Point', desc: 'Pregunta que genera identificación.',
      component: FeedPain, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        titulo: '¿Cuánto ganaste\neste mes con\ntus iPhones?',
        subtitulo: 'Si no sabés el número exacto, necesitás ReventApp.',
        handle: '@reventapp.iphone',
      },
      campos: [
        { key: 'titulo', label: 'Pregunta (usá \\n para saltos)', multiline: true, rows: 4 },
        { key: 'subtitulo', label: 'Frase de gancho' },
        { key: 'handle', label: 'Handle Instagram' },
      ],
    },
    {
      id: 'feed-feature', nombre: 'Feature Highlight', desc: 'Una función específica con 3 puntos.',
      component: FeedFeature, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        tag: 'NUEVA FUNCIÓN',
        titulo: 'Cargá tu stock\nen minutos.',
        subtitulo: 'Modelo, GB, color, batería e IMEI. Buscalo antes de que el cliente pregunte.',
        feature1: 'Búsqueda instantánea por cualquier campo',
        feature2: 'Alerta de stock bajo automática',
        feature3: 'Historial de cambios por equipo',
      },
      campos: [
        { key: 'tag', label: 'Etiqueta' },
        { key: 'titulo', label: 'Título (\\n para salto)', multiline: true, rows: 2 },
        { key: 'subtitulo', label: 'Bajada' },
        { key: 'feature1', label: 'Punto 1' },
        { key: 'feature2', label: 'Punto 2' },
        { key: 'feature3', label: 'Punto 3' },
      ],
    },
    {
      id: 'feed-tip', nombre: 'Tip Educativo', desc: 'Posicionarte como experto con tips.',
      component: FeedTip, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        numero: '1',
        titulo: '3 errores que te hacen perder plata como revendedor',
        tip1: 'No llevar los costos en dólares. El tipo de cambio te come la ganancia.',
        tip2: 'No hacer seguimiento de cobros en cuotas. Un cliente que no paga es plata perdida.',
        tip3: 'No tener catálogo actualizado. El cliente compra donde encuentra precio rápido.',
      },
      campos: [
        { key: 'numero', label: 'N° de tip' },
        { key: 'titulo', label: 'Título del tip', multiline: true, rows: 2 },
        { key: 'tip1', label: 'Tip 1', multiline: true, rows: 2 },
        { key: 'tip2', label: 'Tip 2', multiline: true, rows: 2 },
        { key: 'tip3', label: 'Tip 3', multiline: true, rows: 2 },
      ],
    },
    {
      id: 'feed-social', nombre: 'Prueba Social', desc: 'Mostrá la comunidad de ReventApp.',
      component: FeedSocial, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        numero: '+200',
        titulo: 'revendedores en Argentina',
        subtitulo: 'ya gestionan su negocio con ReventApp',
        ciudades: 'CABA, Córdoba, Rosario, Mendoza, Mar del Plata',
      },
      campos: [
        { key: 'numero', label: 'Número grande' },
        { key: 'titulo', label: 'Título' },
        { key: 'subtitulo', label: 'Bajada' },
        { key: 'ciudades', label: 'Ciudades (separadas por coma)' },
      ],
    },
    {
      id: 'feed-cta', nombre: 'CTA / Oferta', desc: 'Call-to-action directo con la prueba gratis.',
      component: FeedCTA, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        tag: 'PROBALO GRATIS',
        titulo: '7 días',
        subtitulo: 'sin tarjeta de crédito',
        precio: 'Después, desde $7.900/mes. Cancelá cuando quieras.',
        url: 'reventapp.com.ar',
      },
      campos: [
        { key: 'tag', label: 'Etiqueta pill' },
        { key: 'titulo', label: 'Número/oferta grande' },
        { key: 'subtitulo', label: 'Complemento' },
        { key: 'precio', label: 'Texto de precio' },
        { key: 'url', label: 'URL' },
      ],
    },
    {
      id: 'feed-intro', nombre: 'Presentación · Día 1', desc: 'Post de introducción. Ideal para el primer post.',
      component: FeedIntro, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        tagline: 'PARA REVENDEDORES DE iPHONE',
        titulo: 'Somos\nReventApp.',
        subtitulo: 'La app que te ayuda a controlar tu stock, ventas y cobros desde el celular.',
        pill1: 'Stock', pill2: 'Ventas', pill3: 'Cobros',
        handle: '@reventapp.iphone',
      },
      campos: [
        { key: 'tagline', label: 'Etiqueta superior' },
        { key: 'titulo', label: 'Título (\\n para salto)', multiline: true, rows: 2 },
        { key: 'subtitulo', label: 'Descripción' },
        { key: 'pill1', label: 'Chip 1' },
        { key: 'pill2', label: 'Chip 2' },
        { key: 'pill3', label: 'Chip 3' },
        { key: 'handle', label: 'Handle' },
      ],
    },
    {
      id: 'feed-antesdespues', nombre: 'Antes / Después', desc: 'Sin vs Con ReventApp. Muy efectivo para conversión.',
      component: FeedAntesDespues, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        titulo: '¿Qué cambia cuando usás ReventApp?',
        antes1: 'No sabés exactamente cuánto stock tenés',
        antes2: 'Perdés cobros en cuotas sin registrar',
        antes3: 'Calculás las ganancias a ojo',
        despues1: 'Stock actualizado en tiempo real',
        despues2: 'Todos los cobros controlados con alerta',
        despues3: 'Ganancia exacta en pesos y dólares',
      },
      campos: [
        { key: 'titulo', label: 'Título central', multiline: true, rows: 2 },
        { key: 'antes1', label: 'Sin ReventApp 1' },
        { key: 'antes2', label: 'Sin ReventApp 2' },
        { key: 'antes3', label: 'Sin ReventApp 3' },
        { key: 'despues1', label: 'Con ReventApp 1' },
        { key: 'despues2', label: 'Con ReventApp 2' },
        { key: 'despues3', label: 'Con ReventApp 3' },
      ],
    },
    {
      id: 'feed-testimonio', nombre: 'Testimonio', desc: 'Cita de un usuario real. Genera confianza instantánea.',
      component: FeedTestimonio, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        cita: 'Antes perdía plata y no sabía por qué. Ahora sé exactamente cuánto gané en el mes.',
        nombre: 'Martín G.',
        ciudad: 'Revendedor de iPhone · Córdoba',
      },
      campos: [
        { key: 'cita', label: 'Cita del usuario', multiline: true, rows: 4 },
        { key: 'nombre', label: 'Nombre' },
        { key: 'ciudad', label: 'Ciudad / descripción' },
      ],
    },
    {
      id: 'feed-dato', nombre: 'Dato de Mercado', desc: 'Estadística del rubro que genera impacto.',
      component: FeedDato, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        label: 'DATO DEL MERCADO',
        numero: '7 de 10',
        unidad: 'revendedores no controla\nsus costos en dólares.',
        contexto: 'Eso significa que no saben si realmente están ganando plata. El tipo de cambio hace la diferencia.',
        cta: 'ReventApp lo soluciona →',
      },
      campos: [
        { key: 'label', label: 'Etiqueta' },
        { key: 'numero', label: 'Número/stat grande' },
        { key: 'unidad', label: 'Complemento (\\n para salto)', multiline: true, rows: 2 },
        { key: 'contexto', label: 'Contexto', multiline: true, rows: 3 },
        { key: 'cta', label: 'CTA pill' },
      ],
    },
    {
      id: 'feed-pasos', nombre: 'Paso a Paso', desc: 'Guía de 3 pasos. Educa y acerca a la prueba.',
      component: FeedPasos, exportW: 1080, exportH: 1080, previewW: 540, previewH: 540,
      defaults: {
        titulo: 'Organizá tu negocio en 3 pasos.',
        subtitulo: 'Sin complicaciones. Desde el celular.',
        paso1: 'Cargá tu stock: modelo, GB, color y precio de compra.',
        paso2: 'Registrá cada venta con el método de pago.',
        paso3: 'Controlá los cobros y mirá cuánto ganaste.',
        cta: 'Empezar gratis',
      },
      campos: [
        { key: 'titulo', label: 'Título', multiline: true, rows: 2 },
        { key: 'subtitulo', label: 'Bajada' },
        { key: 'paso1', label: 'Paso 1', multiline: true, rows: 2 },
        { key: 'paso2', label: 'Paso 2', multiline: true, rows: 2 },
        { key: 'paso3', label: 'Paso 3', multiline: true, rows: 2 },
        { key: 'cta', label: 'Texto botón' },
      ],
    },
  ],
  story: [
    {
      id: 'story-hook', nombre: 'Hook / Dolor', desc: 'Pregunta de impacto para captar atención.',
      component: StoryHook, exportW: 1080, exportH: 1920, previewW: 405, previewH: 720,
      defaults: {
        tag: 'REVENDEDOR DE iPHONE',
        titulo: '¿Llevás el\nstock en una\nlibreta?',
        subtitulo: 'Hay una mejor forma de llevar tu negocio.',
        handle: '@reventapp.iphone',
      },
      campos: [
        { key: 'tag', label: 'Etiqueta' },
        { key: 'titulo', label: 'Pregunta/gancho (\\n para salto)', multiline: true, rows: 4 },
        { key: 'subtitulo', label: 'Frase de cierre' },
        { key: 'handle', label: 'Handle' },
      ],
    },
    {
      id: 'story-feature', nombre: 'Feature Story', desc: 'Función específica con botón de acción.',
      component: StoryFeature, exportW: 1080, exportH: 1920, previewW: 405, previewH: 720,
      defaults: {
        tag: 'CATÁLOGO',
        titulo: 'Compartí tu\ncatálogo por\nWhatsApp.',
        subtitulo: 'Un link, todos tus iPhones disponibles. Actualizado en tiempo real.',
        url: 'reventapp.com.ar',
        handle: '@reventapp.iphone',
      },
      campos: [
        { key: 'tag', label: 'Etiqueta' },
        { key: 'titulo', label: 'Título (\\n para salto)', multiline: true, rows: 3 },
        { key: 'subtitulo', label: 'Descripción' },
        { key: 'url', label: 'URL botón' },
        { key: 'handle', label: 'Handle' },
      ],
    },
    {
      id: 'story-cta', nombre: 'CTA Story', desc: 'Historia de conversión full screen.',
      component: StoryCTA, exportW: 1080, exportH: 1920, previewW: 405, previewH: 720,
      defaults: {
        tag: 'EMPEZÁ HOY',
        titulo: '7 días\ngratis.',
        subtitulo: 'Sin tarjeta. Sin compromisos.\nCancelá cuando quieras.',
        precio: 'Después desde $7.900/mes',
        url: 'reventapp.com.ar',
        handle: '@reventapp.iphone',
      },
      campos: [
        { key: 'tag', label: 'Etiqueta pill' },
        { key: 'titulo', label: 'Oferta grande (\\n para salto)', multiline: true, rows: 2 },
        { key: 'subtitulo', label: 'Detalle (\\n para salto)', multiline: true, rows: 2 },
        { key: 'precio', label: 'Precio' },
        { key: 'url', label: 'URL' },
        { key: 'handle', label: 'Handle' },
      ],
    },
  ],
  ad: [
    {
      id: 'ad-split', nombre: 'Problema → Solución', desc: 'Layout dividido. Alta conversión.',
      component: AdSplit, exportW: 1200, exportH: 628, previewW: 600, previewH: 314,
      defaults: {
        problema: 'Llevás el stock en una libreta y nunca sabés exactamente qué tenés.',
        solucion: 'ReventApp: stock, ventas y cobros en tiempo real desde el celular.',
        cta: '7 días gratis',
        precio: 'Desde $7.900/mes · reventapp.com.ar',
      },
      campos: [
        { key: 'problema', label: 'El problema', multiline: true, rows: 3 },
        { key: 'solucion', label: 'La solución', multiline: true, rows: 3 },
        { key: 'cta', label: 'Texto botón' },
        { key: 'precio', label: 'Precio / URL' },
      ],
    },
    {
      id: 'ad-pricing', nombre: 'Pricing / CTA', desc: 'Propuesta de valor + precio + acción.',
      component: AdPricing, exportW: 1200, exportH: 628, previewW: 600, previewH: 314,
      defaults: {
        headline: 'Probá ReventApp 7 días gratis.',
        feature1: '✓  Stock de iPhones en tiempo real',
        feature2: '✓  Control de cobros y cuotas',
        feature3: '✓  Catálogo digital por WhatsApp',
        precio: 'Desde $7.900/mes',
        cta: 'Empezar gratis',
      },
      campos: [
        { key: 'headline', label: 'Titular', multiline: true, rows: 2 },
        { key: 'feature1', label: 'Beneficio 1' },
        { key: 'feature2', label: 'Beneficio 2' },
        { key: 'feature3', label: 'Beneficio 3' },
        { key: 'precio', label: 'Precio' },
        { key: 'cta', label: 'Texto botón' },
      ],
    },
  ],
};

const TAB_LABELS = {
  feed:  '📱  Feed  1:1',
  story: '📲  Historia',
  ad:    '📣  Meta Ad',
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function Studio() {
  const { user } = useAuth();
  const [tab, setTab]             = useState('feed');
  const [selected, setSelected]   = useState(null);
  const [editData, setEditData]   = useState({});
  const [downloading, setDownloading] = useState(false);
  const [caption, setCaption]         = useState('');
  const [copied, setCopied]           = useState(false);
  const templateRef = useRef(null);

  // AuthProvider ya maneja el loading (renderiza children solo cuando loading=false)
  if (!user) return <Navigate to="/login" />;
  if (user.email !== 'luucila20@gmail.com') return <Navigate to="/" />;

  const handleSelect = (tpl) => {
    setSelected(tpl);
    setEditData({ ...tpl.defaults });
    setCaption(CAPTIONS[tpl.id] || '');
    setCopied(false);
  };

  const handleDownload = async () => {
    if (!templateRef.current || !selected || downloading) return;
    setDownloading(true);
    try {
      const scale = selected.exportW / selected.previewW;
      const canvas = await html2canvas(templateRef.current, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `reventapp-${selected.id}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('Error al generar la imagen. Intentá de nuevo.');
    } finally {
      setDownloading(false);
    }
  };

  const CurrentTemplate = selected?.component;
  const list = TEMPLATES[tab] || [];

  const ui = {
    bg: '#080F28', surface: '#1E293B', border: 'rgba(37,99,235,0.2)',
    text: '#fff', muted: '#94A3B8', blue: '#2563EB', sky: '#7DD3FC',
  };

  return (
    <div style={{ minHeight: '100vh', background: ui.bg, fontFamily: 'Inter, sans-serif', color: ui.text, padding: '32px 32px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: ui.blue }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: ui.sky, letterSpacing: '3px', textTransform: 'uppercase' }}>ADMIN — PRIVADO</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-1px', color: ui.text }}>ReventApp Studio</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: ui.muted }}>Generador de contenido para redes sociales y Meta Ads.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, background: ui.surface, padding: 4, borderRadius: 12, width: 'fit-content', border: `1px solid ${ui.border}` }}>
        {Object.entries(TAB_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setSelected(null); }}
            style={{
              border: 'none', cursor: 'pointer', padding: '8px 18px', borderRadius: 9,
              fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700,
              background: tab === key ? ui.blue : 'transparent',
              color: tab === key ? '#fff' : ui.muted,
              transition: 'background 0.15s, color 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Template list */}
        <div style={{ width: 210, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ui.muted, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 10 }}>TEMPLATES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map(tpl => (
              <button key={tpl.id} onClick={() => handleSelect(tpl)}
                style={{
                  border: `1px solid ${selected?.id === tpl.id ? ui.blue : ui.border}`,
                  background: selected?.id === tpl.id ? 'rgba(37,99,235,0.15)' : ui.surface,
                  borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                  color: ui.text, fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                  outline: 'none',
                }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{tpl.nombre}</div>
                <div style={{ fontSize: 11, color: ui.muted, lineHeight: 1.4 }}>{tpl.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {selected ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: ui.muted, letterSpacing: '2px', textTransform: 'uppercase', alignSelf: 'flex-start' }}>
                PREVIEW — {selected.exportW} × {selected.exportH} px
              </div>

              <div ref={templateRef}
                style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', flexShrink: 0, width: selected.previewW, height: selected.previewH }}>
                <CurrentTemplate {...editData} />
              </div>

              <button onClick={handleDownload} disabled={downloading}
                style={{
                  background: downloading ? ui.surface : ui.blue, color: '#fff',
                  border: `1px solid ${ui.border}`, borderRadius: 10, padding: '12px 28px',
                  fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14,
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: downloading ? 0.6 : 1, transition: 'all 0.15s',
                  outline: 'none',
                }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {downloading ? 'Generando...' : `Descargar PNG (${selected.exportW}×${selected.exportH})`}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 420, color: ui.muted, textAlign: 'center' }}>
              <svg viewBox="0 0 24 24" width={56} height={56} fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, marginBottom: 16 }}>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Seleccioná un template</div>
              <div style={{ fontSize: 13 }}>Elegí un formato de la lista para empezar</div>
            </div>
          )}
        </div>

        {/* Editor */}
        {selected && (
          <div style={{ width: 270, flexShrink: 0, background: ui.surface, borderRadius: 14, padding: '20px', border: `1px solid ${ui.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ui.muted, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>PERSONALIZAR</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {selected.campos.map(campo => (
                <div key={campo.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: ui.muted, marginBottom: 5 }}>{campo.label}</label>
                  {campo.multiline ? (
                    <textarea value={editData[campo.key] ?? ''} rows={campo.rows || 3}
                      onChange={e => setEditData(d => ({ ...d, [campo.key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', background: '#0a1628', border: `1px solid ${ui.border}`, borderRadius: 8, padding: '8px 10px', color: ui.text, fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
                  ) : (
                    <input type="text" value={editData[campo.key] ?? ''}
                      onChange={e => setEditData(d => ({ ...d, [campo.key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', background: '#0a1628', border: `1px solid ${ui.border}`, borderRadius: 8, padding: '8px 10px', color: ui.text, fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none' }} />
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setEditData({ ...selected.defaults })}
              style={{ marginTop: 20, width: '100%', background: 'transparent', border: `1px solid ${ui.border}`, borderRadius: 8, padding: '9px', color: ui.muted, fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
              Restaurar texto original
            </button>
          </div>
        )}
      </div>

      {/* Caption section */}
      {selected && (
        <div style={{ marginTop: 28, background: ui.surface, borderRadius: 14, padding: '20px 24px', border: `1px solid ${ui.border}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: ui.muted, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 3 }}>
                TEXTO PARA INSTAGRAM
              </div>
              <div style={{ fontSize: 12, color: ui.muted }}>
                Copy + hashtags listos para pegar cuando publiques la imagen
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: caption.length > 2100 ? '#f87171' : ui.muted }}>
                {caption.length}/2200
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                style={{
                  background: copied ? B.green : ui.blue, color: '#fff',
                  border: 'none', borderRadius: 8, padding: '9px 22px',
                  fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', outline: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}>
                {copied ? '✓ ¡Copiado!' : 'Copiar texto'}
              </button>
            </div>
          </div>
          <textarea
            value={caption}
            rows={8}
            onChange={e => setCaption(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0a1628', border: `1px solid ${ui.border}`,
              borderRadius: 8, padding: '12px 14px', color: ui.text,
              fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.7,
              resize: 'vertical', outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}
