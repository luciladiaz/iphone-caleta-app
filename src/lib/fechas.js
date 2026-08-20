// Clave de mes en horario local (no UTC) — "2026-08" — usada para agrupar por mes
// tanto en Caja como en Ventas.
export function mesKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-08" -> "Agosto 2026"
export function mesLabel(key) {
  const [anio, mes] = key.split('-').map(Number);
  const nombre = MESES[mes - 1] || '';
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}
