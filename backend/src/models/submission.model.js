const db = require('../config/db');

function findByAssignmentAndUser(assignmentId, userId) {
  return db('submissions').where({ assignment_id: assignmentId, user_id: userId }).first();
}

function findById(id) {
  return db('submissions').where({ id }).first();
}

function create(data) {
  return db('submissions').insert(data);
}

// Entregas de una tarea, con nombre/apellido del alumno para que el
// profesor no tenga que pegarle a /users por cada una.
function listByAssignment(assignmentId) {
  return db('submissions')
    .join('users', 'users.id', 'submissions.user_id')
    .where('submissions.assignment_id', assignmentId)
    .select(
      'submissions.*',
      'users.nombre as alumno_nombre',
      'users.apellido as alumno_apellido',
      'users.email as alumno_email'
    )
    .orderBy('submissions.entregado_at', 'desc');
}

function grade(id, { calificacion, feedback_profesor }) {
  return db('submissions')
    .where({ id })
    .update({
      calificacion,
      feedback_profesor,
      estado: 'revisado',
      revisado_at: db.fn.now(),
    });
}

module.exports = { findByAssignmentAndUser, findById, create, listByAssignment, grade };
