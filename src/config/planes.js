export const PLANES = {
  trial: {
    nombre: 'Prueba gratuita',
    precio: 0,
    maxStock: Infinity,
    maxVentasMes: Infinity,
    maxUsuarios: 3,
    duracionDias: 7,
    features: {
      catalogoPublico: true,
      reportesGanancia: true,
      valorStockTiempoReal: true,
      calculadoraPrecio: true,
      panelDeudores: true,
      resumenCobros: true,
      exportarExcel: true,
      botonWhatsappDeudores: true,
      reportesPorVendedor: true,
      dashboardGerencial: true,
      multiplesPointsVenta: true,
      historialEquipo: true,
      accesorios: true,
    },
  },
  promax: {
    nombre: 'Plan Completo',
    precio: 29900,
    maxStock: Infinity,
    maxVentasMes: Infinity,
    maxUsuarios: Infinity,
    features: {
      catalogoPublico: true,
      reportesGanancia: true,
      valorStockTiempoReal: true,
      calculadoraPrecio: true,
      panelDeudores: true,
      resumenCobros: true,
      exportarExcel: true,
      accesorios: true,
      botonWhatsappDeudores: true,
      reportesPorVendedor: true,
      dashboardGerencial: true,
      multiplesPointsVenta: true,
      historialEquipo: true,
    },
  },
};

// Aliases backward-compat: ReventApp pasó a un solo plan pago.
// Cualquier negocio con un plan viejo (agencia/pro/basico) cae en el plan completo actual.
PLANES.agencia = PLANES.promax;
PLANES.pro = PLANES.promax;
PLANES.basico = PLANES.promax;
