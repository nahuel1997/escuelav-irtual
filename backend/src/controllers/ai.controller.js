const aiIntegrationTemplateModel = require('../models/aiIntegrationTemplate.model');
const aiLinkModel = require('../models/aiLink.model');
const aiConversationModel = require('../models/aiConversation.model');
const aiMessageModel = require('../models/aiMessage.model');
const aiGptModel = require('../models/aiGpt.model');
const { CATALOGO, clavesValidas, getConfig } = require('../config/aiProviders');
const { getMotor } = require('../services/aiChat');
const { encriptar, desencriptar } = require('../utils/crypto');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Últimos 4 caracteres nomás — ni siquiera guardamos el prefijo completo,
// para no darle ninguna pista extra a quien mire la base sobre el resto
// de la key real.
function armarPreview(apiKey) {
  const limpio = String(apiKey).trim();
  return limpio.length > 4 ? `••••${limpio.slice(-4)}` : '••••';
}

// GET /ai/proveedores — fuente de la pestaña "Vinculaciones": las 3 IAs
// con su instructivo (editable por el admin, ver
// adminAiTemplates.controller.js) y si el alumno ya la vinculó. Un
// instructivo desactivado por el admin no se manda (queda la sección sin
// contenido en vez de romper el desplegable).
const listarProveedores = asyncHandler(async (req, res) => {
  const [templates, links] = await Promise.all([
    aiIntegrationTemplateModel.listAll(),
    aiLinkModel.listForUser(req.user.id),
  ]);
  const proveedores = CATALOGO.map((p) => {
    const template = templates.find((t) => t.clave === p.clave);
    const link = links.find((l) => l.proveedor === p.clave);
    return {
      clave: p.clave,
      nombre: p.nombre,
      docsUrl: p.docsUrl,
      instructivoHtml: template?.activo ? template.instructivo_html : '',
      vinculado: !!link?.activo,
      apiKeyPreview: link?.activo ? link.apiKeyPreview : null,
    };
  });
  res.json({ proveedores });
});

// POST /ai/vinculaciones/:proveedor — guarda (cifrada) la API key propia
// del alumno. No la validamos contra el proveedor real acá (eso
// significaría gastar una llamada/costo solo para confirmar el formato):
// si la key es inválida, el primer mensaje que mande en "Chats" va a
// fallar con un error claro (ver mandarMensaje más abajo).
const vincular = asyncHandler(async (req, res) => {
  const { proveedor } = req.params;
  const { apiKey } = req.body;
  if (!clavesValidas().includes(proveedor)) throw new AppError('IA desconocida', 404);
  if (!apiKey || !apiKey.trim()) throw new AppError('Falta la API key', 400);

  const link = await aiLinkModel.vincular(req.user.id, proveedor, {
    apiKeyEncriptada: encriptar(apiKey.trim()),
    apiKeyPreview: armarPreview(apiKey),
  });
  res.json({ link });
});

const desvincular = asyncHandler(async (req, res) => {
  const { proveedor } = req.params;
  if (!clavesValidas().includes(proveedor)) throw new AppError('IA desconocida', 404);
  await aiLinkModel.desvincular(req.user.id, proveedor);
  res.json({ ok: true });
});

// GET /ai/conversaciones — pestaña "Registros" (todas) y panel izquierdo
// de "Chats" (filtrado por ?proveedor=). SOLO devuelve conversaciones de
// IAs vinculadas HOY: si el alumno desvinculó una, sus chats viejos no se
// borran (ver aiLink.model.js::desvincular) pero dejan de listarse acá
// hasta que la vuelva a vincular — es el criterio de permisos pedido
// ("los no vinculados no se pueden ver").
const listarConversaciones = asyncHandler(async (req, res) => {
  const { proveedor } = req.query;
  const links = await aiLinkModel.listForUser(req.user.id);
  const proveedoresVinculados = links.filter((l) => l.activo).map((l) => l.proveedor);

  if (proveedor && !proveedoresVinculados.includes(proveedor)) {
    return res.json({ conversaciones: [] });
  }

  const conversaciones = await aiConversationModel.listForUser(req.user.id, proveedor ? { proveedor } : {});
  const visibles = conversaciones.filter((c) => proveedoresVinculados.includes(c.proveedor));
  res.json({ conversaciones: visibles });
});

// POST /ai/conversaciones — acepta {proveedor} (chat normal) o {gptId}
// (chat "con" uno de los GPTs propios del alumno, ver aiGpt.model.js). Si
// viene gptId, el proveedor se DERIVA del GPT (se ignora cualquier
// proveedor que venga junto) y se congela el system prompt combinado del
// GPT en ese momento — ver el comentario de sistema_prompt en la
// migración alter_ai_conversations_add_gpt sobre por qué es una foto y no
// una referencia viva.
const crearConversacion = asyncHandler(async (req, res) => {
  const { proveedor, titulo, gptId } = req.body;

  let proveedorFinal = proveedor;
  let gpt = null;
  if (gptId) {
    gpt = await aiGptModel.getByIdForUser(gptId, req.user.id);
    if (!gpt) throw new AppError('GPT no encontrado', 404);
    proveedorFinal = gpt.proveedor;
  }

  if (!clavesValidas().includes(proveedorFinal)) throw new AppError('IA desconocida', 404);
  const link = await aiLinkModel.findConKeyParaUso(req.user.id, proveedorFinal);
  if (!link || !link.activo) throw new AppError('Vinculá tu cuenta antes de empezar a chatear', 409);

  const conversacion = await aiConversationModel.create(req.user.id, {
    proveedor: proveedorFinal,
    titulo: titulo || (gpt ? gpt.nombre : undefined),
    gptId: gpt?.id || null,
    sistemaPrompt: gpt ? aiGptModel.armarSistemaPrompt(gpt) : null,
  });
  res.status(201).json({ conversacion });
});

const borrarConversacion = asyncHandler(async (req, res) => {
  const existente = await aiConversationModel.getByIdForUser(req.params.id, req.user.id);
  if (!existente) throw new AppError('Conversación no encontrada', 404);
  await aiConversationModel.remove(req.params.id, req.user.id);
  res.json({ ok: true });
});

const listarMensajes = asyncHandler(async (req, res) => {
  const conversacion = await aiConversationModel.getByIdForUser(req.params.id, req.user.id);
  if (!conversacion) throw new AppError('Conversación no encontrada', 404);
  const mensajes = await aiMessageModel.listForConversation(conversacion.id);
  res.json({ conversacion, mensajes });
});

// POST /ai/conversaciones/:id/mensajes — el corazón de la pestaña
// "Chats": guarda el mensaje del alumno, le manda TODO el historial de la
// conversación a la IA real (con su propia API key, nunca la nuestra —
// ver services/aiChat/) para que tenga contexto, y guarda la respuesta.
// El mensaje del alumno se guarda ANTES de llamar a la IA: si la llamada
// falla (key inválida, sin crédito, rate limit) no se pierde lo que
// escribió, solo no hay respuesta todavía.
const mandarMensaje = asyncHandler(async (req, res) => {
  const { contenido } = req.body;
  if (!contenido || !contenido.trim()) throw new AppError('El mensaje no puede estar vacío', 400);

  const conversacion = await aiConversationModel.getByIdForUser(req.params.id, req.user.id);
  if (!conversacion) throw new AppError('Conversación no encontrada', 404);

  const link = await aiLinkModel.findConKeyParaUso(req.user.id, conversacion.proveedor);
  if (!link || !link.activo) throw new AppError('Vinculá tu cuenta antes de chatear', 409);

  const mensajeUsuario = await aiMessageModel.create(conversacion.id, { rol: 'user', contenido: contenido.trim() });
  await aiConversationModel.tocar(conversacion.id);

  const historial = await aiMessageModel.listForConversation(conversacion.id);
  const config = getConfig(conversacion.proveedor);
  const motor = getMotor(conversacion.proveedor);

  let texto;
  try {
    const apiKey = desencriptar(link.api_key_encriptada);
    const resultado = await motor.enviarMensaje({
      apiKey,
      modelo: config.modelo,
      mensajes: historial.map((m) => ({ rol: m.rol, contenido: m.contenido })),
      // Si esta conversación nació de un GPT propio, sistema_prompt trae
      // la FOTO de sus instrucciones+conocimiento (ver
      // aiConversation.model.js) — cada motor lo manda con el formato que
      // le corresponde a su proveedor (system role, campo "system", o
      // systemInstruction, ver services/aiChat/*.provider.js).
      sistema: conversacion.sistema_prompt || null,
    });
    texto = resultado.texto;
  } catch (err) {
    // No repetimos el error crudo del proveedor al alumno (podría traer
    // detalles internos que no aportan nada útil) — un mensaje genérico y
    // accionable alcanza: revisar la key/el crédito resuelve la gran
    // mayoría de estos casos. El detalle real queda en el log del
    // servidor para debug (ver error.middleware.js, pero esto es 4xx así
    // que ni siquiera llega ahí — lo logueamos acá aparte).
    console.error(`[ai.controller] falló la llamada a ${conversacion.proveedor}:`, err.message);
    throw new AppError(`No se pudo obtener respuesta de ${config.nombre}. Revisá que tu API key sea válida y tenga crédito disponible.`, 422);
  }

  const mensajeAsistente = await aiMessageModel.create(conversacion.id, { rol: 'assistant', contenido: texto });
  res.status(201).json({ mensajeUsuario, mensajeAsistente });
});

module.exports = {
  listarProveedores,
  vincular,
  desvincular,
  listarConversaciones,
  crearConversacion,
  borrarConversacion,
  listarMensajes,
  mandarMensaje,
};
