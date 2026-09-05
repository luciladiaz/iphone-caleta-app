// DIAGNÓSTICO TEMPORAL -- borrar apenas se resuelva el caso de "Card token was generated
// without cvv validation". Consulta la metadata real de un card_token_id específico contra
// la API de MP (nunca expone el PAN completo ni el CVV, solo BIN/últimos 4/flags).
const MP_ACCESS_TOKEN = (process.env.MP_ACCESS_TOKEN || '').trim() || undefined;

export default async function handler(req, res) {
  const tokenId = req.query?.tokenId;
  if (!tokenId) return res.status(400).json({ error: 'Falta tokenId' });
  if (!MP_ACCESS_TOKEN) return res.status(500).json({ error: 'MercadoPago no configurado' });

  try {
    const r = await fetch(`https://api.mercadopago.com/v1/card_tokens/${tokenId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
