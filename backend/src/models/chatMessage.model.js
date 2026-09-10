// Capa de acceso a los mensajes de chat (chat_messages).
const db = require('../config/db');

async function crear({ conversationId, remitenteTipo, remitenteId, cuerpo }) {
  const [id] = await db('chat_messages').insert({
    conversation_id: conversationId,
    remitente_tipo: remitenteTipo,
    remitente_id: remitenteId,
    cuerpo,
  });
  return db('chat_messages').where({ id }).first();
}

// Historial completo de una conversación, con el nombre de quien mandó
// cada mensaje (para mostrarlo sin tener que resolverlo aparte en el
// frontend).
function listByConversation(conversationId) {
  return db('chat_messages as m')
    .join('users as u', 'u.id', 'm.remitente_id')
    .where('m.conversation_id', conversationId)
    .select('m.id', 'm.conversation_id', 'm.remitente_tipo', 'm.remitente_id', 'm.cuerpo', 'm.created_at', 'u.nombre as remitente_nombre')
    .orderBy('m.created_at', 'asc');
}

module.exports = { crear, listByConversation };
