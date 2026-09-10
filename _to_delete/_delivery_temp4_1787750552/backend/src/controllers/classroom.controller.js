const courseModel = require('../models/course.model');
const enrollmentModel = require('../models/enrollment.model');
const assignmentModel = require('../models/assignment.model');
const submissionModel = require('../models/submission.model');
const achievementModel = require('../models/achievement.model');
const userModel = require('../models/user.model');
const storageService = require('../services/storage.service');
const mailService = require('../services/mail.service');
const { notificarCursoCompletado } = require('../services/lti/gradePassback.hook');
const env = require('../config/env');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Chequea que el usuario tenga acceso al classroom del curso: o es el
// profesor dueño del curso, o es un alumno inscripto.
async function checkAccess(courseId, user) {
  const course = await courseModel.findById(courseId);
  if (!course) throw new AppError('Curso no encontrado', 404);

  if (user.rol === 'profesor' && course.profesor_id === user.id) {
    return { course, esProfesorDelCurso: true };
  }
  // "fuera_sistema": ni un alumno que ya estaba inscripto puede seguir
  // entrando (el profesor dueño, arriba, sigue pudiendo — ver
  // estadosCurso.js). Un "cancelado" no cae acá a propósito.
  if (course.estado === 'fuera_sistema') {
    throw new AppError('Este curso ya no está disponible', 403);
  }
  const inscripcion = await enrollmentModel.findByUserAndCourse(user.id, courseId);
  if (!inscripcion) {
    throw new AppError('No tenés acceso al classroom de este curso', 403);
  }
  return { course, esProfesorDelCurso: false };
}

const listAssignments = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  await checkAccess(courseId, req.user);
  const assignments = await assignmentModel.listByCourse(courseId);

  // Si es alumno, le sumamos el estado de su propia entrega en cada tarea
  // para que el frontend pueda mostrar "pendiente/entregado/revisado".
  if (req.user.rol === 'alumno') {
    const conEstado = await Promise.all(
      assignments.map(async (a) => {
        const entrega = await submissionModel.findByAssignmentAndUser(a.id, req.user.id);
        return { ...a, mi_entrega: entrega || null };
      })
    );
    return res.json({ assignments: conEstado });
  }

  res.json({ assignments });
});

const createAssignment = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { esProfesorDelCurso } = await checkAccess(courseId, req.user);
  if (!esProfesorDelCurso) {
    throw new AppError('Solo el profesor del curso puede crear tareas', 403);
  }

  const { titulo, descripcion, fecha_entrega } = req.body;
  if (!titulo || !descripcion) throw new AppError('Faltan título y/o descripción de la tarea', 400);

  const [id] = await assignmentModel.create({
    course_id: courseId,
    profesor_id: req.user.id,
    titulo,
    descripcion,
    fecha_entrega: fecha_entrega || null,
  });
  const assignment = await assignmentModel.findById(id);
  res.status(201).json({ assignment });
});

// Alumno sube (o vuelve a subir) el archivo de una tarea.
const submitAssignment = asyncHandler(async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const assignment = await assignmentModel.findById(assignmentId);
  if (!assignment) throw new AppError('Tarea no encontrada', 404);

  await checkAccess(assignment.course_id, req.user);
  if (req.user.rol !== 'alumno') {
    throw new AppError('Solo un alumno puede entregar una tarea', 403);
  }
  if (!req.file) {
    throw new AppError('Falta el archivo de la entrega', 400);
  }

  const yaEntrego = await submissionModel.findByAssignmentAndUser(assignmentId, req.user.id);
  if (yaEntrego) {
    throw new AppError('Ya entregaste esta tarea. Contactá al profesor si necesitás re-entregarla.', 409);
  }

  const relativePath = storageService.buildPublicUrl('tareas', req.file.filename);
  const [id] = await submissionModel.create({
    assignment_id: assignmentId,
    user_id: req.user.id,
    archivo_path: relativePath,
    archivo_nombre_original: req.file.originalname,
    comentario_alumno: req.body.comentario || null,
  });

  // Logro por la primera entrega realizada.
  await achievementModel.grantIfNotExists(req.user.id, 'primera_entrega');

  const submission = await submissionModel.findById(id);
  res.status(201).json({ submission });
});

// Profesor ve todas las entregas de una tarea.
const listSubmissions = asyncHandler(async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const assignment = await assignmentModel.findById(assignmentId);
  if (!assignment) throw new AppError('Tarea no encontrada', 404);

  const { esProfesorDelCurso } = await checkAccess(assignment.course_id, req.user);
  if (!esProfesorDelCurso) {
    throw new AppError('Solo el profesor del curso puede ver las entregas', 403);
  }

  const submissions = await submissionModel.listByAssignment(assignmentId);
  res.json({ submissions });
});

// Profesor califica/deja feedback en una entrega puntual.
const gradeSubmission = asyncHandler(async (req, res) => {
  const submissionId = Number(req.params.submissionId);
  const submission = await submissionModel.findById(submissionId);
  if (!submission) throw new AppError('Entrega no encontrada', 404);

  const assignment = await assignmentModel.findById(submission.assignment_id);
  const { esProfesorDelCurso } = await checkAccess(assignment.course_id, req.user);
  if (!esProfesorDelCurso) {
    throw new AppError('Solo el profesor del curso puede calificar', 403);
  }

  const { calificacion, feedback_profesor } = req.body;
  await submissionModel.grade(submissionId, { calificacion, feedback_profesor });
  const actualizada = await submissionModel.findById(submissionId);
  res.json({ submission: actualizada });
});

// Alumnos inscriptos en el curso, para que el profesor (o un admin) pueda
// marcar la cursada de cada uno como completada.
const listStudents = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  const course = await courseModel.findById(courseId);
  if (!course) throw new AppError('Curso no encontrado', 404);

  const puedeVer = req.user.rol === 'admin' || (req.user.rol === 'profesor' && course.profesor_id === req.user.id);
  if (!puedeVer) {
    throw new AppError('Solo el profesor del curso o un admin pueden ver esta lista', 403);
  }

  const students = await enrollmentModel.listStudentsForCourse(courseId);
  res.json({ students });
});

// El profesor del curso (o un admin) marca la cursada de un alumno como
// completada. Esto alimenta la métrica "cursos completados" del dashboard
// de admin, le otorga al alumno el logro "curso_completado" y le manda el
// mail de felicitaciones.
const markCompleted = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  const userId = Number(req.params.userId);

  const course = await courseModel.findById(courseId);
  if (!course) throw new AppError('Curso no encontrado', 404);

  const puedeMarcar = req.user.rol === 'admin' || (req.user.rol === 'profesor' && course.profesor_id === req.user.id);
  if (!puedeMarcar) {
    throw new AppError('Solo el profesor del curso o un admin pueden marcar la cursada como completada', 403);
  }

  const inscripcion = await enrollmentModel.findByUserAndCourse(userId, courseId);
  if (!inscripcion) throw new AppError('Ese alumno no está inscripto en este curso', 404);

  await enrollmentModel.marcarCompletado(userId, courseId);
  await achievementModel.grantIfNotExists(userId, 'curso_completado');
  // No lleva await: si viene de un launch de LTI con AGS habilitado, manda
  // la nota en segundo plano — no tiene que demorar ni poder romper esta
  // respuesta (ver gradePassback.hook.js sobre por qué es best-effort).
  notificarCursoCompletado(userId, courseId);

  const alumno = await userModel.findById(userId);
  if (alumno) {
    await mailService.enviarMail({
      clave: 'felicitaciones_curso',
      destinatario: alumno.email,
      variables: { nombre: alumno.nombre, curso: course.titulo, link_logros: `${env.FRONTEND_URL}/logros` },
      userId: alumno.id,
    });
  }

  res.json({ ok: true });
});

module.exports = {
  listAssignments,
  createAssignment,
  submitAssignment,
  listSubmissions,
  gradeSubmission,
  listStudents,
  markCompleted,
};
