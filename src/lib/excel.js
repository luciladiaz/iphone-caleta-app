import * as XLSX from 'xlsx';

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
