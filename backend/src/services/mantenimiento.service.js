// Modo mantenimiento por rol (Admin → Configuración). Lo chequea
// requireAuth en cada request autenticado: un rol en mantenimiento recibe
// 503 con codigo MANTENIMIENTO y el frontend muestra la pantalla de
// mantenimiento. El admin nunca queda afuera; /api/auth/* sigue andando
// (para poder ver quién sos y cerrar sesión). Si se cargó "hasta" y ya
// pasó, el mantenimiento se considera terminado solo.
const configService = require('./config.service');
const { SECCIONES } = require('./configuracionSecciones');

async function estado() {
  const guardado = await configService.getJson('config.mantenimiento', null);
  return { ...SECCIONES.mantenimiento.porDefecto, ...(guardado || {}) };
}

async function bloqueaA(rol) {
  if (!rol || rol === 'admin') return null;
  const e = await estado();
  if (!e[rol]) return null;
  if (e.hasta && new Date(e.hasta) < new Date()) return null;
  return e;
}

module.exports = { estado, bloqueaA };
