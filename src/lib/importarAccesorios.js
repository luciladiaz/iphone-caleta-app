import { convertirMoneda, faltaTipoCambio } from './moneda';

// Mismo patrón que importarStock.js, adaptado al modelo de datos de Accesorios: sin
// IMEI (no hay duplicado que chequear), sin proveedor/punto de venta, sin límite de
// plan (Accesorios no tiene tope por plan) y con la moneda canónica en ARS en vez de
// USD (así es como Accesorios.jsx guarda precioCosto/precioVenta).
const COLUMNAS = [
  { header: 'Nombre', variantes: ['nombre'], campo: 'nombre' },
  { header: 'Categoría', variantes: ['categoria'], campo: 'categoria' },
  { header: 'Modelo compatible', variantes: ['modelo compatible', 'modelo'], campo: 'modelo' },
  { header: 'Color / Variante', variantes: ['color variante', 'color', 'variante'], campo: 'color' },
  { header: 'Cantidad', variantes: ['cantidad'], campo: 'cantidad' },
  { header: 'Costo', variantes: ['costo'], campo: 'costoMonto' },
  { header: 'Moneda costo (ARS o USD)', variantes: ['moneda costo ars o usd', 'moneda costo'], campo: 'costoMoneda' },
  { header: 'Precio de venta', variantes: ['precio de venta'], campo: 'pvMonto' },
  { header: 'Moneda venta (ARS o USD)', variantes: ['moneda venta ars o usd', 'moneda venta'], campo: 'pvMoneda' },
];

const normalizar = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim().replace(/\s+/g, ' ');

export const FILA_EJEMPLO_ACCESORIOS = ['Funda silicona', 'Fundas', 'iPhone 13', 'Negro', '10', '2000', 'ARS', '5000', 'ARS'];

export function columnasPlantillaAccesorios() {
  return COLUMNAS.map(c => c.header);
}

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

// categoriasValidas: la lista fija de CATEGORIAS de Accesorios.jsx (a diferencia de
// Stock, acá no son configurables por negocio).
export function procesarFilasImportacionAccesorios({ filasCrudas, categoriasValidas, tipoCambio }) {
  return filasCrudas.map((filaCruda, i) => {
    const numeroFila = i + 2;
    const f = mapearFila(filaCruda);
    const notas = [];
    let error = null;

    if (!f.nombre) error = 'Falta el nombre.';

    let categoria = f.categoria;
    if (!error) {
      if (!categoria) {
        categoria = categoriasValidas[0];
        notas.push(`Sin categoría, se usó "${categoria}".`);
      } else {
        const match = categoriasValidas.find(c => normalizar(c) === normalizar(categoria));
        if (!match) error = `La categoría "${categoria}" no existe. Categorías válidas: ${categoriasValidas.join(', ')}.`;
        else categoria = match;
      }
    }

    let cantidad = null;
    if (!error) {
      const n = Number(f.cantidad);
      if (f.cantidad === '' || isNaN(n) || !Number.isInteger(n) || n <= 0) {
        error = 'Cantidad inválida (tiene que ser un número entero mayor a 0).';
      } else {
        cantidad = n;
      }
    }

    const costoMoneda = (f.costoMoneda || 'ARS').toUpperCase() === 'USD' ? 'USD' : 'ARS';
    const pvMoneda = (f.pvMoneda || 'ARS').toUpperCase() === 'USD' ? 'USD' : 'ARS';
    if (!error && (faltaTipoCambio(f.costoMonto, costoMoneda, 'ARS', tipoCambio) || faltaTipoCambio(f.pvMonto, pvMoneda, 'ARS', tipoCambio))) {
      error = 'Costo o precio de venta cargado en USD pero no hay tipo de cambio configurado (Configuración → tipo de cambio) -- se perdería el valor.';
    }

    const precioCosto = error ? 0 : convertirMoneda(f.costoMonto, costoMoneda, 'ARS', tipoCambio);
    const precioVenta = error ? 0 : convertirMoneda(f.pvMonto, pvMoneda, 'ARS', tipoCambio);

    return {
      numeroFila, error, notas,
      nombre: f.nombre, categoria, modelo: f.modelo, color: f.color, cantidad,
      costoMonto: f.costoMonto, costoMoneda, pvMonto: f.pvMonto, pvMoneda,
      precioCosto, precioVenta,
    };
  });
}
