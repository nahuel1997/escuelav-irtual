// Capa de acceso a datos para "users". Los controllers no escriben SQL/knex
// directamente: pasan siempre por acá, así si el día de mañana cambia el
// motor de base de datos (sqlite -> postgres) o alguna query se optimiza,
// se toca en un solo lugar.
const db = require('../config/db');

const PUBLIC_FIELDS = [
  'id', 'nombre', 'apellido', 'email', 'rol', 'avatar_url', 'email_verificado', 'created_at',
  // Seguridad de cuentas (ver migración 20260916000001 y README
  // "Seguridad de cuentas"): alta/baja y bloqueo son dos cosas distintas.
  'activo', 'bloqueado', 'bloqueado_motivo', 'bloqueado_en',
  // Campañas de publicidad (ver migración 20260930000011)
  'acepta_publicidad',
];

// better-sqlite3 (a diferencia de pg) devuelve las columnas boolean como
// 0/1 crudos en vez de true/false — lo normalizamos acá, en el único lugar
// por donde pasan las filas de "users" hacia afuera, para que el resto de
// la app (y el JSON de la API) siempre vea un boolean de verdad.
function normalizar(row) {
  if (!row) return row;
  for (const campo of ['email_verificado', 'activo', 'bloqueado', 'acepta_publicidad', 'es_prueba']) {
    if (campo in row) row[campo] = Boolean(row[campo]);
  }
  return row;
}

function normalizarLista(rows) {
  return rows.map(normalizar);
}

async function findByEmail(email) {
  const row = await db('users').where({ email }).first();
  return normalizar(row);
}

async function findById(id) {
  const row = await db('users').where({ id }).first();
  return normalizar(row);
}

async function findPublicById(id) {
  const row = await db('users').select(PUBLIC_FIELDS).where({ id }).first();
  return normalizar(row);
}

// Varios ids de un saque (validar destinatarios de alertas/campañas sin
// una consulta por cada uno).
async function findPublicByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const rows = await db('users').select(PUBLIC_FIELDS).whereIn('id', ids);
  return normalizarLista(rows);
}

async function create({ nombre, apellido, email, password_hash, rol }) {
  const [id] = await db('users').insert({ nombre, apellido, email, password_hash, rol });
  return findPublicById(id);
}

function updateProfile(id, { nombre, apellido, avatar_url }) {
  const patch = {};
  if (nombre !== undefined) patch.nombre = nombre;
  if (apellido !== undefined) patch.apellido = apellido;
  if (avatar_url !== undefined) patch.avatar_url = avatar_url;
  return db('users').where({ id }).update(patch);
}

// Usado por el admin para editar la cuenta de cualquier usuario (ver
// admin.controller.js::updateUser) — email y/o reset de contraseña.
// `password_hash` ya viene hasheado desde el controller, acá solo pisa.
function updateEmailPassword(id, { email, password_hash }) {
  const patch = {};
  if (email !== undefined) patch.email = email;
  if (password_hash !== undefined) patch.password_hash = password_hash;
  if (Object.keys(patch).length === 0) return Promise.resolve(0);
  return db('users').where({ id }).update(patch);
}

// Alta/baja administrativa (no es un borrado: todo el historial queda).
function setActivo(id, activo) {
  return db('users').where({ id }).update({ activo: Boolean(activo) });
}

// Bloqueo de seguridad, siempre a mano por un admin. El sistema de fuerza
// bruta del login bloquea solo la IP, nunca la cuenta (si no, cualquiera
// podría dejar afuera a un usuario sabiendo su email — misma decisión que
// DBA24, ver README "Seguridad de cuentas").
function setBloqueo(id, { bloqueado, motivo }) {
  return db('users').where({ id }).update(
    bloqueado
      ? { bloqueado: true, bloqueado_motivo: motivo, bloqueado_en: db.fn.now() }
      : { bloqueado: false, bloqueado_motivo: null, bloqueado_en: null }
  );
}

function setAceptaPublicidad(id, acepta) {
  return db('users').where({ id }).update({ acepta_publicidad: Boolean(acepta), baja_publicidad_en: acepta ? null : db.fn.now() });
}

// Usado por el panel de admin: listar profesores (o cualquier rol) para
// asignarlos a cursos o simplemente para mostrarlos en una tabla.
async function listByRole(rol) {
  const rows = await db('users').select(PUBLIC_FIELDS).where({ rol }).orderBy('nombre');
  return normalizarLista(rows);
}

function countByRole(rol) {
  return db('users').where({ rol }).count({ count: '*' }).first();
}

// Usado por el filtro de usuario del registro de logins en el admin: ahí
// hace falta elegir entre cualquier usuario, sin importar el rol.
async function listAll() {
  const rows = await db('users').select(PUBLIC_FIELDS).orderBy('nombre');
  return normalizarLista(rows);
}

// Destinatarios de campañas de mail: cuentas activas de los roles pedidos.
async function listActivosPorRoles(roles) {
  const rows = await db('users').select(PUBLIC_FIELDS).whereIn('rol', roles).where({ activo: true });
  return normalizarLista(rows);
}

// --- Validación de cuenta por mail (ver email verification flow) ---

function marcarEmailVerificado(id) {
  return db('users').where({ id }).update({ email_verificado: true, email_verificado_at: db.fn.now() });
}

// --- Inactividad ("te extrañamos", ver jobs/inactividad.job.js) ---

function marcarRecordatorioInactividadEnviado(id) {
  return db('users').where({ id }).update({ ultimo_mail_inactividad_at: db.fn.now() });
}

module.exports = {
  findByEmail,
  findById,
  findPublicById,
  findPublicByIds,
  create,
  updateProfile,
  updateEmailPassword,
  setActivo,
  setBloqueo,
  setAceptaPublicidad,
  listByRole,
  countByRole,
  listAll,
  listActivosPorRoles,
  marcarEmailVerificado,
  marcarRecordatorioInactividadEnviado,
  PUBLIC_FIELDS,
};
