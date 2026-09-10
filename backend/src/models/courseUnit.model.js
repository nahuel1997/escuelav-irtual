const db = require('../config/db');

function listByCourse(courseId) {
  return db('course_units').where({ course_id: courseId }).orderBy('orden', 'asc');
}

function findById(id) {
  return db('course_units').where({ id }).first();
}

function create(data) {
  return db('course_units').insert(data);
}

function update(id, data) {
  return db('course_units').where({ id }).update(data);
}

function remove(id) {
  return db('course_units').where({ id }).del();
}

// Próximo número de orden para una unidad nueva del curso (al final de la
// lista), para no tener que pedirle al profesor que numere a mano.
async function proximoOrden(courseId) {
  const fila = await db('course_units').where({ course_id: courseId }).max('orden as max').first();
  return (fila?.max ?? -1) + 1;
}

module.exports = { listByCourse, findById, create, update, remove, proximoOrden };
