// Panel de soporte (/soporte): lista de conversaciones y el historial de
// cada una, solo lectura por REST — responder es por socket (ver
// realtime/chatSocket.js). Todo detrás de requireRole('soporte') (ver
// support.routes.js).
const chatConversationModel = require('../models/chatConversation.model');
const chatMessageModel = require('../models/chatMessage.model');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Cola compartida: cualquier agente de soporte ve TODAS las conversaciones
// (no hay asignación exclusiva), filtrable por estado para separar
// "abiertos" (para atender) de "cerrados" (historial).
const listConversaciones = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const conversaciones = await chatConversationModel.listConDetalle({ estado });
  res.json({ conversaciones });
});

const listMensajes = asyncHandler(async (req, res) => {
  const conversacion = await chatConversationModel.findById(req.params.id);
  if (!conversacion) throw new AppError('Conversación no encontrada', 404);
  const mensajes = await chatMessageModel.listByConversation(req.params.id);
  res.json({ conversacion, mensajes });
});

module.exports = { listConversaciones, listMensajes };
