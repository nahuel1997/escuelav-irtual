// Capa de acceso al historial de chat de una clase en vivo
// (live_class_messages) — mismo patrón que chatMessage.model.js.
const db = require('../config/db');

async function crear({ liveClassId, userId, cuerpo }) {
  const [id] = await db('live_class_messages').insert({
    live_class_id: liveClassId,
    user_id: userId,
    cuerpo,
  });
  return db('live_class_messages').where({ id }).first();
}

// Historial de la sala, con el nombre de quien mandó cada mensaje (mismo
// motivo que chatMessage.model.js::listByConversation: evita resolverlo
// aparte en el frontend).
function listByLiveClass(liveClassId) {
  return db('live_class_messages as m')
    .join('users as u', 'u.id', 'm.user_id')
    .where('m.live_class_id', liveClassId)
    .select('m.id', 'm.live_class_id', 'm.user_id', 'm.cuerpo', 'm.created_at', 'u.nombre as remitente_nombre', 'u.apellido as remitente_apellido')
    .orderBy('m.created_at', 'asc');
}

module.exports = { crear, listByLiveClass };
