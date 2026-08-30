// Normaliza un teléfono argentino cargado en cualquier formato común (con 0 de código
// de área, 15 de celular, con o sin 54/9) al formato que WhatsApp necesita en el link
// wa.me: 549 + código de área + número.
export function numeroWhatsapp(telefono) {
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('0')) n = n.slice(1);
  if (n.startsWith('15')) n = n.slice(2);
  if (n.startsWith('54')) n = n.slice(2);
  if (n.startsWith('9')) n = n.slice(1);
  return `549${n}`;
}
