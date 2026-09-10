// Controller del editor de plantillas de "CV para IA" (/admin-panel/cv-ia)
// — mismo patrón que las Plantillas de mail (mails.controller.js): editar
// nombre/html/activo de una plantilla existente por su clave fija, nunca
// crear una nueva a mano. Montado bajo /api/admin/* (ver admin.routes.js),
// que ya exige rol admin para todo el router.
const cvAiTemplateModel = require('../models/cvAiTemplate.model');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const listar = asyncHandler(async (req, res) => {
  const plantillas = await cvAiTemplateModel.listAll();
  res.json({ plantillas });
});

const actualizar = asyncHandler(async (req, res) => {
  const existente = await cvAiTemplateModel.findByClave(req.params.clave);
  if (!existente) throw new AppError('Plantilla no encontrada', 404);

  const { nombre, html, activo } = req.body;
  if (nombre !== undefined && !nombre.trim()) throw new AppError('El nombre no puede quedar vacío', 400);
  if (html !== undefined && !html.trim()) throw new AppError('El HTML no puede quedar vacío', 400);

  const plantilla = await cvAiTemplateModel.updateByClave(req.params.clave, { nombre, html, activo });
  res.json({ plantilla });
});

module.exports = { listar, actualizar };
