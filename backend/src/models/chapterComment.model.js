const db = require('../config/db');

// Con nombre/apellido del autor, para no pedirle a /users uno por uno al
// pintar la caja de comentarios (mismo criterio que submission.model.js).
function listByChapter(chapterId) {
  return db('chapter_comments')
    .join('users', 'users.id', 'chapter_comments.user_id')
    .where('chapter_comments.chapter_id', chapterId)
    .select(
      'chapter_comments.*',
      'users.nombre as autor_nombre',
      'users.apellido as autor_apellido',
      'users.rol as autor_rol'
    )
    .orderBy('chapter_comments.created_at', 'asc');
}

function findById(id) {
  return db('chapter_comments').where({ id }).first();
}

function create(data) {
  return db('chapter_comments').insert(data);
}

function remove(id) {
  return db('chapter_comments').where({ id }).del();
}

// Ocultar/mostrar sin borrar (ver migración 20260827000001): el gestor del
// curso puede esconder un comentario de los alumnos y volver a mostrarlo
// después, a diferencia de remove() que es definitivo.
function setOculto(id, oculto) {
  return db('chapter_comments').where({ id }).update({ oculto });
}

module.exports = { listByChapter, findById, create, remove, setOculto };
