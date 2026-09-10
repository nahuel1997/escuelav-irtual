// =============================================================================
// chatSocket.js — Chat de soporte en tiempo real (WebSockets, vía Socket.io).
//
// Es la única parte de la app que no es puro REST: el resto de la API
// (mails, carrito, calendario...) se lee y escribe con fetch normal, pero
// un chat en vivo necesita que el mensaje aparezca en la pantalla del
// otro lado SIN que nadie tenga que refrescar — para eso hace falta una
// conexión que el server pueda usar para "empujar" datos, no solo
// responder pedidos.
//
// Quedó aislado en su propio archivo (mismo espíritu que mail.service.js
// o jobs/) y se conecta al server HTTP solo cuando la app arranca de
// verdad (ver el bloque require.main === module en app.js) — los tests
// de Jest importan `app` directo con supertest y nunca levantan un
// server HTTP real, así que nunca tocan esto.
//
// Qué SÍ vive acá (en vivo, por socket):
//   - Mandar un mensaje (chat:mensaje) y que llegue al instante al otro lado.
//   - Cerrar una conversación (chat:cerrar, solo soporte).
// Qué NO vive acá (REST normal, ver chat.routes.js / support.routes.js):
//   - Cargar el historial de mensajes al abrir la pantalla.
//   - La lista de conversaciones del panel de soporte.
//   - El registro de solo lectura del admin.
// Esto es a propósito: los sockets son para "algo cambió, enterate ya",
// no para reemplazar la carga inicial de datos — así el chat funciona
// igual (con un refresh manual) si por lo que sea el socket no conecta.
//
// Autenticación: el cliente manda el mismo JWT que ya usa para la API
// REST (auth.token en el handshake) — no hay un login separado para el
// socket, es la misma sesión.
// =============================================================================
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const chatConversationModel = require('../models/chatConversation.model');
const chatMessageModel = require('../models/chatMessage.model');

// Roles que pueden participar del chat de soporte. Admin queda afuera a
// propósito: tiene su propio registro de solo lectura (GET /api/admin/chats),
// no un lugar en vivo — mantiene la cola de soporte como un área aparte,
// igual que /admin-panel y /soporte tienen logins independientes.
const ROLES_CHAT = ['alumno', 'profesor', 'soporte'];

function attachChatSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  // Verificamos el token UNA vez, al conectar (no en cada mensaje) — mismo
  // JWT y mismo secreto que requireAuth (middlewares/auth.middleware.js).
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('No autenticado'));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (!ROLES_CHAT.includes(payload.rol)) return next(new Error('Este rol no tiene acceso al chat'));
      socket.user = payload; // { id, email, rol, nombre }
      next();
    } catch (err) {
      next(new Error('Sesión inválida o expirada'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, rol, nombre } = socket.user;

    // Cada usuario tiene su "room" personal (para recibir mensajes de SU
    // conversación sin tener que unirse a mano) y los agentes de soporte
    // además entran a una room compartida: así, cuando un alumno manda su
    // primer mensaje, TODOS los agentes conectados se enteran al toque de
    // que hay un chat nuevo, sin tener que estar mirando esa conversación
    // puntual todavía (cola compartida: cualquiera la puede tomar).
    socket.join(`usuario:${userId}`);
    if (rol === 'soporte') socket.join('soporte:todos');

    // El cliente llama esto al abrir una conversación puntual (el alumno,
    // la suya; el agente de soporte, la que eligió de la lista) para
    // recibir los mensajes nuevos de ESA conversación en tiempo real.
    socket.on('chat:unirse', (conversationId) => {
      if (conversationId) socket.join(`conversacion:${conversationId}`);
    });

    socket.on('chat:mensaje', async ({ conversationId, texto } = {}, callback) => {
      const responder = typeof callback === 'function' ? callback : () => {};
      try {
        const textoLimpio = String(texto || '').trim();
        if (!textoLimpio) throw new Error('El mensaje no puede estar vacío');

        let conversation;
        if (rol === 'soporte') {
          if (!conversationId) throw new Error('Falta indicar la conversación');
          conversation = await chatConversationModel.findById(conversationId);
          if (!conversation) throw new Error('La conversación no existe');
          if (conversation.estado === 'cerrado') throw new Error('Esta conversación ya está cerrada');
          await chatConversationModel.marcarAtendidoPor(conversation.id, userId);
        } else {
          // Un alumno/profesor solo puede escribir en SU PROPIA conversación
          // abierta. Si no mandó conversationId, o la que mandó no es suya o
          // ya está cerrada, le abrimos (o reabrimos) una — así el widget no
          // tiene que preocuparse por manejar ese caso a mano, alcanza con
          // mandar el mensaje.
          conversation = conversationId ? await chatConversationModel.findById(conversationId) : null;
          const esSuyaYAbierta = conversation && conversation.usuario_id === userId && conversation.estado === 'abierto';
          if (!esSuyaYAbierta) {
            conversation = await chatConversationModel.obtenerOCrearAbierta(userId);
          }
        }

        const mensaje = await chatMessageModel.crear({
          conversationId: conversation.id,
          remitenteTipo: rol === 'soporte' ? 'soporte' : 'usuario',
          remitenteId: userId,
          cuerpo: textoLimpio,
        });
        await chatConversationModel.tocarActividad(conversation.id);

        const payload = {
          mensaje: { ...mensaje, remitente_nombre: nombre },
          conversationId: conversation.id,
          usuarioId: conversation.usuario_id,
        };

        // Al que está mirando esa conversación puntual (room por id), a la
        // room personal del usuario dueño del chat (por si todavía no se
        // unió a la room de la conversación — ej: recién conectó) y a todos
        // los agentes de soporte (para que la lista se actualice sola, con
        // chats nuevos o reordenados por actividad).
        io.to(`conversacion:${conversation.id}`).emit('chat:mensaje-nuevo', payload);
        io.to(`usuario:${conversation.usuario_id}`).emit('chat:mensaje-nuevo', payload);
        io.to('soporte:todos').emit('chat:mensaje-nuevo', payload);

        responder({ ok: true, conversationId: conversation.id, mensaje: payload.mensaje });
      } catch (err) {
        responder({ ok: false, error: err.message });
      }
    });

    socket.on('chat:cerrar', async (conversationId, callback) => {
      const responder = typeof callback === 'function' ? callback : () => {};
      try {
        if (rol !== 'soporte') throw new Error('Solo soporte puede cerrar una conversación');
        const conversation = await chatConversationModel.findById(conversationId);
        if (!conversation) throw new Error('La conversación no existe');
        await chatConversationModel.cerrar(conversationId);
        io.to(`conversacion:${conversationId}`).emit('chat:cerrado', { conversationId });
        io.to(`usuario:${conversation.usuario_id}`).emit('chat:cerrado', { conversationId });
        io.to('soporte:todos').emit('chat:cerrado', { conversationId });
        responder({ ok: true });
      } catch (err) {
        responder({ ok: false, error: err.message });
      }
    });
  });

  return io;
}

module.exports = { attachChatSocket };
