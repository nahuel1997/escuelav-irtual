// Capa de acceso a las clases en vivo (live_classes) y a la tabla puente
// de profesores asignados (live_class_profesores). Ver la migración
// 20260828000001_create_live_classes.js para la máquina de estados y el
// criterio de room_id.
const crypto = require('crypto');
const db = require('../config/db');

// Slug random hexadecimal (no correlativo) para que la sala no se pueda
// adivinar por el id numérico de la clase — mismo criterio que
// apiClients.controller.js usa para las api keys.
function generarRoomId() {
  return crypto.randomBytes(20).toString('hex');
}

// `profesorIds` es el array de profesores asignados al crearla (co-dictado
// admitido, ver clarificación del usuario). Se crea la clase y se asignan
// los profesores en una misma transacción: si falla la asignación no
// queremos una clase en vivo "huérfana" sin nadie que la pueda transmitir.
async function create({ courseId, titulo, descripcion, scheduledAt, duracionMinutos, creadoPor, profesorIds }) {
  return db.transaction(async (trx) => {
    const [id] = await trx('live_classes').insert({
      course_id: courseId,
      titulo,
      descripcion: descripcion || null,
      scheduled_at: scheduledAt,
      duracion_minutos: duracionMinutos || 60,
      room_id: generarRoomId(),
      creado_por: creadoPor,
    });
    if (profesorIds && profesorIds.length) {
      await trx('live_class_profesores').insert(
        profesorIds.map((profesorId) => ({ live_class_id: id, profesor_id: profesorId }))
      );
    }
    return trx('live_classes').where({ id }).first();
  });
}

function findById(id) {
  return db('live_classes').where({ id }).first();
}

// Trae la clase con el título del curso ya embebido — lo usan tanto el
// detalle de admin como getSala() del controller para armar la respuesta
// sin una segunda consulta.
function findByIdConCurso(id) {
  return db('live_classes as lc')
    .join('courses as c', 'c.id', 'lc.course_id')
    .where('lc.id', id)
    .select('lc.*', 'c.titulo as curso_titulo')
    .first();
}

// Listado completo para el panel de admin, con filtro opcional por curso o
// estado (para no traer clases finalizadas/canceladas de meses atrás salvo
// que se pidan).
function listForAdmin({ courseId, estado } = {}) {
  const query = db('live_classes as lc')
    .join('courses as c', 'c.id', 'lc.course_id')
    .select('lc.*', 'c.titulo as curso_titulo')
    .orderBy('lc.scheduled_at', 'desc');
  if (courseId) query.where('lc.course_id', courseId);
  if (estado) query.where('lc.estado', estado);
  return query;
}

// Clases visibles para un alumno: solo las de cursos en los que está
// inscripto (no filtramos por estado acá — el alumno también quiere ver
// las que ya pasaron o se cancelaron, la UI decide cómo mostrarlas).
function listForAlumno(alumnoId) {
  return db('live_classes as lc')
    .join('courses as c', 'c.id', 'lc.course_id')
    .join('enrollments as e', (join) => {
      join.on('e.course_id', 'lc.course_id').andOn('e.user_id', db.raw('?', [alumnoId]));
    })
    .select('lc.*', 'c.titulo as curso_titulo')
    .orderBy('lc.scheduled_at', 'desc');
}

// Clases donde el profesor está asignado (vía la tabla puente, admite
// co-dictado — ver nota en la migración de live_class_profesores).
function listForProfesor(profesorId) {
  return db('live_classes as lc')
    .join('courses as c', 'c.id', 'lc.course_id')
    .join('live_class_profesores as lcp', 'lcp.live_class_id', 'lc.id')
    .where('lcp.profesor_id', profesorId)
    .select('lc.*', 'c.titulo as curso_titulo')
    .orderBy('lc.scheduled_at', 'desc');
}

function update(id, data) {
  return db('live_classes').where({ id }).update({ ...data, updated_at: db.fn.now() });
}

function updateEstado(id, estado, extra = {}) {
  return db('live_classes').where({ id }).update({ estado, ...extra, updated_at: db.fn.now() });
}

// El admin cancela: no hay vuelta atrás (ver máquina de estados en la
// migración), así que esto solo lo llama el controller después de validar
// que la clase todavía esté en 'programada'.
function cancelar(id) {
  return updateEstado(id, 'cancelada');
}

// El profesor asignado inicia la transmisión: programada → en_vivo, y
// queda registrado started_at (el controller ya validó estado + asignación).
function marcarIniciada(id) {
  return db('live_classes').where({ id }).update({ estado: 'en_vivo', started_at: db.fn.now(), updated_at: db.fn.now() });
}

// El profesor cierra la transmisión: en_vivo → finalizada.
function marcarFinalizada(id) {
  return db('live_classes').where({ id }).update({ estado: 'finalizada', ended_at: db.fn.now(), updated_at: db.fn.now() });
}

async function asignarProfesores(liveClassId, profesorIds) {
  if (!profesorIds || !profesorIds.length) return;
  return db('live_class_profesores').insert(
    profesorIds.map((profesorId) => ({ live_class_id: liveClassId, profesor_id: profesorId }))
  );
}

// El admin edita la lista de profesores de una clase todavía no iniciada:
// se reemplaza el conjunto entero (borrar + volver a insertar) en vez de
// calcular el diff — más simple y la tabla puente no tiene otro dato
// además de la relación en sí, así que no hay nada que "perder" al borrar.
async function reasignarProfesores(liveClassId, profesorIds) {
  return db.transaction(async (trx) => {
    await trx('live_class_profesores').where({ live_class_id: liveClassId }).del();
    if (profesorIds && profesorIds.length) {
      await trx('live_class_profesores').insert(
        profesorIds.map((profesorId) => ({ live_class_id: liveClassId, profesor_id: profesorId }))
      );
    }
  });
}

function listProfesores(liveClassId) {
  return db('live_class_profesores as lcp')
    .join('users as u', 'u.id', 'lcp.profesor_id')
    .where('lcp.live_class_id', liveClassId)
    .select('u.id', 'u.nombre', 'u.apellido', 'u.email');
}

async function esProfesorAsignado(liveClassId, profesorId) {
  const fila = await db('live_class_profesores')
    .where({ live_class_id: liveClassId, profesor_id: profesorId })
    .first();
  return Boolean(fila);
}

// Acceso del alumno a la sala: tiene que estar inscripto en el curso de
// esa clase. La visibilidad de la sala en sí (¿ya está "en_vivo"?) la
// valida el controller aparte — esto solo responde "¿es alumno de este
// curso?".
async function alumnoTieneAcceso(liveClassId, alumnoId) {
  const clase = await findById(liveClassId);
  if (!clase) return false;
  const inscripcion = await db('enrollments')
    .where({ user_id: alumnoId, course_id: clase.course_id })
    .first();
  return Boolean(inscripcion);
}

module.exports = {
  create,
  findById,
  findByIdConCurso,
  listForAdmin,
  listForAlumno,
  listForProfesor,
  update,
  updateEstado,
  cancelar,
  marcarIniciada,
  marcarFinalizada,
  asignarProfesores,
  reasignarProfesores,
  listProfesores,
  esProfesorAsignado,
  alumnoTieneAcceso,
};
