import { useAuth } from '../context/AuthContext';

export const LIMITES_PLAN = {
  trial:   { maxStock: 30, maxVentasMes: 20, maxUsuarios: 1 },
  basico:  { maxStock: 30, maxVentasMes: 20, maxUsuarios: 1 },
  pro:     { maxStock: Infinity, maxVentasMes: Infinity, maxUsuarios: 3 },
  agencia: { maxStock: Infinity, maxVentasMes: Infinity, maxUsuarios: Infinity },
};

export function useSubscription() {
  const { perfil } = useAuth();
  const plan = perfil?.plan || 'trial';
  const limites = LIMITES_PLAN[plan] || LIMITES_PLAN.trial;

  const puedeAgregarStock = (stockActual) => stockActual < limites.maxStock;
  const puedeAgregarVenta = (ventasMes) => ventasMes < limites.maxVentasMes;
  const tieneAccesoWhatsApp = plan === 'agencia';
  const tieneAccesoCobrosAvanzados = plan === 'pro' || plan === 'agencia';

  return { plan, limites, puedeAgregarStock, puedeAgregarVenta, tieneAccesoWhatsApp, tieneAccesoCobrosAvanzados };
}
