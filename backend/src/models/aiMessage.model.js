// Capa de acceso a los mensajes de una conversación de "Integraciones IA".
const db = require('../config/db');

function listForConversation(conversationId) {
  return db('ai_messages').where({ conversation_id: conversationId }).orderBy('created_at', 'asc').select('*');
}

async function create(conversationId, { rol, contenido }) {
  const [row] = await db('ai_messages').insert({ conversation_id: conversationId, rol, contenido }).returning('id');
  const id = typeof row === 'object' ? row.id : row;
  return db('ai_messages').where({ id }).first();
}

module.exports = { listForConversation, create };
