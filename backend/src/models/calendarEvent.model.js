const db = require('../config/db');

function create(data) {
  return db('calendar_events').insert(data);
}

function findById(id) {
  return db('calendar_events').where({ id }).first();
}

// Es la base de "que no se sobrepongan": ¿ese profesor ya tiene un turno
// ACEPTADO cuyo rango se cruza con [startsAt, endsAt)? Se usa dos veces:
// al solicitar (no dejamos pedir un horario ya confirmado) y al aceptar
// (por si mientras tanto se confirmó otro turno que se superponía y
// todavía estaba pendiente).
async function hasOverlap(profesorId, startsAt, endsAt, { excludeId } = {}) {
  const query = db('calendar_events')
    .where('profesor_id', profesorId)
    .where('estado', 'aceptada')
    .where('starts_at', '<', endsAt)
    .where('ends_at', '>', startsAt);
  if (excludeId) query.andWhere('id', '!=', excludeId);
  const fila = await query.first();
  return Boolean(fila);
}

function listForAlumno(alumnoId) {
  return db('calendar_events as e')
    .join('users as p', 'p.id', 'e.profesor_id')
    .leftJoin('courses as c', 'c.id', 'e.course_id')
    .where('e.alumno_id', alumnoId)
    .select(
      'e.*',
      'p.nombre as profesor_nombre',
      'p.apellido as profesor_apellido',
      'c.titulo as curso_titulo'
    )
    .orderBy('e.starts_at', 'desc');
}

function listForProfesor(profesorId) {
  return db('calendar_events as e')
    .join('users as a', 'a.id', 'e.alumno_id')
    .leftJoin('courses as c', 'c.id', 'e.course_id')
    .where('e.profesor_id', profesorId)
    .select(
      'e.*',
      'a.nombre as alumno_nombre',
      'a.apellido as alumno_apellido',
      'c.titulo as curso_titulo'
    )
    .orderBy('e.starts_at', 'desc');
}

// Registro completo: lo usa el panel de admin para ver todos los turnos de
// la plataforma, con filtro opcional por estado.
function listAll({ estado } = {}) {
  const query = db('calendar_events as e')
    .join('users as a', 'a.id', 'e.alumno_id')
    .join('users as p', 'p.id', 'e.profesor_id')
    .leftJoin('courses as c', 'c.id', 'e.course_id')
    .select(
      'e.*',
      'a.nombre as alumno_nombre',
      'a.apellido as alumno_apellido',
      'p.nombre as profesor_nombre',
      'p.apellido as profesor_apellido',
      'c.titulo as curso_titulo'
    )
    .orderBy('e.starts_at', 'desc');
  if (estado) query.where('e.estado', estado);
  return query;
}

function updateEstado(id, estado, extra = {}) {
  return db('calendar_events')
    .where({ id })
    .update({ estado, ...extra, updated_at: db.fn.now() });
}

// --- Recordatorio 30 minutos antes (ver jobs/recordatorioCitas.job.js) ---

// Turnos aceptados, todavía no arrancaron, cuyo inicio ya entró en la
// ventana de anticipación configurada y todavía no se les mandó el
// recordatorio. El límite inferior (starts_at > ahora) evita mandar
// recordatorios "tardíos" de turnos que ya pasaron, por ejemplo si el
// servidor estuvo caído un rato.
function listParaRecordatorio(minutosAnticipacion) {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + minutosAnticipacion * 60 * 1000);
  return db('calendar_events as e')
    .join('users as a', 'a.id', 'e.alumno_id')
    .join('users as p', 'p.id', 'e.profesor_id')
    .leftJoin('courses as c', 'c.id', 'e.course_id')
    .where('e.estado', 'aceptada')
    .whereNull('e.recordatorio_enviado_at')
    .where('e.starts_at', '>', ahora)
    .where('e.starts_at', '<=', limite)
    .select(
      'e.*',
      'a.nombre as alumno_nombre', 'a.email as alumno_email',
      'p.nombre as profesor_nombre', 'p.email as profesor_email',
      'c.titulo as curso_titulo'
    );
}

function marcarRecordatorioEnviado(id) {
  return db('calendar_events').where({ id }).update({ recordatorio_enviado_at: db.fn.now() });
}

module.exports = {
  create,
  findById,
  hasOverlap,
  listForAlumno,
  listForProfesor,
  listAll,
  updateEstado,
  listParaRecordatorio,
  marcarRecordatorioEnviado,
};
