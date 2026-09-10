// Capa de acceso a los "GPTs" propios del alumno (ver migración
// create_ai_gpts) — mismo patrón CRUD simple que aiConversation.model.js.
const db = require('../config/db');

function listForUser(userId) {
  return db('ai_gpts').where({ user_id: userId }).orderBy('created_at', 'desc').select('*');
}

function getByIdForUser(id, userId) {
  return db('ai_gpts').where({ id, user_id: userId }).first();
}

async function create(userId, { proveedor, nombre, instrucciones, conocimiento }) {
  const [row] = await db('ai_gpts')
    .insert({
      user_id: userId,
      proveedor,
      nombre: nombre.trim(),
      instrucciones: instrucciones.trim(),
      conocimiento: conocimiento && conocimiento.trim() ? conocimiento.trim() : null,
    })
    .returning('id');
  const id = typeof row === 'object' ? row.id : row;
  return getByIdForUser(id, userId);
}

async function update(id, userId, { proveedor, nombre, instrucciones, conocimiento }) {
  await db('ai_gpts')
    .where({ id, user_id: userId })
    .update({
      proveedor,
      nombre: nombre.trim(),
      instrucciones: instrucciones.trim(),
      conocimiento: conocimiento && conocimiento.trim() ? conocimiento.trim() : null,
      updated_at: db.fn.now(),
    });
  return getByIdForUser(id, userId);
}

function remove(id, userId) {
  return db('ai_gpts').where({ id, user_id: userId }).del();
}

// Arma el system prompt combinado que se le manda a la IA real al crear
// una conversación (ver ai.controller.js::crearConversacion, que guarda
// el resultado como FOTO en ai_conversations.sistema_prompt): las
// instrucciones primero, el conocimiento de referencia después con un
// separador claro, para que la IA distinga "cómo tenés que comportarte"
// de "datos que tenés disponibles para consultar".
function armarSistemaPrompt(gpt) {
  if (!gpt.conocimiento) return gpt.instrucciones;
  return `${gpt.instrucciones}\n\n--- Conocimiento de referencia ---\n${gpt.conocimiento}`;
}

module.exports = { listForUser, getByIdForUser, create, update, remove, armarSistemaPrompt };
