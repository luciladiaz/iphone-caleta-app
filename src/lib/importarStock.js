import { convertirMoneda, faltaTipoCambio } from './moneda';

// Encabezados de la plantilla, en el orden en que se descargan. Cada uno tiene una o
// más variantes aceptadas al leer de vuelta el Excel (normalizadas: sin acentos,
// minúsculas, espacios colapsados) -- así si alguien borra un acento sin querer, o
// escribe "Gb" en vez de "GB", igual se reconoce la columna.
const COLUMNAS = [
  { header: 'Categoría', variantes: ['categoria'], campo: 'categoria' },
  { header: 'Modelo', variantes: ['modelo'], campo: 'modelo' },
  { header: 'Color', variantes: ['color'], campo: 'color' },
  { header: 'GB / Capacidad', variantes: ['gb capacidad', 'gb', 'capacidad'], campo: 'gb' },
  { header: 'Batería %', variantes: ['bateria', 'bateria %'], campo: 'bateria' },
  { header: 'IMEI o Serie', variantes: ['imei o serie', 'imei', 'serie'], campo: 'imei' },
  { header: 'Proveedor', variantes: ['proveedor'], campo: 'proveedor' },
  { header: 'Costo', variantes: ['costo'], campo: 'costoMonto' },
  { header: 'Moneda costo (USD o ARS)', variantes: ['moneda costo usd o ars', 'moneda costo'], campo: 'costoMoneda' },
  { header: 'Precio de venta', variantes: ['precio de venta'], campo: 'pvMonto' },
  { header: 'Moneda venta (USD o ARS)', variantes: ['moneda venta usd o ars', 'moneda venta'], campo: 'pvMoneda' },
  { header: 'Punto de venta', variantes: ['punto de venta'], campo: 'puntoVenta' },
  { header: 'Notas', variantes: ['notas'], campo: 'notas' },
];

const normalizar = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca acentos
  .toLowerCase().trim().replace(/\s+/g, ' ');

export const FILA_EJEMPLO = ['iPhone', 'iPhone 13', 'Azul', '128', '91', '355012345678901', 'Proveedor Ejemplo', '400', 'USD', '600', 'USD', 'Local Caleta', 'Opcional: cualquier aclaración'];

export function columnasPlantilla() {
  return COLUMNAS.map(c => c.header);
}

// Arma el objeto {campo: valor} de una fila del Excel, sea cual sea el orden/mayúsculas
// exactas de sus encabezados (siempre que coincidan con alguna variante conocida).
function mapearFila(filaCruda) {
  const porNormalizado = {};
  for (const [header, valor] of Object.entries(filaCruda)) {
    porNormalizado[normalizar(header)] = valor;
  }
  const fila = {};
  for (const { variantes, campo } of COLUMNAS) {
    const key = variantes.find(v => v in porNormalizado);
    fila[campo] = key !== undefined ? String(porNormalizado[key] ?? '').trim() : '';
  }
  return fila;
}

// Procesa TODAS las filas leídas del Excel contra el estado actual de la app (stock ya
// cargado, categorías, proveedores, puntos de venta, tipo de cambio, cupo del plan) y
// devuelve cada fila enriquecida con lo que se va a guardar + errores/avisos, sin tocar
// todavía Firestore -- pensado para mostrar una vista previa antes de confirmar.
export function procesarFilasImportacion({ filasCrudas, categoriasProducto, proveedores, puntosVenta, equipos, tipoCambio, cupoDisponible }) {
  const nombresProveedor = new Set(proveedores.map(p => normalizar(p.nombre)));
  const nombresPuntoVenta = new Set(puntosVenta.map(p => normalizar(p.nombre)));
  const imeisExistentes = new Set(equipos.filter(e => e.estado !== 'vendido' && e.imei).map(e => e.imei.trim().toLowerCase()));
  const imeisEnArchivo = new Set();
  let cupo = cupoDisponible;

  return filasCrudas.map((filaCruda, i) => {
    const numeroFila = i + 2; // +1 por el encabezado, +1 porque Excel arranca en 1
    const f = mapearFila(filaCruda);
    const notas = [];
    let error = null;

    if (!f.modelo) error = 'Falta el modelo.';

    let categoria = f.categoria;
    if (!error) {
      if (!categoria) {
        categoria = categoriasProducto[0];
        notas.push(`Sin categoría, se usó "${categoria}".`);
      } else {
        const match = categoriasProducto.find(c => normalizar(c) === normalizar(categoria));
        if (!match) error = `La categoría "${categoria}" no existe (creála antes en Configuración, o dejá la celda vacía). Categorías válidas: ${categoriasProducto.join(', ')}.`;
        else categoria = match;
      }
    }

    const imei = f.imei;
    if (!error && imei) {
      const clave = imei.toLowerCase();
      if (imeisExistentes.has(clave)) error = `Ya hay un equipo activo en stock con este mismo IMEI/serie (${imei}).`;
      else if (imeisEnArchivo.has(clave)) error = `IMEI/serie repetido dentro del mismo archivo (${imei}).`;
      else imeisEnArchivo.add(clave);
    }

    const costoMoneda = (f.costoMoneda || 'USD').toUpperCase() === 'ARS' ? 'ARS' : 'USD';
    const pvMoneda = (f.pvMoneda || 'USD').toUpperCase() === 'ARS' ? 'ARS' : 'USD';
    if (!error && (faltaTipoCambio(f.costoMonto, costoMoneda, 'USD', tipoCambio) || faltaTipoCambio(f.pvMonto, pvMoneda, 'USD', tipoCambio))) {
      error = 'Costo o precio de venta cargado en ARS pero no hay tipo de cambio configurado (Configuración → tipo de cambio) -- se perdería el valor.';
    }

    let proveedorFinal = f.proveedor;
    let nuevoProveedor = false;
    if (!error && proveedorFinal && !nombresProveedor.has(normalizar(proveedorFinal))) {
      nuevoProveedor = true;
      nombresProveedor.add(normalizar(proveedorFinal)); // así dos filas con el mismo proveedor nuevo no lo duplican
      notas.push(`Se va a crear el proveedor "${proveedorFinal}" en Configuración.`);
    }

    let puntoVentaFinal = f.puntoVenta;
    let nuevoPuntoVenta = false;
    if (!error && puntoVentaFinal && !nombresPuntoVenta.has(normalizar(puntoVentaFinal))) {
      nuevoPuntoVenta = true;
      nombresPuntoVenta.add(normalizar(puntoVentaFinal));
      notas.push(`Se va a crear el punto de venta "${puntoVentaFinal}" en Configuración.`);
    }

    if (!error && cupo <= 0) {
      error = 'No entra: se alcanzó el límite de equipos de tu plan.';
    }

    const costoUsd = error ? 0 : convertirMoneda(f.costoMonto, costoMoneda, 'USD', tipoCambio);
    const pvUsd = error ? 0 : convertirMoneda(f.pvMonto, pvMoneda, 'USD', tipoCambio);
    if (!error) cupo -= 1;

    return {
      numeroFila, error, notas,
      categoria, modelo: f.modelo, color: f.color, gb: f.gb, bateria: f.bateria, imei,
      proveedor: proveedorFinal, nuevoProveedor, puntoVenta: puntoVentaFinal, nuevoPuntoVenta,
      costoMonto: f.costoMonto, costoMoneda, pvMonto: f.pvMonto, pvMoneda, notasEquipo: f.notas,
      costoUsd, pvUsd,
    };
  });
}
