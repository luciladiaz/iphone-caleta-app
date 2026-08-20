// Convierte un monto entre ARS y USD usando el tipo de cambio de Configuración.
// Si se pide convertir a la misma moneda en la que ya está, lo devuelve tal cual
// (sin necesitar tipo de cambio). Si no hay tipo de cambio cargado y hace falta
// convertir, devuelve 0 en vez de un valor inventado.
export function convertirMoneda(monto, desde, hacia, tipoCambio) {
  const m = Number(monto) || 0;
  if (desde === hacia) return m;
  const tc = Number(tipoCambio) || 0;
  if (!tc) return 0;
  return desde === 'ARS' ? m / tc : m * tc;
}
