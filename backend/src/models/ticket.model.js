// Tickets de soporte (ver migración 20260930000006).
const db = require('../config/db');

const ESTADOS = ['abierto', 'en_curso', 'esperando_usuario', 'resuelto', 'cerrado'];
const PRIORIDADES = ['baja', 'media', 'alta'];

// Número de seguimiento legible: T-000123 (mismo estilo que los P-000123
// de los procesos de DBA24).
function numero(id) {
  return `T-${String(id).padStart(6, '0')}`;
}

function conNumero(t) {
  return t ? { ...t, numero: numero(t.id) } : t;
}

function idInsertado(res) {
  const id = res[0];
  return typeof id === 'object' ? id.id : id;
}

async function crear({ userId, asunto, categoria, prioridad, mensaje, autorRol, adjuntos = [] }) {
  return db.transaction(async (trx) => {
    const ticketId = idInsertado(await trx('tickets').insert({ user_id: userId, asunto, categoria: categoria || null, prioridad: prioridad || 'media' }));
    const mensajeId = idInsertado(await trx('ticket_mensajes').insert({ ticket_id: ticketId, user_id: userId, autor_rol: autorRol, mensaje }));
    if (adjuntos.length) await trx('ticket_adjuntos').insert(adjuntos.map((a) => ({ ...a, ticket_id: ticketId, mensaje_id: mensajeId })));
    return ticketId;
  });
}

async function agregarMensaje({ ticketId, userId, autorRol, mensaje, interno = false, sistema = false, adjuntos = [] }) {
  return db.transaction(async (trx) => {
    const mensajeId = idInsertado(await trx('ticket_mensajes').insert({ ticket_id: ticketId, user_id: userId, autor_rol: autorRol, mensaje, interno, sistema }));
    if (adjuntos.length) await trx('ticket_adjuntos').insert(adjuntos.map((a) => ({ ...a, ticket_id: ticketId, mensaje_id: mensajeId })));
    await trx('tickets').where({ id: ticketId }).update({ updated_at: db.fn.now() });
    return mensajeId;
  });
}

function baseLista() {
  return db('tickets as t')
    .join('users as u', 'u.id', 't.user_id')
    .leftJoin('users as a', 'a.id', 't.asignado_a')
    .select(
      't.*',
      'u.nombre', 'u.apellido', 'u.email', 'u.rol as usuario_rol',
      'a.nombre as asignado_nombre', 'a.apellido as asignado_apellido'
    );
}

async function etiquetasDe(ticketIds) {
  if (!ticketIds.length) return {};
  const filas = await db('ticket_etiqueta as te')
    .join('ticket_etiquetas as e', 'e.id', 'te.etiqueta_id')
    .whereIn('te.ticket_id', ticketIds)
    .select('te.ticket_id', 'e.id', 'e.nombre', 'e.color');
  const mapa = {};
  filas.forEach((f) => { (mapa[f.ticket_id] = mapa[f.ticket_id] || []).push({ id: f.id, nombre: f.nombre, color: f.color }); });
  return mapa;
}

async function listar({ userId, estado, asignadoA, etiquetaId, q, prioridad } = {}) {
  const query = baseLista().orderBy('t.updated_at', 'desc').orderBy('t.id', 'desc').limit(500);
  if (userId) query.where('t.user_id', userId);
  if (estado) query.where('t.estado', estado);
  if (prioridad) query.where('t.prioridad', prioridad);
  if (asignadoA === 'sin') query.whereNull('t.asignado_a');
  else if (asignadoA) query.where('t.asignado_a', asignadoA);
  if (etiquetaId) query.whereExists(function () { this.select('*').from('ticket_etiqueta as te').whereRaw('te.ticket_id = t.id').where('te.etiqueta_id', etiquetaId); });
  if (q) {
    const like = `%${String(q).toLowerCase()}%`;
    const numeroBuscado = Number(String(q).replace(/^T-0*/i, ''));
    query.where((w) => {
      w.whereRaw('lower(t.asunto) like ?', [like]).orWhereRaw('lower(u.email) like ?', [like]);
      if (Number.isInteger(numeroBuscado) && numeroBuscado > 0) w.orWhere('t.id', numeroBuscado);
    });
  }
  const filas = await query;
  const etiquetas = await etiquetasDe(filas.map((f) => f.id));
  return filas.map((f) => ({ ...conNumero(f), etiquetas: etiquetas[f.id] || [] }));
}

async function tablero() {
  const filas = await db('tickets').select('estado').count({ count: '*' }).groupBy('estado');
  const conteo = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  filas.forEach((f) => { conteo[f.estado] = Number(f.count); });
  const sinAsignar = await db('tickets').whereNull('asignado_a').whereNotIn('estado', ['resuelto', 'cerrado']).count({ count: '*' }).first();
  return { porEstado: conteo, sinAsignar: Number(sinAsignar.count) };
}

async function detalle(id, { incluirInternos }) {
  const ticket = await baseLista().where('t.id', id).first();
  if (!ticket) return null;
  const mensajesQ = db('ticket_mensajes as m')
    .leftJoin('users as u', 'u.id', 'm.user_id')
    .select('m.*', 'u.nombre', 'u.apellido')
    .where('m.ticket_id', id)
    .orderBy('m.id', 'asc');
  if (!incluirInternos) mensajesQ.where('m.interno', false);
  const mensajes = await mensajesQ;
  const adjuntosQ = db('ticket_adjuntos as a')
    .leftJoin('ticket_mensajes as m', 'm.id', 'a.mensaje_id')
    .select('a.id', 'a.mensaje_id', 'a.nombre_original', 'a.mime', 'a.tamano', 'a.created_at')
    .where('a.ticket_id', id);
  if (!incluirInternos) adjuntosQ.where((w) => w.whereNull('m.interno').orWhere('m.interno', false));
  const adjuntos = await adjuntosQ;
  const etiquetas = (await etiquetasDe([id]))[id] || [];
  const aprobaciones = await db('ticket_aprobaciones').where({ ticket_id: id }).select('id', 'detalle', 'estado', 'comentario', 'expira_en', 'respondido_en', 'created_at').orderBy('id', 'desc');
  return {
    ...conNumero(ticket),
    etiquetas,
    aprobaciones,
    mensajes: mensajes.map((m) => ({
      ...m,
      interno: Boolean(m.interno),
      sistema: Boolean(m.sistema),
      adjuntos: adjuntos.filter((a) => a.mensaje_id === m.id),
    })),
  };
}

function findById(id) {
  return db('tickets').where({ id }).first().then(conNumero);
}

function actualizar(id, patch) {
  return db('tickets').where({ id }).update({ ...patch, updated_at: db.fn.now() });
}

async function setEtiquetas(ticketId, etiquetaIds) {
  await db.transaction(async (trx) => {
    await trx('ticket_etiqueta').where({ ticket_id: ticketId }).del();
    if (etiquetaIds.length) await trx('ticket_etiqueta').insert(etiquetaIds.map((etiqueta_id) => ({ ticket_id: ticketId, etiqueta_id })));
  });
}

function findAdjunto(adjuntoId) {
  return db('ticket_adjuntos as a')
    .join('tickets as t', 't.id', 'a.ticket_id')
    .leftJoin('ticket_mensajes as m', 'm.id', 'a.mensaje_id')
    .select('a.*', 't.user_id', 'm.interno')
    .where('a.id', adjuntoId)
    .first();
}

// --- Etiquetas ---

function listEtiquetas() {
  return db('ticket_etiquetas').select('*').orderBy('nombre');
}

async function crearEtiqueta({ nombre, color }) {
  const id = idInsertado(await db('ticket_etiquetas').insert({ nombre, color }));
  return db('ticket_etiquetas').where({ id }).first();
}

function actualizarEtiqueta(id, patch) {
  return db('ticket_etiquetas').where({ id }).update({ ...patch, updated_at: db.fn.now() });
}

async function borrarEtiqueta(id) {
  await db('ticket_etiqueta').where({ etiqueta_id: id }).del();
  return db('ticket_etiquetas').where({ id }).del();
}

// --- Aprobaciones por link ---

async function crearAprobacion({ ticketId, tokenHash, detalle: texto, creadoPor, expiraEn }) {
  const id = idInsertado(await db('ticket_aprobaciones').insert({ ticket_id: ticketId, token_hash: tokenHash, detalle: texto, creado_por: creadoPor, expira_en: expiraEn }));
  return db('ticket_aprobaciones').where({ id }).first();
}

function findAprobacionPorHash(tokenHash) {
  return db('ticket_aprobaciones as ap')
    .join('tickets as t', 't.id', 'ap.ticket_id')
    .join('users as u', 'u.id', 't.user_id')
    .select('ap.*', 't.asunto', 't.user_id', 'u.nombre')
    .where('ap.token_hash', tokenHash)
    .first();
}

function responderAprobacion(id, { estado, comentario }) {
  return db('ticket_aprobaciones').where({ id, estado: 'pendiente' }).update({ estado, comentario: comentario || null, respondido_en: db.fn.now() });
}

module.exports = {
  ESTADOS,
  PRIORIDADES,
  numero,
  crear,
  agregarMensaje,
  listar,
  tablero,
  detalle,
  findById,
  actualizar,
  setEtiquetas,
  findAdjunto,
  listEtiquetas,
  crearEtiqueta,
  actualizarEtiqueta,
  borrarEtiqueta,
  crearAprobacion,
  findAprobacionPorHash,
  responderAprobacion,
};
