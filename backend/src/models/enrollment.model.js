const db = require('../config/db');

function findByUserAndCourse(userId, courseId) {
  return db('enrollments').where({ user_id: userId, course_id: courseId }).first();
}

function create(data) {
  return db('enrollments').insert(data);
}

// "Mis cursos": cursos en los que el usuario está inscripto, con los datos
// del curso ya embebidos para no tener que pegarle a la API dos veces.
// Excluye los "fuera_sistema": ese estado es justamente para que ni un
// alumno que ya lo había comprado lo vea más (ver estadosCurso.js) — un
// "cancelado" sí se sigue mostrando a propósito, el alumno mantiene acceso.
function listForUser(userId) {
  return db('enrollments')
    .join('courses', 'courses.id', 'enrollments.course_id')
    .where('enrollments.user_id', userId)
    .andWhere((qb) => qb.whereNot('courses.estado', 'fuera_sistema').orWhereNull('courses.estado'))
    .select(
      'courses.*',
      'enrollments.id as enrollment_id',
      'enrollments.payment_status',
      'enrollments.purchased_at',
      'enrollments.completado_at'
    )
    .orderBy('enrollments.purchased_at', 'desc');
}

function countForUser(userId) {
  return db('enrollments').where({ user_id: userId }).count({ count: '*' }).first();
}

// Alumnos inscriptos en un curso puntual — lo usa el profesor (o el admin)
// para poder marcar la cursada de cada uno como completada.
function listStudentsForCourse(courseId) {
  return db('enrollments')
    .join('users', 'users.id', 'enrollments.user_id')
    .where('enrollments.course_id', courseId)
    .select(
      'users.id',
      'users.nombre',
      'users.apellido',
      'users.email',
      'enrollments.purchased_at',
      'enrollments.completado_at'
    )
    .orderBy('users.nombre');
}

function countTotal() {
  return db('enrollments').count({ count: '*' }).first();
}

function countCompletados() {
  return db('enrollments').whereNotNull('completado_at').count({ count: '*' }).first();
}

// El profesor (o un admin) marca como completada la cursada de un alumno.
function marcarCompletado(userId, courseId) {
  return db('enrollments')
    .where({ user_id: userId, course_id: courseId })
    .update({ completado_at: db.fn.now() });
}

module.exports = {
  findByUserAndCourse,
  create,
  listForUser,
  countForUser,
  listStudentsForCourse,
  countTotal,
  countCompletados,
  marcarCompletado,
};
