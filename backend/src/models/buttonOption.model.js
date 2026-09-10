const db = require('../config/db');

// "Opción N" no se guarda como texto: se arma con el id en cada consulta,
// así el nombre siempre es único y estable aunque se borren opciones del
// medio (no hay que renumerar nada).
function conNombre(fila) {
  return fila && { ...fila, nombre: `Opción ${fila.id}` };
}

async function listAll() {
  const filas = await db('button_options').select('*').orderBy('id');
  return filas.map(conNombre);
}

async function findById(id) {
  const fila = await db('button_options').where({ id }).first();
  return conNombre(fila);
}

function create(data) {
  return db('button_options').insert(data);
}

function update(id, data) {
  return db('button_options').where({ id }).update(data);
}

function remove(id) {
  return db('button_options').where({ id }).del();
}

module.exports = { listAll, findById, create, update, remove };
