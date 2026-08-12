import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function BannerTrial() {
  const { plan, planActivo, diasRestantesTrial } = useAuth();
  if (plan !== 'trial' || !planActivo) return null;

  const dias = diasRestantesTrial ?? 7;
  let bg, border, color, icono, texto;

  if (dias <= 1) {
    bg = 'var(--rv-danger-soft)'; border = 'var(--rv-danger)'; color = 'var(--rv-danger)';
    icono = '🚨';
    texto = `Tu prueba vence hoy — Elegí un plan para no perder tus datos`;
  } else if (dias <= 3) {
    bg = 'var(--rv-accent-soft)'; border = 'var(--rv-accent)'; color = 'var(--rv-accent)';
    icono = '⏰';
    texto = `Tu prueba vence en ${dias} días — No pierdas el acceso`;
  } else {
    bg = 'var(--rv-accent-soft)'; border = 'var(--rv-accent)'; color = 'var(--rv-accent)';
    icono = '🧪';
    texto = `Estás en tu período de prueba — ${dias} días restantes`;
  }

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '10px 16px', marginBottom: 20,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 8,
    }}>
      <span style={{ color, fontSize: 13, fontWeight: 600 }}>{icono} {texto}</span>
      <Link to="/planes" style={{
        color: '#fff', background: color, padding: '6px 14px',
        borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        Elegir plan →
      </Link>
    </div>
  );
}

