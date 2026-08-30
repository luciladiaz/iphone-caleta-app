// Normaliza texto para comparar/buscar ignorando mayusculas y tildes -- sin esto,
// buscar "Perez" no encontraba a "Perez" con tilde ya cargado, y eso llevaba a crear
// clientes duplicados en vez de reusar el existente. Recorre los code points en vez de
// usar una regex con rango unicode literal para evitar problemas de encoding del rango
// de diacríticos combinantes (U+0300-U+036F) al guardar/leer el archivo.
export function normalizarTexto(s) {
  const base = (s || '').toLowerCase().normalize('NFD');
  let out = '';
  for (const ch of base) {
    const code = ch.codePointAt(0);
    if (code >= 0x0300 && code <= 0x036f) continue;
    out += ch;
  }
  return out;
}
