// Capa de acceso a datos de los clientes de la "API de datos" (accesos
// externos con usuario/contraseña, permisos por tabla/columna — ver
// dataCatalog.service.js y dataApi.controller.js).
const db = require('../config/db');

function normalizarPermiso(row) {
  if (!row) return row;
  return { ...row, columnas: JSON.parse(row.columnas) };
}

async function listAll() {
  const clientes = await db('api_clients').select('id', 'username', 'activo', 'descripcion', 'created_at').orderBy('username');
  const permisos = await db('api_client_permisos').select('client_id', 'tabla', 'columnas');
  return clientes.map((c) => ({
    ...c,
    permisos: permisos.filter((p) => p.client_id === c.id).map((p) => ({ tabla: p.tabla, columnas: JSON.parse(p.columnas) })),
  }));
}

async function findById(id) {
  const cliente = await db('api_clients').where({ id }).first();
  if (!cliente) return null;
  const permisos = await db('api_client_permisos').where({ client_id: id }).select('id', 'tabla', 'columnas');
  return { ...cliente, permisos: permisos.map(normalizarPermiso) };
}

// Para el middleware de auth de la API de datos: necesita el hash para
// comparar, así que este findByUsername es el único que lo devuelve.
function findByUsername(username) {
  return db('api_clients').where({ username }).first();
}

async function create({ username, password_hash, descripcion }) {
  const [id] = await db('api_clients').insert({ username, password_hash, descripcion: descripcion || null });
  return findById(id);
}

function setPassword(id, password_hash) {
  return db('api_clients').where({ id }).update({ password_hash, updated_at: db.fn.now() });
}

function setActivo(id, activo) {
  return db('api_clients').where({ id }).update({ activo, updated_at: db.fn.now() });
}

// Borra el acceso por completo (a diferencia de "Desactivar", que solo lo
// apaga sin perder nada — ver setActivo). Transacción explícita borrando
// primero las tablas hijas: aunque api_client_permisos/api_usage_log ya
// tienen `onDelete('CASCADE')` en su FK (ver la migración), no dependemos
// de que el pragma de foreign keys de SQLite esté prendido en cada
// conexión — más simple confiar en el orden explícito acá que en un
// comportamiento del driver que podría no estar activo.
function remove(id) {
  return db.transaction(async (trx) => {
    await trx('api_usage_log').where({ client_id: id }).del();
    await trx('api_client_permisos').where({ client_id: id }).del();
    await trx('api_clients').where({ id }).del();
  });
}

// Crea o reemplaza (upsert) el permiso de un cliente sobre una tabla —
// "guardar de nuevo" con otras columnas simplemente pisa la lista
// anterior, no la extiende (así el admin puede sacar una columna que ya
// había dado, no solo agregar).
async function setPermiso(clientId, tabla, columnas) {
  const existente = await db('api_client_permisos').where({ client_id: clientId, tabla }).first();
  if (existente) {
    await db('api_client_permisos').where({ id: existente.id }).update({ columnas: JSON.stringify(columnas), updated_at: db.fn.now() });
  } else {
    await db('api_client_permisos').insert({ client_id: clientId, tabla, columnas: JSON.stringify(columnas) });
  }
  return db('api_client_permisos').where({ client_id: clientId, tabla }).first().then(normalizarPermiso);
}

function quitarPermiso(clientId, tabla) {
  return db('api_client_permisos').where({ client_id: clientId, tabla }).del();
}

// Usado por el middleware de la API de datos para saber, para ESTE
// cliente y ESTA tabla, qué columnas exactas tiene permitidas. null si no
// tiene ningún permiso sobre esa tabla (=  sin acceso).
async function permisoPara(clientId, tabla) {
  const fila = await db('api_client_permisos').where({ client_id: clientId, tabla }).first();
  return fila ? JSON.parse(fila.columnas) : null;
}

module.exports = {
  listAll,
  findById,
  findByUsername,
  create,
  setPassword,
  setActivo,
  remove,
  setPermiso,
  quitarPermiso,
  permisoPara,
};
