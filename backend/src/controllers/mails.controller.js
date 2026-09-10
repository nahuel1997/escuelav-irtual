// Controller del backoffice de mails (/admin-panel/mails): plantillas
// editables, configuración de umbrales, listas de mailing armables y
// registro de envíos. Todo detrás de requireRole('admin') (ver
// admin.routes.js, que monta esto igual que el resto de /api/admin/*).
const emailTemplateModel = require('../models/emailTemplate.model');
const appSettingModel = require('../models/appSetting.model');
const mailLogModel = require('../models/mailLog.model');
const mailingListModel = require('../models/mailingList.model');
const mailService = require('../services/mail.service');
const env = require('../config/env');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// --- Plantillas ---

const listTemplates = asyncHandler(async (req, res) => {
  const plantillas = await emailTemplateModel.listAll();
  res.json({ plantillas, modoEnvio: mailService.getModo() });
});

const updateTemplate = asyncHandler(async (req, res) => {
  const existente = await emailTemplateModel.findByClave(req.params.clave);
  if (!existente) throw new AppError('Plantilla no encontrada', 404);

  const { asunto, cuerpo_html, activo } = req.body;
  if (asunto !== undefined && !asunto.trim()) throw new AppError('El asunto no puede quedar vacío', 400);
  if (cuerpo_html !== undefined && !cuerpo_html.trim()) throw new AppError('El cuerpo del mail no puede quedar vacío', 400);

  const plantilla = await emailTemplateModel.updateByClave(req.params.clave, { asunto, cuerpo_html, activo });
  res.json({ plantilla });
});

// Manda un mail de prueba de una plantilla puntual, con valores de
// ejemplo en cada variable — para que el admin pueda ver cómo queda sin
// tener que disparar el flujo real (comprar un curso, pedir un turno...).
// Es lo que usa el botón "Probar" del editor y el panel de Testing.
const testSend = asyncHandler(async (req, res) => {
  const plantilla = await emailTemplateModel.findByClave(req.params.clave);
  if (!plantilla) throw new AppError('Plantilla no encontrada', 404);

  const destinatario = req.body.destinatario || req.user.email;
  const variables = {};
  (plantilla.variables_disponibles || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .forEach((nombre) => {
      // Valores de ejemplo legibles en vez de dejar la variable vacía —
      // así el mail de prueba se ve como se vería uno real.
      variables[nombre] = nombre.includes('link') ? `${env.FRONTEND_URL}/` : `[Ejemplo de "${nombre}"]`;
    });

  const resultado = await mailService.enviarMail({ clave: plantilla.clave, destinatario, variables, userId: req.user.id });
  if (!resultado.ok) throw new AppError(`No se pudo mandar el mail de prueba (${resultado.motivo || resultado.error})`, 500);
  res.json({ ok: true, previewUrl: resultado.previewUrl || null, modo: resultado.modo, redirigidoA: resultado.redirigidoA || null });
});

// --- Configuración (umbrales de los mails automáticos) ---

const listSettings = asyncHandler(async (req, res) => {
  const settings = await appSettingModel.listAll();
  res.json({ settings });
});

const updateSetting = asyncHandler(async (req, res) => {
  const { valor } = req.body;
  // Antes también rechazaba '' ("Falta el valor"), pero
  // mail_modo_prueba_destinatario justo necesita poder guardarse vacío
  // para apagarse (ver mail.service.js) — un valor vacío intencional es
  // válido, lo único que falta de verdad es el campo entero.
  if (valor === undefined || valor === null) throw new AppError('Falta el valor', 400);
  const settings = await appSettingModel.listAll();
  const existente = settings.find((s) => s.clave === req.params.clave);
  if (!existente) throw new AppError('Configuración no encontrada', 404);
  const actualizado = await appSettingModel.upsert(req.params.clave, valor);
  res.json({ setting: actualizado });
});

// --- Registro de envíos ---

const listLog = asyncHandler(async (req, res) => {
  const { tipo, estado, limit } = req.query;
  const envios = await mailLogModel.listAll({ tipo, estado, limit: limit ? Number(limit) : undefined });
  res.json({ envios });
});

// --- Listas de mailing ---

const listLists = asyncHandler(async (req, res) => {
  const listas = await mailingListModel.listAll();
  res.json({ listas });
});

const createList = asyncHandler(async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) throw new AppError('Falta el nombre de la lista', 400);
  const lista = await mailingListModel.create({ nombre, descripcion });
  res.status(201).json({ lista });
});

const updateList = asyncHandler(async (req, res) => {
  const existente = await mailingListModel.findById(req.params.id);
  if (!existente) throw new AppError('Lista no encontrada', 404);
  const lista = await mailingListModel.update(req.params.id, req.body);
  res.json({ lista });
});

const deleteList = asyncHandler(async (req, res) => {
  const existente = await mailingListModel.findById(req.params.id);
  if (!existente) throw new AppError('Lista no encontrada', 404);
  await mailingListModel.remove(req.params.id);
  res.json({ ok: true });
});

const listMembers = asyncHandler(async (req, res) => {
  const existente = await mailingListModel.findById(req.params.id);
  if (!existente) throw new AppError('Lista no encontrada', 404);
  const miembros = await mailingListModel.listMembers(req.params.id);
  const disponibles = await mailingListModel.listDisponibles(req.params.id);
  res.json({ miembros, disponibles });
});

const addMember = asyncHandler(async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) throw new AppError('Falta el usuario a agregar', 400);
  await mailingListModel.addMember(req.params.id, user_id);
  res.status(201).json({ miembros: await mailingListModel.listMembers(req.params.id) });
});

// "Seleccionar todos": agrega de una todos los alumnos/profesores que
// todavía no están en la lista.
const addTodos = asyncHandler(async (req, res) => {
  const cantidad = await mailingListModel.addTodosLosDisponibles(req.params.id);
  res.status(201).json({ agregados: cantidad, miembros: await mailingListModel.listMembers(req.params.id) });
});

const removeMember = asyncHandler(async (req, res) => {
  await mailingListModel.removeMember(req.params.id, req.params.userId);
  res.json({ miembros: await mailingListModel.listMembers(req.params.id) });
});

// "Quitar todos": vacía la lista de miembros sin borrar la lista.
const removeTodos = asyncHandler(async (req, res) => {
  await mailingListModel.removeTodos(req.params.id);
  res.json({ miembros: [] });
});

// Manda el mail de oferta/aviso (plantilla fija 'oferta_aviso') a todos
// los miembros de la lista, con el asunto/mensaje que decide el admin en
// el momento — así una misma plantilla sirve tanto para "Black Friday"
// como para "corte de mantenimiento programado".
const sendToList = asyncHandler(async (req, res) => {
  const lista = await mailingListModel.findById(req.params.id);
  if (!lista) throw new AppError('Lista no encontrada', 404);

  const { titulo, mensaje } = req.body;
  if (!titulo || !mensaje) throw new AppError('Faltan el título y/o el mensaje del envío', 400);

  const miembros = await mailingListModel.listMembers(req.params.id);
  if (miembros.length === 0) throw new AppError('La lista no tiene miembros todavía', 400);

  let enviados = 0;
  for (const m of miembros) {
    const resultado = await mailService.enviarMail({
      clave: 'oferta_aviso',
      destinatario: m.email,
      variables: { nombre: m.nombre, titulo, mensaje, link_tienda: `${env.FRONTEND_URL}/tienda` },
      userId: m.id,
      mailingListId: lista.id,
    });
    if (resultado.ok) enviados += 1;
  }

  res.json({ ok: true, enviados, total: miembros.length });
});

module.exports = {
  listTemplates,
  updateTemplate,
  testSend,
  listSettings,
  updateSetting,
  listLog,
  listLists,
  createList,
  updateList,
  deleteList,
  listMembers,
  addMember,
  addTodos,
  removeMember,
  removeTodos,
  sendToList,
};
