const db = require('../config/db');

function findByUserAndChapter(userId, chapterId) {
  return db('chapter_progress').where({ user_id: userId, chapter_id: chapterId }).first();
}

// Todo el progreso de un alumno en un curso de una sola consulta (se usa
// para calcular el desbloqueo de los capítulos sin pegarle a la base uno
// por uno).
function listByUserAndCourse(userId, courseId) {
  return db('chapter_progress')
    .join('course_chapters', 'course_chapters.id', 'chapter_progress.chapter_id')
    .join('course_units', 'course_units.id', 'course_chapters.unit_id')
    .where('chapter_progress.user_id', userId)
    .where('course_units.course_id', courseId)
    .select('chapter_progress.*');
}

async function upsert(userId, chapterId, data) {
  const existente = await findByUserAndChapter(userId, chapterId);
  if (existente) {
    return db('chapter_progress')
      .where({ id: existente.id })
      .update({ ...data, updated_at: db.fn.now() });
  }
  return db('chapter_progress').insert({ user_id: userId, chapter_id: chapterId, ...data });
}

module.exports = { findByUserAndChapter, listByUserAndCourse, upsert };
