export default async function handler(req, res) {
  const TIPOS_VALIDOS = ['blue', 'oficial', 'mep'];
  const tipo = req.query.tipo;

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de dólar inválido' });
  }

  try {
    const response = await fetch(`https://dolarapi.com/v1/dolares/${tipo}`);
    if (!response.ok) throw new Error(`dolarapi ${response.status}`);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300'); // cache 5 min en Vercel
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: `No se pudo obtener la cotización: ${err.message}` });
  }
}
