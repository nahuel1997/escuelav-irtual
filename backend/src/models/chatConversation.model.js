// Capa de acceso a las conversaciones de chat de soporte
// (chat_conversations). Un usuario (alumno/profesor) tiene a lo sumo una
// conversación "abierta" a la vez — mismo criterio que el carrito
// (obtenerOCrearAbierta busca, y si no hay, crea), controlado en esta
// capa y no con un unique en la base, porque con el tiempo un usuario va
// a acumular varias filas históricas (una por cada chat ya cerrado).
const db = require('../config/db');

function findById(id) {
  return db('chat_conversations').where({ id }).first();
}

async function obtenerAbiertaDeUsuario(usuarioId) {
  return db('chat_conversations').where({ usuario_id: usuarioId, estado: 'abierto' }).first();
}

async function obtenerOCrearAbierta(usuarioId) {
  let conv = await obtenerAbiertaDeUsuario(usuarioId);
  if (!conv) {
    const [id] = await db('chat_conversations').insert({ usuario_id: usuarioId, estado: 'abierto' });
    conv = await findById(id);
  }
  return conv;
}

// La conversación más reciente de un usuario (abierta o no) — para
// hidratar el widget de chat cuando abre la página: si tiene una cerrada
// reciente, igual le mostramos el historial antes de que escriba de
// nuevo (lo que crea una conversación nueva).
function masRecienteDeUsuario(usuarioId) {
  return db('chat_conversations').where({ usuario_id: usuarioId }).orderBy('created_at', 'desc').first();
}

function marcarAtendidoPor(id, soporteUserId) {
  return db('chat_conversations').where({ id }).update({ atendido_por: soporteUserId, updated_at: db.fn.now() });
}

function tocarActividad(id) {
  return db('chat_conversations').where({ id }).update({ updated_at: db.fn.now() });
}

function cerrar(id) {
  return db('chat_conversations').where({ id }).update({ estado: 'cerrado', cerrado_at: db.fn.now(), updated_at: db.fn.now() });
}

// Lista con el detalle que necesitan tanto el panel de soporte (lista de
// chats) como el registro del admin: datos del usuario, quién la atendió
// (si alguien ya respondió) y cuántos mensajes tiene. Reutilizada por los
// dos porque muestran básicamente la misma tabla — el panel de soporte
// además puede responder, el admin solo mira. "updated_at" ya funciona
// como "última actividad" (se toca en cada mensaje nuevo, ver
// tocarActividad), así que alcanza para ordenar sin tener que traer el
// último mensaje entero.
function listConDetalle({ estado } = {}) {
  let query = db('chat_conversations as c')
    .join('users as u', 'u.id', 'c.usuario_id')
    .leftJoin('users as s', 's.id', 'c.atendido_por')
    .leftJoin('chat_messages as m', 'm.conversation_id', 'c.id')
    .groupBy('c.id', 'u.id', 's.id')
    .select(
      'c.id',
      'c.estado',
      'c.created_at',
      'c.updated_at',
      'c.cerrado_at',
      'u.id as usuario_id',
      'u.nombre as usuario_nombre',
      'u.apellido as usuario_apellido',
      'u.email as usuario_email',
      'u.rol as usuario_rol',
      's.id as atendido_por_id',
      's.nombre as atendido_por_nombre',
      's.apellido as atendido_por_apellido'
    )
    .count({ cantidad_mensajes: 'm.id' })
    .orderBy('c.updated_at', 'desc');

  if (estado) query = query.where('c.estado', estado);
  return query;
}

module.exports = {
  findById,
  obtenerAbiertaDeUsuario,
  obtenerOCrearAbierta,
  masRecienteDeUsuario,
  marcarAtendidoPor,
  tocarActividad,
  cerrar,
  listConDetalle,
};
