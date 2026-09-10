const db = require('../config/db');

function listAll({ ubicacion } = {}) {
  const query = db('nav_links').select('*').orderBy(['orden', 'id']);
  if (ubicacion) query.where({ ubicacion });
  return query;
}

function findById(id) {
  return db('nav_links').where({ id }).first();
}

function create(data) {
  return db('nav_links').insert(data);
}

function update(id, data) {
  return db('nav_links').where({ id }).update(data);
}

function remove(id) {
  return db('nav_links').where({ id }).del();
}

module.exports = { listAll, findById, create, update, remove };
