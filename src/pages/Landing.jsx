import { Link } from 'react-router-dom';
import { useState } from 'react';

const C = {
  bgPrimary:      '#0f172a',
  bgCard:         '#1e293b',
  bgCardHover:    '#263548',
  border:         'rgba(37, 99, 235, 0.2)',
  accentBlue:     '#2563EB',
  accentLight:    '#7DD3FC',
  accentNavy:     '#1a3a8f',
  gradientCTA:    'linear-gradient(135deg, #1a3a8f 0%, #2563EB 100%)',
  gradientHero:   'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
  gradientAccent: 'linear-gradient(135deg, #2563EB 0%, #7DD3FC 100%)',
  textPrimary:    '#ffffff',
  textSecondary:  '#94a3b8',
  textAccent:     '#7DD3FC',
  success:        '#10b981',
  warning:        '#f59e0b',
  error:          '#ef4444',
};

const PROBLEMAS = [
  {
    icon: '💰',
    titulo: 'Sin control de ganancias',
    desc: 'Comprás en dólares, vendés en pesos y recibís partes de pago. Al final del mes no sabés si ganaste o perdiste.',
  },
  {
    icon: '📱',
    titulo: 'Stock desorganizado',
    desc: 'Cuando un cliente pregunta si tenés un 13 Pro 256 azul, tardás 5 minutos en encontrarlo.',
  },
  {
    icon: '💸',
    titulo: 'Cobros sin seguimiento',
    desc: 'Sabés que alguien te debe pero no recordás cuánto, ni cuándo fue la última cuota.',
  },
];

const FEATURES = [
  { icon: '📦', titulo: 'Stock',         desc: 'Modelo, GB, color, batería e IMEI. Buscá en segundos.' },
  { icon: '💰', titulo: 'Ventas',        desc: 'Pesos, dólares, cuotas o parte de pago. Todo en una operación.' },
  { icon: '📊', titulo: 'Ganancias',     desc: 'Cuánto ganaste en USD y ARS con el tipo de cambio del día.' },
  { icon: '💳', titulo: 'Cobros',        desc: 'Quién te debe, cuánto y hace cuántos días. Semáforo de urgencia.' },
  { icon: '📲', titulo: 'Recordatorios', desc: 'Mandá el recordatorio a WhatsApp con un solo toque.' },
  { icon: '🔗', titulo: 'Catálogo',      desc: 'Un link con tu stock disponible listo para mandar por WhatsApp.' },
];

const FAQS = [
  { q: '¿Funciona para cualquier tipo de revendedor?', a: 'Sí. Funciona tanto si tenés un local físico como si vendés solo por Instagram o WhatsApp.' },
  { q: '¿Qué pasa con mis datos si cancelo?', a: 'Tus datos quedan guardados por 30 días después de cancelar. Podés exportarlos cuando quieras.' },
  { q: '¿Puedo agregar a mis vendedores?', a: 'Sí. El plan Básico tiene 1 usuario. El plan Pro incluye hasta 3 usuarios con permisos configurables. El Pro Max tiene usuarios ilimitados.' },
  { q: '¿Necesito saber de tecnología para usarlo?', a: 'No. Si podés usar WhatsApp, podés usar este sistema.' },
  { q: '¿Funciona en el celular?', a: 'Sí, 100%. Está diseñado mobile-first para que lo uses desde tu celular en cualquier momento.' },
];

const TESTIMONIOS = [
  { texto: '"Antes llevaba todo en Excel y me equivocaba seguido con el tipo de cambio. Ahora entro a la app y veo todo al instante."', nombre: 'Martín G.', loc: 'Revendedor · Córdoba' },
  { texto: '"Lo que más me cambió fue el sistema de cobros en cuotas. Antes perdía plata porque se me olvidaban las fechas."', nombre: 'Carolina V.', loc: 'Revendedora · Buenos Aires' },
  { texto: '"En 10 minutos tenía todo el stock cargado y mi primera venta registrada. Es muy fácil de usar."', nombre: 'Diego R.', loc: 'Revendedor · Rosario' },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${open ? C.accentBlue : C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 8, transition: 'border-color .2s' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', background: C.bgCard, border: 'none', color: '#fff', fontFamily: "'Inter', sans-serif", padding: '18px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 600, gap: 12 }}
      >
        {q}
        <span style={{ color: C.accentLight, fontSize: 20, flexShrink: 0, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
      </button>
      {open && <div style={{ background: C.bgCard, padding: '0 20px 18px', fontSize: 14, color: C.textSecondary, lineHeight: 1.7 }}>{a}</div>}
    </div>
  );
}

function CardFeature({ icon, titulo, desc }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.bgCard,
        border: `1px solid ${hover ? C.accentBlue : C.border}`,
        borderRadius: 14,
        padding: 20,
        transition: 'all 0.2s ease',
        boxShadow: hover ? `0 8px 32px rgba(37, 99, 235, 0.15)` : 'none',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, marginTop: 14 }}>{titulo}</div>
      <div style={{ color: C.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

export default function Landing() {
  return (
    <div style={{ background: C.bgPrimary, color: C.textPrimary, fontFamily: "'Inter', -apple-system, sans-serif", lineHeight: 1.6, WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        .landing-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .landing-grid-2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 768px) {
          .landing-grid-3 { grid-template-columns: 1fr !important; }
          .landing-grid-2 { grid-template-columns: repeat(2, 1fr) !important; }
          .precio-pro-scale { transform: scale(1) !important; }
        }
        @media (max-width: 480px) {
          .landing-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}`, padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: C.accentLight }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
          <span style={{ fontWeight: 700, fontSize: 15 }}>iPhone Caleta App</span>
        </div>
        <Link to="/registro" style={{ background: C.gradientCTA, color: '#fff', padding: '8px 18px', borderRadius: 99, fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 16px rgba(37,99,235,0.35)' }}>
          Empezar gratis
        </Link>
      </nav>

      {/* HERO */}
      <section style={{ background: C.gradientHero, minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px 60px', position: 'relative', overflow: 'hidden' }}>
        {/* Brillo decorativo */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(37,99,235,0.15)', border: `1px solid rgba(37,99,235,0.4)`, color: C.accentLight, padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, marginBottom: 28 }}>
          ✦ Diseñado para el mercado argentino
        </div>

        <h1 style={{ fontSize: 'clamp(36px, 7vw, 56px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.05, maxWidth: 780, marginBottom: 12 }}>
          El sistema que necesita todo<br />
          <span style={{ color: C.accentLight }}>revendedor de iPhone</span>
        </h1>

        {/* Línea decorativa bajo título */}
        <div style={{ width: 80, height: 3, background: C.gradientAccent, borderRadius: 2, margin: '16px auto 20px' }} />

        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: C.textSecondary, maxWidth: 520, margin: '0 auto 40px', fontWeight: 400 }}>
          Stock, ventas, cobros y ganancias en un solo lugar.<br />Diseñado para el mercado argentino.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
          <Link to="/registro" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.gradientCTA, color: '#fff', padding: '14px 32px', borderRadius: 99, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 24px rgba(37, 99, 235, 0.4)' }}>
            Empezar gratis — 7 días →
          </Link>
          <a href="#como-funciona" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#fff', border: `1px solid ${C.accentBlue}`, padding: '14px 28px', borderRadius: 99, fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
            Ver cómo funciona
          </a>
        </div>

        <div style={{ color: C.textSecondary, fontSize: 13, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>✓ Sin tarjeta de crédito</span>
          <span>✓ Tus datos seguros</span>
          <span>✓ Cancelá cuando quieras</span>
        </div>
      </section>

      {/* PRUEBA SOCIAL — ciudades */}
      <section style={{ background: C.bgPrimary, padding: '32px 24px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: C.textSecondary, letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>
            Usado por revendedores en toda Argentina
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['CABA', 'Córdoba', 'Rosario', 'Mendoza', 'Tucumán'].map(ciudad => (
              <span key={ciudad} style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', color: C.textSecondary, borderRadius: 99, padding: '6px 16px', fontSize: 12 }}>
                {ciudad}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ¿TE PASA ESTO? — 3 cards */}
      <section style={{ background: C.bgPrimary, padding: '80px 24px' }} id="como-funciona">
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 48 }}>¿Te pasa esto?</h2>
          <div className="landing-grid-3">
            {PROBLEMAS.map(p => (
              <div key={p.titulo} style={{ background: C.bgCard, borderRadius: 14, padding: 24, textAlign: 'left', borderLeft: `3px solid ${C.accentBlue}` }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{p.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.textPrimary, marginBottom: 8 }}>{p.titulo}</div>
                <div style={{ color: C.textSecondary, fontSize: 13, lineHeight: 1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — 6 cards 3x2 */}
      <section style={{ padding: '80px 24px', background: '#0a1628' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>Resuelve todo eso</h2>
            <p style={{ color: C.textSecondary, fontSize: 16 }}>Todo lo que necesitás para gestionar tu negocio de iPhones</p>
          </div>
          <div className="landing-grid-2">
            {FEATURES.map(f => <CardFeature key={f.titulo} {...f} />)}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section style={{ padding: '80px 24px', background: C.bgPrimary }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>Planes simples, sin sorpresas</h2>
          <p style={{ color: C.textSecondary, fontSize: 16, marginBottom: 56 }}>Empezá gratis 7 días, sin tarjeta</p>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginBottom: 28 }}>

            {/* Básico */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, flex: '1 1 220px', maxWidth: 280, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Básico</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.textPrimary, letterSpacing: '-1px', marginBottom: 4 }}>
                <span style={{ color: C.accentLight }}>$</span>7.900<span style={{ fontSize: 13, fontWeight: 400, color: C.textSecondary }}>/mes</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20, marginTop: 14 }}>
                {['Stock hasta 20 equipos', 'Hasta 10 ventas/mes', 'Multi-moneda ARS/USD', '1 usuario', 'Cobros y cuotas'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#ebebf5cc' }}>
                    <span style={{ color: C.accentBlue, flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link to="/registro" style={{ display: 'block', background: C.bgCard, color: C.textPrimary, border: `1px solid ${C.accentBlue}`, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                Empezar gratis
              </Link>
            </div>

            {/* Pro — destacado */}
            <div className="precio-pro-scale" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #1e3a5f 100%)', border: `2px solid ${C.accentBlue}`, borderRadius: 16, padding: 24, flex: '1 1 240px', maxWidth: 320, textAlign: 'left', position: 'relative', transform: 'scale(1.05)', boxShadow: '0 0 40px rgba(37, 99, 235, 0.3)' }}>
              <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: C.gradientCTA, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 14px', borderRadius: 99, whiteSpace: 'nowrap' }}>🔥 MÁS POPULAR</div>
              <div style={{ fontSize: 11, color: C.accentLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Pro</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.textPrimary, letterSpacing: '-1px', marginBottom: 2 }}>
                <span style={{ color: C.accentLight }}>$</span>14.900<span style={{ fontSize: 13, fontWeight: 400, color: C.textSecondary }}>/mes</span>
              </div>
              <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 14 }}>= $497 ARS por día. Menos que un café.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20 }}>
                {['Stock hasta 60 equipos', 'Hasta 30 ventas/mes', 'Hasta 3 usuarios con permisos', 'Reportes USD y ARS', 'Cobros del día + semáforo', 'Calculadora de precio', 'Catálogo público compartible', 'Soporte WhatsApp 24hs'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#ebebf5cc' }}>
                    <span style={{ color: C.accentBlue, flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link to="/registro" style={{ display: 'block', background: C.gradientCTA, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center', boxShadow: '0 0 16px rgba(37,99,235,0.4)' }}>
                Empezar gratis
              </Link>
            </div>

            {/* Pro Max */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, flex: '1 1 220px', maxWidth: 280, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Pro Max</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.textPrimary, letterSpacing: '-1px', marginBottom: 4 }}>
                <span style={{ color: C.accentLight }}>$</span>29.900<span style={{ fontSize: 13, fontWeight: 400, color: C.textSecondary }}>/mes</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20, marginTop: 14 }}>
                {['Stock y ventas ilimitados', 'Todo lo del Plan Pro', 'Usuarios ilimitados', 'Múltiples puntos de venta', 'Reportes por vendedor', 'Dashboard gerencial', 'WhatsApp directo a deudores', 'Soporte prioritario 2hs'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#ebebf5cc' }}>
                    <span style={{ color: C.accentBlue, flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link to="/registro" style={{ display: 'block', background: 'transparent', color: C.accentLight, border: `1px solid ${C.accentBlue}`, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                Consultar
              </Link>
            </div>

          </div>
          <div style={{ color: C.textSecondary, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <span>💳 Pagá con tarjeta, débito o transferencia via MercadoPago</span>
            <span>🔄 Cancelá cuando quieras · ✓ 7 días gratis sin tarjeta</span>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section style={{ padding: '80px 24px', background: '#0a1628' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 48, textAlign: 'center' }}>Lo que dicen los revendedores</h2>
          <div className="landing-grid-3">
            {TESTIMONIOS.map(t => (
              <div key={t.nombre} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
                <div style={{ color: C.accentBlue, fontSize: 14, letterSpacing: 2, marginBottom: 14 }}>★★★★★</div>
                <p style={{ color: '#ebebf5cc', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 20 }}>{t.texto}</p>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.nombre}</div>
                <div style={{ color: C.textSecondary, fontSize: 12 }}>{t.loc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 24px', background: C.bgPrimary }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 40, textAlign: 'center' }}>Preguntas frecuentes</h2>
          {FAQS.map(f => <FaqItem key={f.q} {...f} />)}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background: C.gradientCTA, padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 12 }}>Empezá tu prueba gratis hoy</h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, marginBottom: 32 }}>7 días sin tarjeta de crédito. Sin compromisos.</p>
        <Link to="/registro" style={{ display: 'inline-block', background: '#fff', color: C.accentNavy, padding: '16px 40px', borderRadius: 99, fontSize: 17, fontWeight: 700, textDecoration: 'none' }}>
          Crear cuenta gratis →
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#080e1e', borderTop: `1px solid ${C.border}`, padding: '32px 24px', textAlign: 'center', color: C.textSecondary, fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: C.textSecondary }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
          <span>iPhone Caleta App</span>
        </div>
        <div>© 2025 · Para revendedores de iPhone en Argentina</div>
      </footer>

    </div>
  );
}
