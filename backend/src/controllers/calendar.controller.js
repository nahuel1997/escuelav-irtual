const calendarModel = require('../models/calendarEvent.model');
const userModel = require('../models/user.model');
const courseModel = require('../models/course.model');
const contentModel = require('../models/content.model');
const mailService = require('../services/mail.service');
const env = require('../config/env');
const { formatFecha, formatHora } = require('../utils/fecha');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Manda el mismo mail (clave: 'cita_creada' o 'cita_aprobada') a las dos
// partes del turno, cada una con el nombre de "la otra parte" en su
// versión. Best effort: si un envío falla, no rompe la respuesta del
// endpoint (ver mail.service.js). La fecha/hora que ve cada uno en el
// mail respeta la zona horaria configurada en Contenido > Generales
// (general.zona_horaria) — no la hora del servidor.
async function avisarAmbasPartes(clave, { alumno, profesor, motivo, starts_at }) {
  const zona = await contentModel.getValor('general.zona_horaria');
  const linkCalendario = `${env.FRONTEND_URL}/calendario`;
  const variablesComunes = {
    motivo,
    fecha: formatFecha(starts_at, zona),
    hora: formatHora(starts_at, zona),
    link_calendario: linkCalendario,
  };
  await mailService.enviarMail({
    clave,
    destinatario: alumno.email,
    variables: { ...variablesComunes, nombre_destinatario: alumno.nombre, nombre_otro_parte: `${profesor.nombre} ${profesor.apellido}` },
    userId: alumno.id,
  });
  await mailService.enviarMail({
    clave,
    destinatario: profesor.email,
    variables: { ...variablesComunes, nombre_destinatario: profesor.nombre, nombre_otro_parte: `${alumno.nombre} ${alumno.apellido}` },
    userId: profesor.id,
  });
}

// "Mis turnos": alumno ve los que solicitó, profesor ve los que le pidieron
// (incluye pendientes, aceptados, rechazados y cancelados — el frontend
// separa por estado).
const listMisTurnos = asyncHandler(async (req, res) => {
  const eventos =
    req.user.rol === 'profesor'
      ? await calendarModel.listForProfesor(req.user.id)
      : await calendarModel.listForAlumno(req.user.id);
  res.json({ eventos });
});

// Alumno solicita un turno con un profesor. Queda en estado "pendiente"
// hasta que el profesor lo acepte o lo rechace.
const solicitarTurno = asyncHandler(async (req, res) => {
  if (req.user.rol !== 'alumno') {
    throw new AppError('Solo un alumno puede solicitar un turno', 403);
  }

  const { profesor_id, course_id, motivo, starts_at, ends_at, notas_alumno } = req.body;
  if (!profesor_id || !motivo || !starts_at || !ends_at) {
    throw new AppError('Faltan datos: profesor, motivo, y horario de inicio y fin', 400);
  }

  const profesor = await userModel.findById(profesor_id);
  if (!profesor || profesor.rol !== 'profesor') {
    throw new AppError('El profesor seleccionado no es válido', 400);
  }

  const inicio = new Date(starts_at);
  const fin = new Date(ends_at);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || inicio >= fin) {
    throw new AppError('El horario de inicio y fin no es válido', 400);
  }
  if (inicio.getTime() < Date.now()) {
    throw new AppError('No podés solicitar un turno en una fecha ya pasada', 400);
  }

  if (course_id) {
    const course = await courseModel.findById(course_id);
    if (!course) throw new AppError('El curso indicado no existe', 400);
  }

  // Acá es donde se evita que dos turnos confirmados se sobrepongan: si el
  // profesor ya tiene un turno ACEPTADO que cruza este horario, se corta acá.
  const superpuesto = await calendarModel.hasOverlap(profesor_id, inicio, fin);
  if (superpuesto) {
    throw new AppError('Ese profesor ya tiene un turno confirmado en ese horario. Elegí otro horario.', 409);
  }

  const [id] = await calendarModel.create({
    alumno_id: req.user.id,
    profesor_id,
    course_id: course_id || null,
    motivo,
    starts_at: inicio,
    ends_at: fin,
    estado: 'pendiente',
    notas_alumno: notas_alumno || null,
  });

  const evento = await calendarModel.findById(id);

  const alumno = await userModel.findById(req.user.id);
  await avisarAmbasPartes('cita_creada', { alumno, profesor, motivo, starts_at: inicio });

  res.status(201).json({ evento });
});

// Trae el turno y valida que quien lo pide sea el alumno o el profesor
// involucrados (nadie más puede verlo/tocarlo desde este endpoint).
async function cargarTurnoDeParte(id, user) {
  const evento = await calendarModel.findById(id);
  if (!evento) throw new AppError('Turno no encontrado', 404);
  const esParte = evento.alumno_id === user.id || evento.profesor_id === user.id;
  if (!esParte) throw new AppError('No tenés acceso a este turno', 403);
  return evento;
}

const aceptarTurno = asyncHandler(async (req, res) => {
  const evento = await cargarTurnoDeParte(Number(req.params.id), req.user);
  if (evento.profesor_id !== req.user.id) {
    throw new AppError('Solo el profesor del turno puede aceptarlo', 403);
  }
  if (evento.estado !== 'pendiente') {
    throw new AppError('Este turno ya fue resuelto', 409);
  }

  // Segundo chequeo de superposición: puede haber pasado que, entre que se
  // solicitó este turno y ahora, el profesor aceptó otro que se cruza.
  const superpuesto = await calendarModel.hasOverlap(evento.profesor_id, evento.starts_at, evento.ends_at, {
    excludeId: evento.id,
  });
  if (superpuesto) {
    throw new AppError('Ya tenés otro turno aceptado que se superpone con este horario', 409);
  }

  await calendarModel.updateEstado(evento.id, 'aceptada', { notas_profesor: req.body.notas_profesor || null });
  const actualizado = await calendarModel.findById(evento.id);

  const [alumno, profesor] = await Promise.all([
    userModel.findById(evento.alumno_id),
    userModel.findById(evento.profesor_id),
  ]);
  await avisarAmbasPartes('cita_aprobada', { alumno, profesor, motivo: evento.motivo, starts_at: evento.starts_at });

  res.json({ evento: actualizado });
});

const rechazarTurno = asyncHandler(async (req, res) => {
  const evento = await cargarTurnoDeParte(Number(req.params.id), req.user);
  if (evento.profesor_id !== req.user.id) {
    throw new AppError('Solo el profesor del turno puede rechazarlo', 403);
  }
  if (evento.estado !== 'pendiente') {
    throw new AppError('Este turno ya fue resuelto', 409);
  }

  await calendarModel.updateEstado(evento.id, 'rechazada', { notas_profesor: req.body.notas_profesor || null });
  res.json({ evento: await calendarModel.findById(evento.id) });
});

// Cancelar lo puede hacer cualquiera de las dos partes, mientras el turno
// siga pendiente o aceptado (no tiene sentido cancelar uno ya rechazado o
// ya cancelado).
const cancelarTurno = asyncHandler(async (req, res) => {
  const evento = await cargarTurnoDeParte(Number(req.params.id), req.user);
  if (!['pendiente', 'aceptada'].includes(evento.estado)) {
    throw new AppError('Este turno ya no se puede cancelar', 409);
  }

  await calendarModel.updateEstado(evento.id, 'cancelada', {});
  res.json({ evento: await calendarModel.findById(evento.id) });
});

module.exports = { listMisTurnos, solicitarTurno, aceptarTurno, rechazarTurno, cancelarTurno };
