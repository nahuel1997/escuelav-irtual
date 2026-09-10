// Capa de acceso a las conversaciones de "Integraciones IA" — a
// diferencia de agent_flows (un flujo entero como JSON en una columna),
// acá cada conversación es una fila propia y sus mensajes van en una
// tabla aparte (ai_messages), porque un chat se lee de a páginas/se sigue
// agregando de a un mensaje por vez, no se reescribe entero cada vez.
const db = require('../config/db');

function listForUser(userId, { proveedor } = {}) {
  const query = db('ai_conversations').where({ user_id: userId });
  if (proveedor) query.andWhere({ proveedor });
  return query.orderBy('updated_at', 'desc').select('*');
}

function getByIdForUser(id, userId) {
  return db('ai_conversations').where({ id, user_id: userId }).first();
}

async function create(userId, { proveedor, titulo }) {
  const [row] = await db('ai_conversations')
    .insert({ user_id: userId, proveedor, titulo: (titulo || '').trim() || 'Nueva conversación' })
    .returning('id');
  const id = typeof row === 'object' ? row.id : row;
  return getByIdForUser(id, userId);
}

// Se llama después de cada mensaje nuevo: así "Mis conversaciones" en el
// panel izquierdo del Chat siempre ordena la más reciente primero (ver
// listForUser, orderBy updated_at desc), sin depender de la fecha del
// último mensaje en ai_messages.
function tocar(id) {
  return db('ai_conversations').where({ id }).update({ updated_at: db.fn.now() });
}

function remove(id, userId) {
  return db('ai_conversations').where({ id, user_id: userId }).del();
}

module.exports = { listForUser, getByIdForUser, create, tocar, remove };
