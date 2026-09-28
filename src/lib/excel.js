import * as XLSX from 'xlsx';

// Lee un .xlsx elegido por el usuario y devuelve las filas de la primera hoja como
// array de objetos {encabezado: valor}, usando la fila 1 como encabezados. Se usa
// para la importación masiva de stock (Stock.jsx) -- hasta ahora la app solo
// escribía Excel, esta es la primera vez que necesita leer uno.
export async function leerExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const primeraHoja = wb.Sheets[wb.SheetNames[0]];
  if (!primeraHoja) return [];
  // defval: '' para que una celda vacía dé '' y no directamente falte la clave --
  // si no, una fila con la columna Notas vacía no tendría ni siquiera `notas: ''`.
  return XLSX.utils.sheet_to_json(primeraHoja, { defval: '' });
}

// Genera y descarga un .xlsx con una o más hojas. Cada hoja es { nombre, filas,
// anchoColumnas? } donde `filas` es un array de arrays (la primera fila son los
// encabezados) — los números quedan como celdas numéricas de verdad (no texto), así
// se pueden sumar/graficar en Excel sin conversiones ni problemas de coma/punto.
export function descargarExcel(nombreArchivo, hojas) {
  const wb = XLSX.utils.book_new();
  for (const { nombre, filas, anchoColumnas } of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(filas);
    if (anchoColumnas) ws['!cols'] = anchoColumnas.map(w => ({ wch: w }));
    // Un nombre de hoja de Excel no puede pasar 31 caracteres ni tener : \ / ? * [ ].
    const nombreHoja = nombre.replace(/[:\\/?*[\]]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  }
  XLSX.writeFile(wb, nombreArchivo);
}
