import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function BannerTrial() {
  const { plan, planActivo, diasRestantesTrial } = useAuth();
  if (plan !== 'trial' || !planActivo) return null;

  const dias = diasRestantesTrial ?? 7;
  let bg, border, color, icono, texto;

  if (dias <= 1) {
    bg = 'rgba(255,59,48,0.1)'; border = '#ff3b30'; color = '#ff3b30';
    icono = '🚨';
    texto = `Tu prueba vence hoy — Elegí un plan para no perder tus datos`;
  } else if (dias <= 3) {
    bg = 'rgba(255,159,10,0.1)'; border = '#ff9f0a'; color = '#ff9f0a';
    icono = '⚠️';
    texto = `Tu prueba vence en ${dias} días — No pierdas el acceso`;
  } else {
    bg = 'rgba(201,169,110,0.1)'; border = '#c9a96e'; color = '#c9a96e';
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
        color: '#000', background: color, padding: '6px 14px',
        borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        Elegir plan →
      </Link>
    </div>
  );
}
