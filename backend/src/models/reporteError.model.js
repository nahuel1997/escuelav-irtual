// "Reportar error" de alumnos/profesores (ver migración 20260930000004).
const db = require('../config/db');

const ESTADOS = ['nuevo', 'en_revision', 'resuelto', 'descartado'];

async function crear({ userId, rol, titulo, descripcion, pagina, navegador, adjuntos = [] }) {
  return db.transaction(async (trx) => {
    const [id] = await trx('reportes_error').insert({ user_id: userId, rol, titulo, descripcion, pagina, navegador });
    const reporteId = typeof id === 'object' ? id.id : id;
    if (adjuntos.length) {
      await trx('reportes_error_adjuntos').insert(adjuntos.map((a) => ({ reporte_id: reporteId, ...a })));
    }
    return reporteId;
  });
}

function listByUser(userId) {
  return db('reportes_error').where({ user_id: userId }).orderBy('id', 'desc');
}

function listAll({ estado } = {}) {
  const q = db('reportes_error as r')
    .join('users as u', 'u.id', 'r.user_id')
    .select('r.*', 'u.nombre', 'u.apellido', 'u.email')
    .select(db.raw('(select count(*) from reportes_error_adjuntos a where a.reporte_id = r.id) as adjuntos'))
    .orderBy('r.id', 'desc')
    .limit(500);
  if (estado) q.where('r.estado', estado);
  return q;
}

async function findConAdjuntos(id) {
  const reporte = await db('reportes_error as r')
    .join('users as u', 'u.id', 'r.user_id')
    .select('r.*', 'u.nombre', 'u.apellido', 'u.email')
    .where('r.id', id)
    .first();
  if (!reporte) return null;
  reporte.adjuntos = await db('reportes_error_adjuntos').where({ reporte_id: id }).select('id', 'nombre_original', 'mime', 'tamano');
  return reporte;
}

function findAdjunto(adjuntoId) {
  return db('reportes_error_adjuntos as a')
    .join('reportes_error as r', 'r.id', 'a.reporte_id')
    .select('a.*', 'r.user_id')
    .where('a.id', adjuntoId)
    .first();
}

function setEstado(id, { estado, respuesta }) {
  const patch = { estado, updated_at: db.fn.now() };
  if (respuesta !== undefined) patch.respuesta = respuesta;
  return db('reportes_error').where({ id }).update(patch);
}

function contarNuevos() {
  return db('reportes_error').where({ estado: 'nuevo' }).count({ count: '*' }).first().then((r) => Number(r.count));
}

module.exports = { ESTADOS, crear, listByUser, listAll, findConAdjuntos, findAdjunto, setEstado, contarNuevos };
