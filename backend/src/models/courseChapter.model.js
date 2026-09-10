const db = require('../config/db');

function listByUnit(unitId) {
  return db('course_chapters').where({ unit_id: unitId }).orderBy('orden', 'asc');
}

// Todos los capítulos de un curso, con su unidad y ordenados
// unidad→capítulo — es el orden real de navegación (anterior/siguiente,
// desbloqueo) que usa curriculum.service.js.
function listByCourse(courseId) {
  return db('course_chapters')
    .join('course_units', 'course_units.id', 'course_chapters.unit_id')
    .where('course_units.course_id', courseId)
    .select(
      'course_chapters.*',
      'course_units.orden as unidad_orden',
      'course_units.titulo as unidad_titulo'
    )
    .orderBy(['course_units.orden', 'course_chapters.orden']);
}

function findById(id) {
  return db('course_chapters').where({ id }).first();
}

function create(data) {
  return db('course_chapters').insert(data);
}

function update(id, data) {
  return db('course_chapters').where({ id }).update(data);
}

function remove(id) {
  return db('course_chapters').where({ id }).del();
}

async function proximoOrden(unitId) {
  const fila = await db('course_chapters').where({ unit_id: unitId }).max('orden as max').first();
  return (fila?.max ?? -1) + 1;
}

module.exports = { listByUnit, listByCourse, findById, create, update, remove, proximoOrden };
