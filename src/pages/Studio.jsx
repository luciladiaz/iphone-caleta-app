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
  const templateRef = useRef(null);

  // AuthProvider ya maneja el loading (renderiza children solo cuando loading=false)
  if (!user) return <Navigate to="/login" />;
  if (user.email !== 'luucila20@gmail.com') return <Navigate to="/" />;

  const handleSelect = (tpl) => {
    setSelected(tpl);
    setEditData({ ...tpl.defaults });
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
    </div>
  );
}
