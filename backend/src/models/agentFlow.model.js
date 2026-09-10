const db = require('../config/db');

function parsear(row) {
  if (!row) return null;
  let nodos = [];
  try {
    nodos = JSON.parse(row.nodos || '[]');
  } catch {
    nodos = [];
  }
  return { ...row, nodos };
}

function listForUser(userId) {
  return db('agent_flows').where({ user_id: userId }).orderBy('updated_at', 'desc').select('*').then((rows) => rows.map(parsear));
}

function getByIdForUser(id, userId) {
  return db('agent_flows').where({ id, user_id: userId }).first().then(parsear);
}

async function create(userId, { nombre, descripcion, nodos }) {
  const [row] = await db('agent_flows')
    .insert({ user_id: userId, nombre, descripcion: descripcion || '', nodos: JSON.stringify(nodos || []) })
    .returning('id');
  const id = typeof row === 'object' ? row.id : row;
  return getByIdForUser(id, userId);
}

async function update(id, userId, { nombre, descripcion, nodos }) {
  await db('agent_flows')
    .where({ id, user_id: userId })
    .update({ nombre, descripcion: descripcion || '', nodos: JSON.stringify(nodos || []), updated_at: db.fn.now() });
  return getByIdForUser(id, userId);
}

function remove(id, userId) {
  return db('agent_flows').where({ id, user_id: userId }).del();
}

module.exports = { listForUser, getByIdForUser, create, update, remove };
