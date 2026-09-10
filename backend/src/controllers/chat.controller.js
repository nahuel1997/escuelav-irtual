// Lado "usuario" (alumno/profesor) del chat de soporte, solo lectura —
// mandar mensajes es por socket (ver realtime/chatSocket.js), esto es
// nada más para hidratar el widget con el historial al abrir la página.
const chatConversationModel = require('../models/chatConversation.model');
const chatMessageModel = require('../models/chatMessage.model');
const { asyncHandler } = require('../middlewares/error.middleware');

// Devuelve la conversación más reciente del usuario logueado (abierta o
// no) con su historial de mensajes. Si nunca chateó, devuelve
// conversacion: null y una lista vacía — el widget arranca "en blanco" y
// la conversación se crea sola con el primer mensaje que mande.
const miConversacion = asyncHandler(async (req, res) => {
  const conversacion = await chatConversationModel.masRecienteDeUsuario(req.user.id);
  const mensajes = conversacion ? await chatMessageModel.listByConversation(conversacion.id) : [];
  res.json({ conversacion: conversacion || null, mensajes });
});

module.exports = { miConversacion };
