// Capa de acceso a las conversaciones de "Integraciones IA" — a
// diferencia de agent_flows (un flujo entero como JSON en una columna),
// acá cada conversación es una fila propia y sus mensajes van en una
// tabla aparte (ai_messages), porque un chat se lee de a páginas/se sigue
// agregando de a un mensaje por vez, no se reescribe entero cada vez.
const db = require('../config/db');

// Left join a ai_gpts solo para traer el nombre a mostrar (badge "con tu
// GPT 'X'" en ChatsTab/RegistrosTab) — nunca para leer el comportamiento
// del GPT, eso vive congelado en la propia columna sistema_prompt (ver
// alter_ai_conversations_add_gpt y mandarMensaje en ai.controller.js).
function listForUser(userId, { proveedor } = {}) {
  const query = db('ai_conversations as c')
    .leftJoin('ai_gpts as g', 'g.id', 'c.gpt_id')
    .where({ 'c.user_id': userId })
    .select('c.*', 'g.nombre as gpt_nombre');
  if (proveedor) query.andWhere({ 'c.proveedor': proveedor });
  return query.orderBy('c.updated_at', 'desc');
}

function getByIdForUser(id, userId) {
  return db('ai_conversations as c')
    .leftJoin('ai_gpts as g', 'g.id', 'c.gpt_id')
    .where({ 'c.id': id, 'c.user_id': userId })
    .select('c.*', 'g.nombre as gpt_nombre')
    .first();
}

async function create(userId, { proveedor, titulo, gptId, sistemaPrompt }) {
  const [row] = await db('ai_conversations')
    .insert({
      user_id: userId,
      proveedor,
      titulo: (titulo || '').trim() || 'Nueva conversación',
      gpt_id: gptId || null,
      sistema_prompt: sistemaPrompt || null,
    })
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
