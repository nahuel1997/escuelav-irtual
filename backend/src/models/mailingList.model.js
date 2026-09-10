// Capa de acceso a listas de mailing armables a mano (mailing_lists +
// mailing_list_members) — para el mail de ofertas/avisos del backoffice.
const db = require('../config/db');

function listAll() {
  return db('mailing_lists as l')
    .leftJoin('mailing_list_members as m', 'm.mailing_list_id', 'l.id')
    .groupBy('l.id')
    .select('l.*')
    .count({ cantidad_miembros: 'm.id' })
    .orderBy('l.nombre');
}

function findById(id) {
  return db('mailing_lists').where({ id }).first();
}

async function create({ nombre, descripcion }) {
  const [id] = await db('mailing_lists').insert({ nombre, descripcion: descripcion || null });
  return findById(id);
}

async function update(id, { nombre, descripcion }) {
  const patch = {};
  if (nombre !== undefined) patch.nombre = nombre;
  if (descripcion !== undefined) patch.descripcion = descripcion;
  patch.updated_at = db.fn.now();
  await db('mailing_lists').where({ id }).update(patch);
  return findById(id);
}

function remove(id) {
  return db('mailing_lists').where({ id }).del();
}

// Miembros de la lista, con sus datos básicos — lo que muestra la tabla de
// la pestaña Listas.
function listMembers(listId) {
  return db('mailing_list_members as m')
    .join('users as u', 'u.id', 'm.user_id')
    .where('m.mailing_list_id', listId)
    .select('u.id', 'u.nombre', 'u.apellido', 'u.email', 'u.rol', 'm.added_at')
    .orderBy('u.nombre');
}

// Alumnos y profesores que TODAVÍA no están en la lista — para el
// selector de "agregar miembros".
function listDisponibles(listId) {
  return db('users')
    .whereIn('rol', ['alumno', 'profesor'])
    .whereNotIn('id', function () {
      this.select('user_id').from('mailing_list_members').where('mailing_list_id', listId);
    })
    .select('id', 'nombre', 'apellido', 'email', 'rol')
    .orderBy('nombre');
}

async function addMember(listId, userId) {
  const yaEsta = await db('mailing_list_members').where({ mailing_list_id: listId, user_id: userId }).first();
  if (yaEsta) return yaEsta;
  await db('mailing_list_members').insert({ mailing_list_id: listId, user_id: userId });
  return db('mailing_list_members').where({ mailing_list_id: listId, user_id: userId }).first();
}

// "Seleccionar todos": agrega de una todos los alumnos/profesores que
// todavía no estén en la lista.
async function addTodosLosDisponibles(listId) {
  const disponibles = await listDisponibles(listId);
  if (disponibles.length === 0) return 0;
  await db('mailing_list_members').insert(
    disponibles.map((u) => ({ mailing_list_id: listId, user_id: u.id }))
  );
  return disponibles.length;
}

function removeMember(listId, userId) {
  return db('mailing_list_members').where({ mailing_list_id: listId, user_id: userId }).del();
}

// "Quitar todos": vacía la lista sin borrar la lista en sí.
function removeTodos(listId) {
  return db('mailing_list_members').where({ mailing_list_id: listId }).del();
}

module.exports = {
  listAll,
  findById,
  create,
  update,
  remove,
  listMembers,
  listDisponibles,
  addMember,
  addTodosLosDisponibles,
  removeMember,
  removeTodos,
};
