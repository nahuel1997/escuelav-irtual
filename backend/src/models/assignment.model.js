const db = require('../config/db');

function listByCourse(courseId) {
  return db('assignments').where({ course_id: courseId }).orderBy('created_at', 'desc');
}

function findById(id) {
  return db('assignments').where({ id }).first();
}

function create(data) {
  return db('assignments').insert(data);
}

module.exports = { listByCourse, findById, create };
