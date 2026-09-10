const db = require('../config/db');

// sqlite (better-sqlite3) guarda los booleanos como 0/1 — los devolvemos
// como boolean de verdad para que el frontend pueda comparar con === y no
// se sorprenda con un 0 donde esperaba false.
function coerceBool(row) {
  return row ? { ...row, activo: Boolean(row.activo) } : row;
}

function listAll() {
  return db('lti_platforms')
    .join('courses', 'courses.id', 'lti_platforms.curso_id')
    .select('lti_platforms.*', 'courses.titulo as curso_titulo')
    .orderBy('lti_platforms.created_at', 'desc')
    .then((rows) => rows.map(coerceBool));
}

function getById(id) {
  return db('lti_platforms').where({ id }).first().then(coerceBool);
}

// La búsqueda real durante un launch es por (issuer, client_id): el
// deployment_id se valida aparte, adentro del launch, porque el claim
// específico (`.../claim/deployment_id`) recién está disponible una vez
// decodificado el id_token — acá todavía no lo tenemos.
function findByIssuerAndClient(issuer, clientId) {
  return db('lti_platforms').where({ issuer, client_id: clientId, activo: true }).first();
}

function create(data) {
  return db('lti_platforms').insert(data).returning('id').then(([row]) => getById(typeof row === 'object' ? row.id : row));
}

async function update(id, data) {
  await db('lti_platforms').where({ id }).update({ ...data, updated_at: db.fn.now() });
  return getById(id);
}

function remove(id) {
  return db('lti_platforms').where({ id }).del();
}

module.exports = { listAll, getById, findByIssuerAndClient, create, update, remove };
