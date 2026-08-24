// Convierte un string "YYYY-MM-DD" (el que devuelve un <input type="date">) a medianoche
// en hora LOCAL. `new Date("YYYY-MM-DD")` se interpreta como medianoche UTC — en Argentina
// (UTC-3) eso cae el día anterior a las 21hs, así que una fecha cargada a mano como "hoy"
// terminaba agrupada como "ayer" en los reportes de Caja, o una cuota vencía un día antes
// de lo real. Se usa en todo lado donde se lee un <input type="date"> a mano.
export function fechaLocalDesdeInput(str) {
  if (!str) return null;
  const [anio, mes, dia] = str.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

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
