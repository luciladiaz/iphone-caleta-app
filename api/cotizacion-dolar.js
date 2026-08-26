import { limitado } from './_rateLimit.js';

const MAPA_ENDPOINTS = {
  blue:    'blue',
  oficial: 'oficial',
  mep:     'bolsa', // dolarapi.com llama "bolsa" al MEP
};

export default async function handler(req, res) {
  // Sin login y con `Cache-Control: s-maxage=300` (Vercel ya cachea la respuesta 5
  // minutos), así que esto es más que nada para frenar un abuso directo del endpoint que
  // se salte la cache — no hace falta un límite agresivo.
  if (limitado(req, { ventanaMs: 60_000, maximo: 60 })) {
    return res.status(429).json({ error: 'Demasiados pedidos. Probá de nuevo en un minuto.' });
  }

  const tipo = req.query.tipo;
  const endpoint = MAPA_ENDPOINTS[tipo];

  if (!endpoint) {
    return res.status(400).json({ error: 'Tipo de dólar inválido' });
  }

  try {
    const response = await fetch(`https://dolarapi.com/v1/dolares/${endpoint}`);
    if (!response.ok) throw new Error(`dolarapi ${response.status}`);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: `No se pudo obtener la cotización: ${err.message}` });
  }
}
