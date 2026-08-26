// Firebase Auth por sí solo solo exige 6 caracteres sin ningún otro requisito. Esto es
// una validación del lado del cliente (no un límite duro a nivel de Firebase): alguien
// que le pegue directo a la API de Auth podría saltearla — pero frena el caso normal de
// elegir sin querer una contraseña débil al crear una cuenta o un vendedor nuevo.
export function errorPassword(password) {
  if (!password || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'La contraseña debe combinar letras y números.';
  return null;
}
