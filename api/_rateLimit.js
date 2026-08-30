// Límite de pedidos "a las patadas" por IP, en memoria del propio proceso de la función
// serverless. OJO: no es un límite distribuido — cada instancia de Vercel (y cada cold
// start) tiene su propio contador, así que bajo tráfico real repartido entre varias
// instancias el límite efectivo es más laxo que `maximo`. Para algo robusto de verdad
// hace falta un store compartido (Upstash/Vercel KV), pero eso implica sumar un servicio
// nuevo — esto alcanza para frenar un loop roto, un scraping bobo o un bot básico
// pegándole en tanda a un endpoint público sin login.
const registros = new Map();
let llamadas = 0;

function ipReal(req) {
  // x-real-ip lo pone el propio edge de Vercel (no lo puede pisar quien hace el
  // request). x-forwarded-for SÍ puede venir seteado a mano por el cliente -- y si viene
  // con varios saltos ("cliente, proxy1, proxy2"), el PRIMER valor es el que el cliente
  // controla directamente; el ÚLTIMO es el salto más cercano al edge de Vercel, más
  // confiable. Antes se tomaba el primero, así que alcanzaba con mandar un
  // X-Forwarded-For distinto en cada request para evadir el límite por completo.
  if (req.headers['x-real-ip']) return req.headers['x-real-ip'];
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const partes = xff.split(',').map(p => p.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }
  return req.socket?.remoteAddress || 'desconocido';
}

export function limitado(req, { ventanaMs = 60_000, maximo = 30 } = {}) {
  const ip = ipReal(req);
  const ahora = Date.now();

  // Poda periódica para no dejar crecer el mapa sin límite con IPs viejas.
  llamadas++;
  if (llamadas % 500 === 0) {
    for (const [clave, r] of registros) {
      if (ahora - r.inicio > ventanaMs) registros.delete(clave);
    }
  }

  const registro = registros.get(ip);
  if (!registro || ahora - registro.inicio > ventanaMs) {
    registros.set(ip, { inicio: ahora, cantidad: 1 });
    return false;
  }
  registro.cantidad++;
  return registro.cantidad > maximo;
}
