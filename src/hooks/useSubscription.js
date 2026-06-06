import { useAuth } from '../context/AuthContext';
import { PLANES } from '../config/planes';

export function useSubscription() {
  const { plan, limitesPlan, tieneFeature } = useAuth();
  const limites = limitesPlan || PLANES[plan] || PLANES.trial;

  const puedeAgregarStock = (stockActual) => {
    if (limites.maxStock === Infinity) return true;
    return stockActual < limites.maxStock;
  };
  const puedeAgregarVenta = (ventasMes) => {
    if (limites.maxVentasMes === Infinity) return true;
    return ventasMes < limites.maxVentasMes;
  };
  const tieneAccesoWhatsApp = tieneFeature ? tieneFeature('botonWhatsappDeudores') : false;
  const tieneAccesoCobrosAvanzados = tieneFeature ? tieneFeature('panelDeudores') : false;

  return { plan, limites, puedeAgregarStock, puedeAgregarVenta, tieneAccesoWhatsApp, tieneAccesoCobrosAvanzados };
}

