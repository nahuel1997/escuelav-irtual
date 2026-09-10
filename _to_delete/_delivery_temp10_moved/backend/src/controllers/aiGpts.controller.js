const aiGptModel = require('../models/aiGpt.model');
const { clavesValidas } = require('../config/aiProviders');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// CRUD de los "GPTs" propios del alumno (sección "GPTs" del menú lateral,
// separada de "Integraciones IA" — ver Sidebar.jsx). Ver la migración
// create_ai_gpts para la explicación completa de por qué esto es un
// equivalente propio y no una integración real con los Custom
// GPTs/Proyectos/Gems de cada proveedor: no existe API pública de
// OpenAI/Anthropic/Google para crear esas cosas con una simple API key.
// El único lugar donde un GPT "hace algo" de verdad es al crear una
// conversación con gptId (ver ai.controller.js::crearConversacion) — acá
// solo se administra el catálogo del alumno.
const listar = asyncHandler(async (req, res) => {
  const gpts = await aiGptModel.listForUser(req.user.id);
  res.json({ gpts });
});

const crear = asyncHandler(async (req, res) => {
  const { proveedor, nombre, instrucciones, conocimiento } = req.body;
  if (!clavesValidas().includes(proveedor)) throw new AppError('IA desconocida', 404);
  if (!nombre || !nombre.trim()) throw new AppError('Falta el nombre del GPT', 400);
  if (!instrucciones || !instrucciones.trim()) throw new AppError('Faltan las instrucciones del GPT', 400);

  const gpt = await aiGptModel.create(req.user.id, { proveedor, nombre, instrucciones, conocimiento });
  res.status(201).json({ gpt });
});

const actualizar = asyncHandler(async (req, res) => {
  const existente = await aiGptModel.getByIdForUser(req.params.id, req.user.id);
  if (!existente) throw new AppError('GPT no encontrado', 404);

  const { proveedor, nombre, instrucciones, conocimiento } = req.body;
  if (proveedor && !clavesValidas().includes(proveedor)) throw new AppError('IA desconocida', 404);
  if (!nombre || !nombre.trim()) throw new AppError('Falta el nombre del GPT', 400);
  if (!instrucciones || !instrucciones.trim()) throw new AppError('Faltan las instrucciones del GPT', 400);

  // Editar un GPT NUNCA toca las conversaciones que ya arrancaron con él
  // — su sistema_prompt quedó congelado en ai_conversations al crearlas
  // (ver aiConversation.model.js). Solo las conversaciones nuevas usan la
  // versión editada.
  const gpt = await aiGptModel.update(req.params.id, req.user.id, {
    proveedor: proveedor || existente.proveedor,
    nombre,
    instrucciones,
    conocimiento,
  });
  res.json({ gpt });
});

const borrar = asyncHandler(async (req, res) => {
  const existente = await aiGptModel.getByIdForUser(req.params.id, req.user.id);
  if (!existente) throw new AppError('GPT no encontrado', 404);
  await aiGptModel.remove(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = { listar, crear, actualizar, borrar };
