const MAPA_ENDPOINTS = {
  blue:    'blue',
  oficial: 'oficial',
  mep:     'bolsa', // dolarapi.com llama "bolsa" al MEP
};

export default async function handler(req, res) {
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
