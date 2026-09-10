const db = require('../config/db');

function listByChapter(chapterId) {
  return db('chapter_files').where({ chapter_id: chapterId }).orderBy('created_at', 'asc');
}

function findById(id) {
  return db('chapter_files').where({ id }).first();
}

function create(data) {
  return db('chapter_files').insert(data);
}

function remove(id) {
  return db('chapter_files').where({ id }).del();
}

module.exports = { listByChapter, findById, create, remove };
