// Admin → Configuración (mantenimiento, páginas de error, modo oscuro,
// feriados, logo de mails) y el estado público que lee el frontend al
// arrancar. Ver services/configuracionSecciones.js.
const configService = require('../services/config.service');
const { SECCIONES } = require('../services/configuracionSecciones');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

async function leerSeccion(nombre) {
  const def = SECCIONES[nombre];
  const guardado = await configService.getJson(`config.${nombre}`, null);
  return { ...def.porDefecto, ...(guardado || {}) };
}

const listar = asyncHandler(async (req, res) => {
  const secciones = {};
  for (const nombre of Object.keys(SECCIONES)) secciones[nombre] = await leerSeccion(nombre);
  res.json({ secciones });
});

const guardar = asyncHandler(async (req, res) => {
  const def = SECCIONES[req.params.seccion];
  if (!def) throw new AppError('Sección de configuración desconocida', 404);
  const valor = def.validar(req.body || {});
  await configService.set(`config.${req.params.seccion}`, valor);
  res.json({ valor });
});

// GET /api/estado-publico — sin login: lo que el frontend necesita saber
// antes de mostrar nada (si el rol está en mantenimiento, los textos de
// las páginas de error, el modo oscuro, los feriados).
const estadoPublico = asyncHandler(async (req, res) => {
  const estado = {};
  for (const [nombre, def] of Object.entries(SECCIONES)) {
    if (def.publica) estado[nombre] = await leerSeccion(nombre);
  }
  // Habilitación de pantallas (para el menú y el cartel de "en reparación").
  estado.pantallas = await require('../services/pantallas.service').estados();
  res.set('Cache-Control', 'no-store');
  res.json(estado);
});

module.exports = { listar, guardar, estadoPublico, leerSeccion };
