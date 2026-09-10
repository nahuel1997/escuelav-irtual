// =============================================================================
// liveClasses.controller.js — Clases en vivo.
//
// Tres públicos distintos comparten este controller (se separan por rutas
// en liveClasses.routes.js / admin.routes.js, no por archivo):
//   - Admin: agenda, edita y cancela clases (única vía de creación — ver
//     clarificación del usuario: "solo el admin" agenda).
//   - Profesor: inicia y finaliza la transmisión de las clases donde está
//     asignado (puede haber más de uno por clase, co-dictado).
//   - Alumno y profesor comparten: "mis clases", entrar a la sala, e
//     historial del chat.
//
// Máquina de estados (ver también la migración 20260828000001):
//   programada → en_vivo → finalizada
//   programada → cancelada
// No hay transición de vuelta atrás en ningún caso.
//
// El chat EN VIVO (mensajes en tiempo real) no vive acá — ver
// realtime/liveClassSocket.js. Este controller sí expone el HISTORIAL
// (REST, carga inicial al abrir la sala) y dispara emitirCambioEstado()
// para que quien esté conectado al socket se entere sin refrescar.
// =============================================================================
const liveClassModel = require('../models/liveClass.model');
const liveClassMessageModel = require('../models/liveClassMessage.model');
const courseModel = require('../models/course.model');
const userModel = require('../models/user.model');
const enrollmentModel = require('../models/enrollment.model');
const mailService = require('../services/mail.service');
const contentModel = require('../models/content.model');
const env = require('../config/env');
const { formatFecha, formatHora } = require('../utils/fecha');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');
const { emitirCambioEstado } = require('../realtime/liveClassSocket');

// --- Helpers compartidos --------------------------------------------------

async function validarProfesores(profesorIds) {
  if (!Array.isArray(profesorIds) || !profesorIds.length) {
    throw new AppError('Tenés que asignar al menos un profesor', 400);
  }
  const profesores = await Promise.all(profesorIds.map((id) => userModel.findById(id)));
  const invalido = profesores.find((p) => !p || p.rol !== 'profesor');
  if (invalido) throw new AppError('Uno de los profesores indicados no es válido', 400);
  return profesores;
}

// Manda el mail de aviso (programada o cancelada) a todos los alumnos
// inscriptos en el curso y a todos los profesores asignados. Best effort:
// un fallo de mail no debe romper la respuesta del endpoint (mismo
// criterio que avisarAmbasPartes en calendar.controller.js).
async function avisarClase(clave, clase, course, profesores) {
  const zona = await contentModel.getValor('general.zona_horaria');
  const linkClases = `${env.FRONTEND_URL}/clases-en-vivo`;
  const variablesComunes = {
    titulo: clase.titulo,
    curso: course.titulo,
    fecha: formatFecha(clase.scheduled_at, zona),
    hora: formatHora(clase.scheduled_at, zona),
    link_clases: linkClases,
  };

  const alumnos = await enrollmentModel.listStudentsForCourse(course.id);
  const destinatarios = [
    ...alumnos.map((a) => ({ id: a.id, nombre: a.nombre, email: a.email })),
    ...profesores.map((p) => ({ id: p.id, nombre: p.nombre, email: p.email })),
  ];

  await Promise.all(
    destinatarios.map((dest) =>
      mailService.enviarMail({
        clave,
        destinatario: dest.email,
        variables: { ...variablesComunes, nombre_destinatario: dest.nombre },
        userId: dest.id,
      })
    )
  );
}

// Trae la clase y valida que quien pide (alumno o profesor) tenga alguna
// relación con ella — no valida todavía el ESTADO (eso lo hace cada acción
// puntual, getSala en particular, según a quién le toca ver qué).
async function cargarClaseDeParte(id, user) {
  const clase = await liveClassModel.findByIdConCurso(id);
  if (!clase) throw new AppError('Clase no encontrada', 404);

  const autorizado =
    user.rol === 'profesor'
      ? await liveClassModel.esProfesorAsignado(clase.id, user.id)
      : await liveClassModel.alumnoTieneAcceso(clase.id, user.id);
  if (!autorizado) throw new AppError('No tenés acceso a esta clase', 403);

  return clase;
}

// --- Admin: agendar / listar / editar / cancelar --------------------------

const crear = asyncHandler(async (req, res) => {
  const { course_id, titulo, descripcion, scheduled_at, duracion_minutos, profesor_ids } = req.body;
  if (!course_id || !titulo || !scheduled_at) {
    throw new AppError('Faltan datos: curso, título y fecha/hora', 400);
  }

  const course = await courseModel.findById(course_id);
  if (!course) throw new AppError('El curso indicado no existe', 400);

  const fecha = new Date(scheduled_at);
  if (Number.isNaN(fecha.getTime())) throw new AppError('La fecha/hora no es válida', 400);
  if (fecha.getTime() < Date.now()) {
    throw new AppError('No podés agendar una clase en una fecha ya pasada', 400);
  }

  const profesores = await validarProfesores(profesor_ids);

  const clase = await liveClassModel.create({
    courseId: course_id,
    titulo,
    descripcion,
    scheduledAt: fecha,
    duracionMinutos: duracion_minutos,
    creadoPor: req.user.id,
    profesorIds: profesor_ids,
  });

  await avisarClase('clase_en_vivo_programada', clase, course, profesores).catch((e) =>
    console.error('[clases en vivo] falló el aviso de creación', e.message)
  );

  res.status(201).json({
    clase: await liveClassModel.findByIdConCurso(clase.id),
    profesores: await liveClassModel.listProfesores(clase.id),
  });
});

const listar = asyncHandler(async (req, res) => {
  const { course_id, estado } = req.query;
  const clases = await liveClassModel.listForAdmin({ courseId: course_id, estado });
  res.json({ clases });
});

const obtener = asyncHandler(async (req, res) => {
  const clase = await liveClassModel.findByIdConCurso(Number(req.params.id));
  if (!clase) throw new AppError('Clase no encontrada', 404);
  res.json({ clase, profesores: await liveClassModel.listProfesores(clase.id) });
});

// Solo se puede editar mientras sigue 'programada' — una vez que arrancó
// (o se canceló/finalizó) ya no tiene sentido tocar horario/profesores.
const editar = asyncHandler(async (req, res) => {
  const clase = await liveClassModel.findById(Number(req.params.id));
  if (!clase) throw new AppError('Clase no encontrada', 404);
  if (clase.estado !== 'programada') {
    throw new AppError('Solo se puede editar una clase que todavía no empezó', 409);
  }

  const { titulo, descripcion, scheduled_at, duracion_minutos, profesor_ids } = req.body;
  const data = {};
  if (titulo) data.titulo = titulo;
  if (descripcion !== undefined) data.descripcion = descripcion || null;
  if (scheduled_at) {
    const fecha = new Date(scheduled_at);
    if (Number.isNaN(fecha.getTime())) throw new AppError('La fecha/hora no es válida', 400);
    data.scheduled_at = fecha;
  }
  if (duracion_minutos) data.duracion_minutos = duracion_minutos;
  if (Object.keys(data).length) await liveClassModel.update(clase.id, data);

  if (profesor_ids !== undefined) {
    await validarProfesores(profesor_ids);
    await liveClassModel.reasignarProfesores(clase.id, profesor_ids);
  }

  // A propósito, no se manda mail al editar (ver clarificación del
  // usuario/decisión de diseño): reprogramar horarios o cambiar el
  // temario de la clase suele iterarse varias veces antes de confirmarse
  // del todo, y mandar un mail por cada ajuste sería spamear a los
  // alumnos. Si se cambia la fecha, alcanza con que la vean actualizada
  // en su pestaña de clases en vivo.
  res.json({
    clase: await liveClassModel.findByIdConCurso(clase.id),
    profesores: await liveClassModel.listProfesores(clase.id),
  });
});

const cancelar = asyncHandler(async (req, res) => {
  const clase = await liveClassModel.findById(Number(req.params.id));
  if (!clase) throw new AppError('Clase no encontrada', 404);
  if (clase.estado !== 'programada') {
    throw new AppError('Esta clase ya no se puede cancelar', 409);
  }

  await liveClassModel.cancelar(clase.id);

  const [course, profesores] = await Promise.all([
    courseModel.findById(clase.course_id),
    liveClassModel.listProfesores(clase.id),
  ]);
  const actualizada = await liveClassModel.findByIdConCurso(clase.id);

  await avisarClase('clase_en_vivo_cancelada', actualizada, course, profesores).catch((e) =>
    console.error('[clases en vivo] falló el aviso de cancelación', e.message)
  );
  emitirCambioEstado(clase.id, 'cancelada');

  res.json({ clase: actualizada });
});

// --- Profesor: iniciar / finalizar la transmisión --------------------------

const iniciar = asyncHandler(async (req, res) => {
  const clase = await liveClassModel.findById(Number(req.params.id));
  if (!clase) throw new AppError('Clase no encontrada', 404);
  const asignado = await liveClassModel.esProfesorAsignado(clase.id, req.user.id);
  if (!asignado) throw new AppError('No estás asignado a esta clase', 403);
  if (clase.estado !== 'programada') {
    throw new AppError('Esta clase no se puede iniciar en su estado actual', 409);
  }

  await liveClassModel.marcarIniciada(clase.id);
  emitirCambioEstado(clase.id, 'en_vivo');

  res.json({ clase: await liveClassModel.findByIdConCurso(clase.id) });
});

const finalizar = asyncHandler(async (req, res) => {
  const clase = await liveClassModel.findById(Number(req.params.id));
  if (!clase) throw new AppError('Clase no encontrada', 404);
  const asignado = await liveClassModel.esProfesorAsignado(clase.id, req.user.id);
  if (!asignado) throw new AppError('No estás asignado a esta clase', 403);
  if (clase.estado !== 'en_vivo') {
    throw new AppError('Esta clase no se puede finalizar en su estado actual', 409);
  }

  await liveClassModel.marcarFinalizada(clase.id);
  emitirCambioEstado(clase.id, 'finalizada');

  res.json({ clase: await liveClassModel.findByIdConCurso(clase.id) });
});

// --- Compartido: alumno y profesor -----------------------------------------

const listMias = asyncHandler(async (req, res) => {
  const clases =
    req.user.rol === 'profesor'
      ? await liveClassModel.listForProfesor(req.user.id)
      : await liveClassModel.listForAlumno(req.user.id);
  res.json({ clases });
});

// Revela room_id (y el dominio de Jitsi) solo cuando corresponde: al
// profesor asignado, mientras la clase no terminó ni se canceló (la
// necesita tanto para prepararse antes de "iniciar" como durante la
// transmisión); al alumno inscripto, recién cuando la clase está
// efectivamente 'en_vivo' — ver nota en la migración de live_classes.
const getSala = asyncHandler(async (req, res) => {
  const clase = await cargarClaseDeParte(Number(req.params.id), req.user);

  if (req.user.rol === 'profesor') {
    if (!['programada', 'en_vivo'].includes(clase.estado)) {
      throw new AppError('Esta clase no tiene una sala disponible', 409);
    }
  } else if (clase.estado !== 'en_vivo') {
    throw new AppError('Esta clase todavía no empezó, o ya terminó', 409);
  }

  res.json({ clase, room_id: clase.room_id, jitsi_domain: env.JITSI_DOMAIN });
});

// Historial del chat: el profesor lo puede ver siempre que esté asignado
// (para repasar clases anteriores); al alumno se le abre recién cuando la
// clase arrancó (en_vivo) o ya pasó (finalizada) — no tiene sentido antes,
// no hay nada escrito todavía.
const listMensajes = asyncHandler(async (req, res) => {
  const clase = await cargarClaseDeParte(Number(req.params.id), req.user);

  if (req.user.rol !== 'profesor' && !['en_vivo', 'finalizada'].includes(clase.estado)) {
    throw new AppError('Todavía no hay chat disponible para esta clase', 409);
  }

  res.json({ mensajes: await liveClassMessageModel.listByLiveClass(clase.id) });
});

module.exports = {
  crear,
  listar,
  obtener,
  editar,
  cancelar,
  iniciar,
  finalizar,
  listMias,
  getSala,
  listMensajes,
};
