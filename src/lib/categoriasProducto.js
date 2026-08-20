import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Categorías de producto que puede manejar el Stock (equipos individuales,
// no accesorios por cantidad). Cada categoría tiene su propia lista de
// modelos configurable desde Configuración > Modelos.
export const CATEGORIAS_STOCK = ['iPhone', 'iPad', 'Mac', 'Android', 'Drone'];

export const MODELOS_DEFAULT_POR_CATEGORIA = {
  iPhone: ['iPhone 12','iPhone 12 Pro','iPhone 12 Pro Max','iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 14','iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max'],
  iPad: ['iPad (10ª gen)','iPad (11ª gen)','iPad Air M2','iPad Air M3','iPad Pro 11" M4','iPad Pro 13" M4','iPad mini 7'],
  Mac: ['MacBook Air M2','MacBook Air M3','MacBook Air M4','MacBook Pro 14" M3','MacBook Pro 14" M4','MacBook Pro 16" M4','iMac M4','Mac mini M4','Mac Studio'],
  Android: ['Samsung Galaxy S23','Samsung Galaxy S24','Samsung Galaxy S25','Samsung Galaxy A54','Samsung Galaxy A55','Motorola Edge 50','Xiaomi Redmi Note 13','Google Pixel 9'],
  Drone: ['DJI Mini 3','DJI Mini 4 Pro','DJI Air 3','DJI Mavic 3','DJI Avata 2','DJI Neo'],
};

// Cómo se llama el identificador único de cada categoría (IMEI vs N° de serie).
export const ETIQUETA_ID_POR_CATEGORIA = {
  iPhone: 'IMEI',
  iPad: 'IMEI / N° de serie',
  Mac: 'N° de serie',
  Android: 'IMEI',
  Drone: 'N° de serie',
};

// Sugerencias de capacidad/specs por categoría (GB de almacenamiento para
// teléfonos/tablets, combo RAM+disco para Mac). El campo queda libre igual,
// esto solo autocompleta.
export const SUGERENCIAS_CAPACIDAD_POR_CATEGORIA = {
  iPhone: ['64','128','256','512','1TB'],
  iPad: ['64','128','256','512','1TB'],
  Android: ['128','256','512'],
  Mac: ['8GB RAM / 256GB SSD','16GB RAM / 512GB SSD','16GB RAM / 1TB SSD','24GB RAM / 512GB SSD','32GB RAM / 1TB SSD'],
  Drone: [],
};

export const EMOJI_POR_CATEGORIA = {
  iPhone: '📱',
  iPad: '📱',
  Mac: '💻',
  Android: '📱',
  Drone: '🛸',
};

// Los teléfonos/tablets guardan la capacidad como número plano ("128") y
// necesitan el sufijo GB; Mac/Drone suelen cargar specs libres ("16GB RAM /
// 512GB SSD") que ya vienen con unidad y no hay que duplicar.
export const formatCapacidad = (gb) => gb && /^\d+$/.test(String(gb).trim()) ? `${gb}GB` : gb;

// Única fuente de verdad para "qué modelos tiene cada categoría", usada por
// Configuración, Stock y Accesorios por igual — antes cada pantalla decidía por su
// cuenta cuándo mostrar la lista guardada y cuándo mostrar los defaults (con reglas
// levemente distintas entre sí), lo que hacía que una categoría pareciera "vacía" en
// una pantalla y "llena" en otra para el mismo negocio.
//
// La primera vez que se lee una categoría que nunca se tocó (la clave ni existe en
// Firestore) se la completa con esta lista de referencia y ESA se guarda de una — a
// partir de ahí ya es la lista real del negocio, no un valor inventado al vuelo. Si
// el negocio la vacía a propósito más adelante, se respeta ese vacío (no se vuelve a
// rellenar sola).
export async function cargarModelosPorCategoria(negocioId, categorias, modelosLegacyIphone) {
  const cfgRef = doc(db, 'negocios', negocioId, 'config', 'general');
  const cfgSnap = await getDoc(cfgRef);
  const guardado = (cfgSnap.data() || {}).modelosPorCategoria || {};

  const resultado = {};
  const aSembrar = {};
  for (const cat of categorias) {
    if (guardado[cat] !== undefined) {
      resultado[cat] = guardado[cat];
    } else {
      const semilla = (cat === 'iPhone' && modelosLegacyIphone?.length) ? modelosLegacyIphone : (MODELOS_DEFAULT_POR_CATEGORIA[cat] || []);
      resultado[cat] = semilla;
      aSembrar[cat] = semilla;
    }
  }
  if (Object.keys(aSembrar).length > 0) {
    await setDoc(cfgRef, { modelosPorCategoria: { ...guardado, ...aSembrar } }, { merge: true });
  }
  return resultado;
}
