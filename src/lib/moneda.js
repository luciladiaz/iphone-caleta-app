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

// Detecta el caso en que convertirMoneda() va a devolver 0 por falta de tipo de cambio
// (monto cargado en una moneda distinta a la canónica del campo, sin TC para convertirlo)
// — se usa ANTES de guardar, para frenar y avisar en vez de persistir un 0 que borra
// silenciosamente el valor que la usuaria tipeó.
export function faltaTipoCambio(monto, moneda, monedaCanonica, tipoCambio) {
  return Number(monto) > 0 && moneda !== monedaCanonica && !(Number(tipoCambio) > 0);
}
