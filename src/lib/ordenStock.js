// Comparador de orden de stock, compartido entre Stock.jsx (donde se elige) y
// CatalogoPublico.jsx (donde tiene que verse igual) -- antes cada uno tenía su propia
// copia o directamente no ordenaba nada, así que el cliente veía el catálogo en un
// orden distinto al que el vendedor había elegido en su pantalla.
export const fechaMs = (f) => {
  if (!f) return 0;
  const d = f.toDate ? f.toDate() : new Date(f);
  return d.getTime();
};

export function comparadorOrden(orden) {
  return (a, b) => {
    if (orden === 'fecha_asc') return fechaMs(a.fechaIngreso) - fechaMs(b.fechaIngreso);
    if (orden === 'modelo_asc') return (a.modelo || '').localeCompare(b.modelo || '');
    if (orden === 'modelo_desc') return (b.modelo || '').localeCompare(a.modelo || '');
    if (orden === 'precio_asc') return Number(a.pvUsd || 0) - Number(b.pvUsd || 0);
    if (orden === 'precio_desc') return Number(b.pvUsd || 0) - Number(a.pvUsd || 0);
    if (orden === 'bateria_asc') return Number(a.bateria || 0) - Number(b.bateria || 0);
    if (orden === 'bateria_desc') return Number(b.bateria || 0) - Number(a.bateria || 0);
    return fechaMs(b.fechaIngreso) - fechaMs(a.fechaIngreso); // fecha_desc (default)
  };
}
