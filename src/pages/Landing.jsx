import { Link } from 'react-router-dom';
import { useState } from 'react';

const FEATURES = [
  { icon: '📦', titulo: 'Stock con IMEI', desc: 'Cada equipo con modelo, GB, color, batería, IMEI, proveedor y estado. Buscá en segundos.' },
  { icon: '💰', titulo: 'Ventas con parte de pago', desc: 'Registrá ventas en pesos, dólares, cuotas o iPhone como parte de pago. Todo en una sola operación.' },
  { icon: '📊', titulo: 'Ganancia real en USD y ARS', desc: 'Ves al instante cuánto ganaste en dólares y en pesos, con el tipo de cambio del día aplicado.' },
  { icon: '💳', titulo: 'Cobros y deudores', desc: 'Sabés exactamente quién te debe, cuánto y hace cuántos días. Semáforo de urgencia para no olvidarte de nadie.' },
  { icon: '📲', titulo: 'Recordatorios con un toque', desc: 'Ves quién te debe hoy y mandás el recordatorio directo a WhatsApp con el mensaje ya escrito. Sin copiar y pegar nada.' },
  { icon: '🤝', titulo: 'Catálogo para compartir', desc: 'Un link listo para mandar por WhatsApp con tu stock disponible. Sin precios de costo, solo lo que querés mostrar.' },
  { icon: '👥', titulo: 'Múltiples usuarios', desc: 'Sumá a tus vendedores con permisos configurables. Cada uno ve solo lo que necesita.' },
];

const FAQS = [
  { q: '¿Funciona para cualquier tipo de revendedor?', a: 'Sí. Funciona tanto si tenés un local físico como si vendés solo por Instagram o WhatsApp.' },
  { q: '¿Qué pasa con mis datos si cancelo?', a: 'Tus datos quedan guardados por 30 días después de cancelar. Podés exportarlos cuando quieras.' },
  { q: '¿Puedo agregar a mis vendedores?', a: 'Sí. El plan Básico tiene 1 usuario. El plan Pro incluye hasta 3 usuarios con permisos configurables. El Pro Max tiene usuarios ilimitados.' },
  { q: '¿Necesito saber de tecnología para usarlo?', a: 'No. Si podés usar WhatsApp, podés usar este sistema.' },
  { q: '¿Funciona en el celular?', a: 'Sí, 100%. Está diseñado mobile-first para que lo uses desde tu celular en cualquier momento.' },
];

const TESTIMONIOS = [
  { texto: '"Antes llevaba todo en una planilla de Excel y me equivocaba seguido con el tipo de cambio. Ahora entro a la app y veo todo al instante. No me imagino volver atrás."', nombre: 'Martín G.', loc: 'Revendedor de iPhone · Córdoba' },
  { texto: '"Lo que más me cambió fue el sistema de cobros en cuotas. Antes perdía plata porque se me olvidaban las fechas. Ahora me avisa cuando hay cuotas vencidas."', nombre: 'Carolina V.', loc: 'Revendedora · Buenos Aires' },
  { texto: '"En 10 minutos tenía todo el stock cargado y mi primera venta registrada. Es muy fácil de usar."', nombre: 'Diego R.', loc: 'Revendedor · Rosario' },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid #2c2c2e', borderRadius: 10, overflow: 'hidden', marginBottom: 8, transition: 'border-color .2s', borderColor: open ? 'rgba(201,169,110,0.4)' : '#2c2c2e' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', background: '#1c1c1e', border: 'none', color: '#fff', fontFamily: "'Inter', sans-serif", padding: '18px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 600, gap: 12 }}>
        {q}
        <span style={{ color: '#c9a96e', fontSize: 20, flexShrink: 0, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
      </button>
      {open && <div style={{ background: '#1c1c1e', padding: '0 20px 18px', fontSize: 14, color: '#86868b', lineHeight: 1.7 }}>{a}</div>}
    </div>
  );
}

export default function Landing() {
  return (
    <div style={{ background: '#0d0d0d', color: '#fff', fontFamily: "'Inter', -apple-system, sans-serif", lineHeight: 1.6, WebkitFontSmoothing: 'antialiased' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, background: 'rgba(13,13,13,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #1c1c1e', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: '#fff' }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <span style={{ fontWeight: 700, fontSize: 15 }}>iPhone Caleta App</span>
        </div>
        <Link to="/registro" style={{ background: '#c9a96e', color: '#000', padding: '8px 18px', borderRadius: 99, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          Empezar gratis
        </Link>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px 60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,169,110,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)', color: '#c9a96e', padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, marginBottom: 28 }}>
          ✦ Diseñado para el mercado argentino
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 7vw, 64px)', fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.05, maxWidth: 780, marginBottom: 20 }}>
          El sistema que necesita todo<br /><span style={{ color: '#c9a96e' }}>revendedor de iPhone</span>
        </h1>
        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#86868b', maxWidth: 520, margin: '0 auto 40px', fontWeight: 400 }}>
          Stock, ventas, cobros y ganancias en un solo lugar. Diseñado específicamente para el mercado argentino.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
          <Link to="/registro" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#c9a96e', color: '#000', padding: '14px 28px', borderRadius: 99, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
            Empezar gratis 7 días →
          </Link>
          <a href="#como-funciona" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#fff', border: '1px solid #2c2c2e', padding: '14px 28px', borderRadius: 99, fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
            Ver cómo funciona
          </a>
        </div>
        <div style={{ color: '#86868b', fontSize: 13, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>✓ Sin tarjeta de crédito</span>
          <span>✓ Configurá en 5 minutos</span>
          <span>✓ Cancelá cuando quieras</span>
        </div>
      </section>

      {/* PROBLEMA */}
      <section style={{ background: '#0d0d0d', padding: '80px 24px', borderTop: '1px solid #1c1c1e' }} id="como-funciona">
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 48 }}>¿Te pasa esto?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {[
              { icon: '😰', titulo: 'No sabés cuánto ganaste este mes', desc: 'Comprás en dólares, vendés en pesos, recibís partes de pago... al final del mes no sabés si ganaste o perdiste.' },
              { icon: '📱', titulo: 'Tu stock está en WhatsApp y Excel', desc: 'Cuando un cliente pregunta si tenés un 13 Pro 256 azul, tardás 5 minutos en encontrarlo.' },
              { icon: '💸', titulo: 'Los clientes que deben son un caos', desc: 'Sabés que alguien te debe pero no recordás cuánto, ni cuándo fue la última cuota.' },
              { icon: '😬', titulo: 'Cobrar las cuotas es un caos', desc: 'Tenés clientes que te deben cuotas y no sabés cuándo llamarlos ni cuánto deben exactamente. Con iPhone Caleta ves todo al instante y mandás el recordatorio con un solo toque.' },
            ].map(p => (
              <div key={p.titulo} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 24, textAlign: 'left' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{p.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{p.titulo}</div>
                <div style={{ color: '#86868b', fontSize: 14, lineHeight: 1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '80px 24px', background: '#080808' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>Resuelve todo eso</h2>
            <p style={{ color: '#86868b', fontSize: 16 }}>Todo lo que necesitás para gestionar tu negocio de iPhones</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {FEATURES.map(f => (
              <div key={f.titulo} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.titulo}</div>
                <div style={{ color: '#86868b', fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section style={{ padding: '80px 24px', background: '#0d0d0d' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>Planes simples, sin sorpresas</h2>
          <p style={{ color: '#86868b', fontSize: 16, marginBottom: 48 }}>Empezá gratis 7 días, sin tarjeta</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', marginBottom: 28 }}>

            {/* Básico */}
            <div style={{ background: '#1c1c1e', border: '2px solid #2c2c2e', borderRadius: 16, padding: 24, flex: '1 1 220px', maxWidth: 280, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: '#86868b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Básico</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 4 }}>$7.900<span style={{ fontSize: 13, fontWeight: 400, color: '#86868b' }}>/mes</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20, marginTop: 14 }}>
                {['Stock hasta 20 equipos', 'Hasta 10 ventas/mes', 'Multi-moneda ARS/USD', '1 usuario', 'Cobros y cuotas'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#ebebf5cc' }}><span style={{ color: '#30d158', flexShrink: 0 }}>✓</span>{f}</div>
                ))}
              </div>
              <Link to="/registro" style={{ display: 'block', background: '#2c2c2e', color: '#fff', border: '1px solid #3a3a3c', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                Empezar gratis
              </Link>
            </div>

            {/* Pro */}
            <div style={{ background: 'rgba(201,169,110,0.06)', border: '2px solid #c9a96e', borderRadius: 16, padding: 24, flex: '1 1 240px', maxWidth: 320, textAlign: 'left', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#c9a96e', color: '#000', fontSize: 10, fontWeight: 800, padding: '3px 14px', borderRadius: 99, whiteSpace: 'nowrap' }}>🔥 MÁS POPULAR</div>
              <div style={{ fontSize: 11, color: '#c9a96e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Pro</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: '#c9a96e', letterSpacing: '-1px', marginBottom: 2 }}>$14.900<span style={{ fontSize: 13, fontWeight: 400, color: '#86868b' }}>/mes</span></div>
              <div style={{ fontSize: 11, color: '#86868b', marginBottom: 14 }}>= $497 ARS por día. Menos que un café.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20 }}>
                {['Stock hasta 60 equipos', 'Hasta 30 ventas/mes', 'Hasta 3 usuarios con permisos', 'Reportes USD y ARS', 'Cobros del día + semáforo', 'Calculadora de precio', 'Catálogo público compartible', 'Soporte WhatsApp 24hs'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#ebebf5cc' }}><span style={{ color: '#30d158', flexShrink: 0 }}>✓</span>{f}</div>
                ))}
              </div>
              <Link to="/registro" style={{ display: 'block', background: '#c9a96e', color: '#000', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                Empezar gratis
              </Link>
            </div>

            {/* Pro Max */}
            <div style={{ background: '#1c1c1e', border: '2px solid #2c2c2e', borderRadius: 16, padding: 24, flex: '1 1 220px', maxWidth: 280, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: '#86868b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan Pro Max</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 4 }}>$29.900<span style={{ fontSize: 13, fontWeight: 400, color: '#86868b' }}>/mes</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20, marginTop: 14 }}>
                {['Stock y ventas ilimitados', 'Todo lo del Plan Pro', 'Usuarios ilimitados', 'Múltiples puntos de venta', 'Reportes por vendedor', 'Dashboard gerencial', 'WhatsApp directo a deudores', 'Soporte prioritario 2hs'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#ebebf5cc' }}><span style={{ color: '#30d158', flexShrink: 0 }}>✓</span>{f}</div>
                ))}
              </div>
              <Link to="/registro" style={{ display: 'block', background: '#2c2c2e', color: '#fff', border: '1px solid #3a3a3c', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                Consultar
              </Link>
            </div>

          </div>
          <div style={{ color: '#86868b', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <span>💳 Pagá con tarjeta, débito o transferencia via MercadoPago</span>
            <span>🔄 Cancelá cuando quieras · ✓ 7 días gratis sin tarjeta</span>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section style={{ padding: '80px 24px', background: '#080808' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 48, textAlign: 'center' }}>Lo que dicen los revendedores</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {TESTIMONIOS.map(t => (
              <div key={t.nombre} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 24 }}>
                <div style={{ color: '#c9a96e', fontSize: 14, letterSpacing: 2, marginBottom: 14 }}>★★★★★</div>
                <p style={{ color: '#ebebf5cc', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 20 }}>{t.texto}</p>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.nombre}</div>
                <div style={{ color: '#86868b', fontSize: 12 }}>{t.loc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 24px', background: '#0d0d0d' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 40, textAlign: 'center' }}>Preguntas frecuentes</h2>
          {FAQS.map(f => <FaqItem key={f.q} {...f} />)}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background: '#c9a96e', padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: '#000', letterSpacing: '-1px', marginBottom: 12 }}>Empezá tu prueba gratis hoy</h2>
        <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: 16, marginBottom: 32 }}>7 días sin tarjeta de crédito. Sin compromisos.</p>
        <Link to="/registro" style={{ display: 'inline-block', background: '#000', color: '#fff', padding: '16px 40px', borderRadius: 99, fontSize: 17, fontWeight: 700, textDecoration: 'none' }}>
          Crear cuenta gratis →
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#080808', borderTop: '1px solid #1c1c1e', padding: '32px 24px', textAlign: 'center', color: '#86868b', fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: '#86868b' }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <span>iPhone Caleta App</span>
        </div>
        <div>© 2025 · Para revendedores de iPhone en Argentina</div>
      </footer>

    </div>
  );
}
