// Roles válidos de usuario. Centralizado acá porque desde la migración
// 20260821000009 la columna users.rol ya no tiene un CHECK a nivel de
// base de datos (ver esa migración) — la validación es responsabilidad
// de la aplicación.
//
// "soporte" se suma para el chat en vivo (ver chat_conversations /
// chat.controller.js / support.controller.js): es una cuenta que el admin
// da de alta igual que un profesor (POST /api/admin/users con rol
// "soporte", ya genérico — no hizo falta tocar ese endpoint), inicia
// sesión en /soporte/ingresar (login propio, mismo patrón que
// /admin-panel/ingresar) y no participa de nada del sitio público ni del
// panel de admin.
const ROLES = ['alumno', 'profesor', 'admin', 'soporte'];

function esRolValido(rol) {
  return ROLES.includes(rol);
}

module.exports = { ROLES, esRolValido };
