// CRUD (solo edición, sin alta/baja) de los instructivos de "Integraciones
// IA" — mismo patrón exacto que adminCvTemplates.controller.js: las 3
// claves (chatgpt/claude/gemini) son fijas, ver
// backend/src/db/seeds/004_ai_integration_templates.js.
const aiIntegrationTemplateModel = require('../models/aiIntegrationTemplate.model');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const listar = asyncHandler(async (req, res) => {
  const plantillas = await aiIntegrationTemplateModel.listAll();
  res.json({ plantillas });
});

const actualizar = asyncHandler(async (req, res) => {
  const existente = await aiIntegrationTemplateModel.findByClave(req.params.clave);
  if (!existente) throw new AppError('Instructivo no encontrado', 404);

  const { nombre, instructivo_html, activo } = req.body;
  if (nombre !== undefined && !nombre.trim()) throw new AppError('El nombre no puede quedar vacío', 400);
  if (instructivo_html !== undefined && !instructivo_html.trim()) throw new AppError('El instructivo no puede quedar vacío', 400);

  const plantilla = await aiIntegrationTemplateModel.updateByClave(req.params.clave, { nombre, instructivo_html, activo });
  res.json({ plantilla });
});

module.exports = { listar, actualizar };
