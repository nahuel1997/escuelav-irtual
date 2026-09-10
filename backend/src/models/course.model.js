const db = require('../config/db');

function listAll({ categoria, estado } = {}) {
  const query = db('courses').select('*').orderBy('created_at', 'desc');
  if (categoria) query.where({ categoria });
  if (estado) query.where({ estado });
  return query;
}

function findById(id) {
  return db('courses').where({ id }).first();
}

// Para la página pública de detalle (/tienda/:id): además del curso, el
// nombre del profesor a cargo — "quién lo da" es justo lo que un
// comprador quiere saber antes de pagar, y hasta ahora no se mostraba.
async function findByIdConProfesor(id) {
  const course = await db('courses as c')
    .leftJoin('users as p', 'p.id', 'c.profesor_id')
    .where('c.id', id)
    .select('c.*', 'p.nombre as profesor_nombre', 'p.apellido as profesor_apellido')
    .first();
  return course;
}

function create(data) {
  return db('courses').insert(data);
}

function listByProfesor(profesorId) {
  return db('courses').where({ profesor_id: profesorId }).orderBy('created_at', 'desc');
}

function update(id, data) {
  return db('courses').where({ id }).update(data);
}

module.exports = { listAll, findById, findByIdConProfesor, create, listByProfesor, update };
