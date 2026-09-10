// Curriculum de un curso: unidades → capítulos, con su lógica de
// desbloqueo, progreso de video, comentarios y archivos de utilidad. Vive
// separado de classroom.controller.js (que es solo tareas/entregas)
// porque es un dominio bastante más grande — ambos se montan bajo
// /api/classroom en app.js.
const db = require('../config/db');
const courseModel = require('../models/course.model');
const enrollmentModel = require('../models/enrollment.model');
const courseUnitModel = require('../models/courseUnit.model');
const courseChapterModel = require('../models/courseChapter.model');
const chapterFileModel = require('../models/chapterFile.model');
const chapterCommentModel = require('../models/chapterComment.model');
const chapterProgressModel = require('../models/chapterProgress.model');
const achievementModel = require('../models/achievement.model');
const storageService = require('../services/storage.service');
const curriculumService = require('../services/curriculum.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// --- Helpers de acceso -------------------------------------------------

// Ver el contenido del curso: el profesor dueño, o un alumno inscripto
// (mismo criterio que classroom.controller.js para tareas).
async function checkVerAcceso(courseId, user) {
  const course = await courseModel.findById(courseId);
  if (!course) throw new AppError('Curso no encontrado', 404);

  if (user.rol === 'profesor' && course.profesor_id === user.id) {
    return { course, esGestor: true };
  }
  if (user.rol === 'admin') {
    return { course, esGestor: true };
  }
  // "fuera_sistema": ni un alumno que ya estaba inscripto puede seguir
  // entrando al temario (el profesor dueño y el admin, arriba, siguen
  // pudiendo — ver estadosCurso.js). Un "cancelado" no cae acá a propósito.
  if (course.estado === 'fuera_sistema') {
    throw new AppError('Este curso ya no está disponible', 403);
  }
  const inscripcion = await enrollmentModel.findByUserAndCourse(user.id, courseId);
  if (!inscripcion) {
    throw new AppError('No tenés acceso al contenido de este curso', 403);
  }
  return { course, esGestor: false };
}

// Gestionar (crear/editar/borrar unidades, capítulos, archivos, settings):
// solo el profesor dueño del curso o un admin.
async function checkGestionAcceso(courseId, user) {
  const course = await courseModel.findById(courseId);
  if (!course) throw new AppError('Curso no encontrado', 404);

  const puede = user.rol === 'admin' || (user.rol === 'profesor' && course.profesor_id === user.id);
  if (!puede) throw new AppError('Solo el profesor del curso o un admin pueden editar el contenido', 403);
  return course;
}

async function findUnitOrFail(unitId) {
  const unit = await courseUnitModel.findById(unitId);
  if (!unit) throw new AppError('Unidad no encontrada', 404);
  return unit;
}

async function findChapterOrFail(chapterId) {
  const chapter = await courseChapterModel.findById(chapterId);
  if (!chapter) throw new AppError('Capítulo no encontrado', 404);
  return chapter;
}

// --- Gestión: unidades ---------------------------------------------------

const createUnit = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  await checkGestionAcceso(courseId, req.user);

  const { titulo, introduccion, contenido } = req.body;
  if (!titulo) throw new AppError('Falta el título de la unidad', 400);

  const orden = await courseUnitModel.proximoOrden(courseId);
  const [id] = await courseUnitModel.create({
    course_id: courseId,
    titulo,
    introduccion: introduccion || null,
    contenido: contenido || null,
    orden,
  });
  const unit = await courseUnitModel.findById(id);
  res.status(201).json({ unit });
});

const updateUnit = asyncHandler(async (req, res) => {
  const unit = await findUnitOrFail(req.params.unitId);
  await checkGestionAcceso(unit.course_id, req.user);

  const { titulo, introduccion, contenido, orden } = req.body;
  const data = {};
  if (titulo !== undefined) data.titulo = titulo;
  if (introduccion !== undefined) data.introduccion = introduccion;
  if (contenido !== undefined) data.contenido = contenido;
  if (orden !== undefined) data.orden = Number(orden);

  await courseUnitModel.update(unit.id, data);
  res.json({ unit: await courseUnitModel.findById(unit.id) });
});

const deleteUnit = asyncHandler(async (req, res) => {
  const unit = await findUnitOrFail(req.params.unitId);
  await checkGestionAcceso(unit.course_id, req.user);
  // ON DELETE CASCADE se encarga de sus capítulos, archivos, comentarios y
  // progreso asociados.
  await courseUnitModel.remove(unit.id);
  res.json({ ok: true });
});

// --- Gestión: capítulos ---------------------------------------------------

const createChapter = asyncHandler(async (req, res) => {
  const unit = await findUnitOrFail(req.params.unitId);
  await checkGestionAcceso(unit.course_id, req.user);

  const { titulo, video_url: videoUrl } = req.body;
  if (!titulo || !videoUrl) throw new AppError('Falta título o link del video', 400);

  const orden = await courseChapterModel.proximoOrden(unit.id);
  const [id] = await courseChapterModel.create({ unit_id: unit.id, titulo, video_url: videoUrl, orden });
  const chapter = await courseChapterModel.findById(id);
  res.status(201).json({ chapter });
});

const updateChapter = asyncHandler(async (req, res) => {
  const chapter = await findChapterOrFail(req.params.chapterId);
  const unit = await findUnitOrFail(chapter.unit_id);
  await checkGestionAcceso(unit.course_id, req.user);

  const { titulo, video_url: videoUrl, orden } = req.body;
  const data = {};
  if (titulo !== undefined) data.titulo = titulo;
  if (videoUrl !== undefined) data.video_url = videoUrl;
  if (orden !== undefined) data.orden = Number(orden);

  await courseChapterModel.update(chapter.id, data);
  res.json({ chapter: await courseChapterModel.findById(chapter.id) });
});

const deleteChapter = asyncHandler(async (req, res) => {
  const chapter = await findChapterOrFail(req.params.chapterId);
  const unit = await findUnitOrFail(chapter.unit_id);
  await checkGestionAcceso(unit.course_id, req.user);
  await courseChapterModel.remove(chapter.id);
  res.json({ ok: true });
});

// --- Gestión: archivos de utilidad ---------------------------------------

const uploadChapterFile = asyncHandler(async (req, res) => {
  const chapter = await findChapterOrFail(req.params.chapterId);
  const unit = await findUnitOrFail(chapter.unit_id);
  await checkGestionAcceso(unit.course_id, req.user);

  if (!req.file) throw new AppError('Falta el archivo', 400);

  const relativePath = storageService.buildPublicUrl('archivos-utiles', req.file.filename);
  const [id] = await chapterFileModel.create({
    chapter_id: chapter.id,
    archivo_path: relativePath,
    archivo_nombre_original: req.file.originalname,
  });
  const file = await chapterFileModel.findById(id);
  res.status(201).json({ file });
});

const deleteChapterFile = asyncHandler(async (req, res) => {
  const file = await chapterFileModel.findById(req.params.fileId);
  if (!file) throw new AppError('Archivo no encontrado', 404);
  const chapter = await findChapterOrFail(file.chapter_id);
  const unit = await findUnitOrFail(chapter.unit_id);
  await checkGestionAcceso(unit.course_id, req.user);

  await chapterFileModel.remove(file.id);
  res.json({ ok: true });
});

// --- Gestión: configuración de avance del curso --------------------------

const updateCourseSettings = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  await checkGestionAcceso(courseId, req.user);

  const { modo_avance: modoAvance, exigir_80_porciento: exigir80 } = req.body;
  const data = {};
  if (modoAvance !== undefined) {
    if (!curriculumService.MODOS_VALIDOS.includes(modoAvance)) {
      throw new AppError('Modo de avance inválido', 400);
    }
    data.modo_avance = modoAvance;
  }
  if (exigir80 !== undefined) data.exigir_80_porciento = Boolean(exigir80);

  await courseModel.update(courseId, data);
  const course = await courseModel.findById(courseId);
  res.json({ course });
});

// --- Consumo: curriculum completo del curso ------------------------------

const getCurriculum = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { course } = await checkVerAcceso(courseId, req.user);

  const chapters = await courseChapterModel.listByCourse(courseId);
  const progressList = await chapterProgressModel.listByUserAndCourse(req.user.id, courseId);
  const { capitulos, porcentaje_curso: porcentajeCurso } = curriculumService.calcularEstadoCurriculum(
    chapters,
    progressList,
    course.modo_avance
  );

  const units = await courseUnitModel.listByCourse(courseId);
  const unidades = units.map((unit) => {
    const capitulosDeLaUnidad = capitulos.filter((c) => c.unit_id === unit.id);
    const total = capitulosDeLaUnidad.length;
    const completados = capitulosDeLaUnidad.filter((c) => c.completado).length;
    return {
      ...unit,
      porcentaje_unidad: total > 0 ? Math.round((completados / total) * 100) : 0,
      capitulos: capitulosDeLaUnidad.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        orden: c.orden,
        completado: c.completado,
        porcentaje_visto: c.porcentaje_visto,
        desbloqueado: c.desbloqueado,
      })),
    };
  });

  res.json({
    modo_avance: course.modo_avance,
    exigir_80_porciento: Boolean(course.exigir_80_porciento),
    porcentaje_curso: porcentajeCurso,
    unidades,
  });
});

// --- Consumo: detalle de una unidad --------------------------------------

const getUnitDetail = asyncHandler(async (req, res) => {
  const unit = await findUnitOrFail(req.params.unitId);
  const { course } = await checkVerAcceso(unit.course_id, req.user);

  const chapters = await courseChapterModel.listByCourse(unit.course_id);
  const progressList = await chapterProgressModel.listByUserAndCourse(req.user.id, unit.course_id);
  const { capitulos, porcentaje_unidad: porcentajeUnidad } = curriculumService.calcularEstadoUnidad(
    unit.id,
    chapters,
    progressList,
    course.modo_avance
  );

  res.json({
    unit,
    porcentaje_unidad: porcentajeUnidad,
    capitulos: capitulos.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      orden: c.orden,
      completado: c.completado,
      porcentaje_visto: c.porcentaje_visto,
      desbloqueado: c.desbloqueado,
    })),
  });
});

// --- Consumo: detalle de un capítulo (video + navegación) ----------------

const getChapterDetail = asyncHandler(async (req, res) => {
  const chapter = await findChapterOrFail(req.params.chapterId);
  const unit = await findUnitOrFail(chapter.unit_id);
  const { course, esGestor } = await checkVerAcceso(unit.course_id, req.user);

  const chapters = await courseChapterModel.listByCourse(unit.course_id);
  const progressList = await chapterProgressModel.listByUserAndCourse(req.user.id, unit.course_id);
  const { capitulos } = curriculumService.calcularEstadoCurriculum(chapters, progressList, course.modo_avance);
  const estado = capitulos.find((c) => c.id === chapter.id);

  // El profesor/admin (esGestor) siempre puede previsualizar cualquier
  // capítulo, aunque para un alumno esté bloqueado — necesita poder
  // revisar su propio contenido sin tener que "jugarlo" como alumno.
  if (!estado.desbloqueado && !esGestor) {
    throw new AppError('Todavía no desbloqueaste este capítulo', 403);
  }

  const files = await chapterFileModel.listByChapter(chapter.id);
  // Estado del capítulo SIGUIENTE (no el actual): así el frontend sabe si
  // puede habilitar el botón "Siguiente" sin tener que adivinar la regla
  // de desbloqueo del lado del cliente — la única fuente de verdad de esa
  // regla es curriculum.service.js, acá del lado del servidor.
  const siguienteEstado = estado.siguiente_id ? capitulos.find((c) => c.id === estado.siguiente_id) : null;

  res.json({
    chapter: { id: chapter.id, titulo: chapter.titulo, video_url: chapter.video_url, unit_id: unit.id },
    unit: { id: unit.id, titulo: unit.titulo },
    archivos: files,
    completado: estado.completado,
    porcentaje_visto: estado.porcentaje_visto,
    desbloqueado: estado.desbloqueado,
    anterior_id: estado.anterior_id,
    siguiente_id: estado.siguiente_id,
    siguiente_desbloqueado: siguienteEstado ? siguienteEstado.desbloqueado : false,
    puede_marcar_visto: curriculumService.puedeMarcarComoVisto(estado.porcentaje_visto, course.exigir_80_porciento),
    exigir_80_porciento: Boolean(course.exigir_80_porciento),
    modo_avance: course.modo_avance,
  });
});

// --- Consumo: progreso de reproducción ------------------------------------

const updateProgress = asyncHandler(async (req, res) => {
  const chapter = await findChapterOrFail(req.params.chapterId);
  const unit = await findUnitOrFail(chapter.unit_id);
  await checkVerAcceso(unit.course_id, req.user);

  const segundosActuales = Math.max(0, Math.floor(Number(req.body.segundos_actuales) || 0));
  const duracionSegundos = Math.max(0, Math.floor(Number(req.body.duracion_segundos) || 0));
  if (!duracionSegundos) throw new AppError('Falta la duración del video', 400);

  const existente = await chapterProgressModel.findByUserAndChapter(req.user.id, chapter.id);
  // Guardamos el MÁXIMO alcanzado, no el último reportado: adelantar y
  // volver atrás no debe hacer bajar el progreso ya ganado.
  const segundosVistosMax = Math.max(existente?.segundos_vistos_max || 0, segundosActuales);
  const porcentajeVisto = curriculumService.calcularPorcentaje(segundosVistosMax, duracionSegundos);

  await chapterProgressModel.upsert(req.user.id, chapter.id, {
    segundos_vistos_max: segundosVistosMax,
    duracion_segundos: duracionSegundos,
    porcentaje_visto: porcentajeVisto,
  });

  res.json({ porcentaje_visto: porcentajeVisto });
});

// --- Consumo: marcar capítulo como visto ----------------------------------

const completeChapter = asyncHandler(async (req, res) => {
  const chapter = await findChapterOrFail(req.params.chapterId);
  const unit = await findUnitOrFail(chapter.unit_id);
  const { course } = await checkVerAcceso(unit.course_id, req.user);

  const progreso = await chapterProgressModel.findByUserAndChapter(req.user.id, chapter.id);
  const porcentajeVisto = progreso?.porcentaje_visto || 0;

  if (!curriculumService.puedeMarcarComoVisto(porcentajeVisto, course.exigir_80_porciento)) {
    throw new AppError('Necesitás ver al menos el 80% del video para marcar este capítulo como visto', 400);
  }

  await chapterProgressModel.upsert(req.user.id, chapter.id, {
    segundos_vistos_max: progreso?.segundos_vistos_max || 0,
    duracion_segundos: progreso?.duracion_segundos || null,
    porcentaje_visto: porcentajeVisto,
    completado: true,
    completado_at: db.fn.now(),
  });

  // Si es el último capítulo del curso, aprovechamos para el logro de
  // curso completado (mismo logro que ya usa markCompleted() del
  // profesor en classroom.controller.js, así el alumno lo recibe también
  // completando el temario por su cuenta, no solo si el profesor lo marca
  // a mano).
  const chapters = await courseChapterModel.listByCourse(unit.course_id);
  const progressList = await chapterProgressModel.listByUserAndCourse(req.user.id, unit.course_id);
  const { capitulos } = curriculumService.calcularEstadoCurriculum(chapters, progressList, course.modo_avance);
  const todosCompletados = capitulos.length > 0 && capitulos.every((c) => c.id === chapter.id ? true : c.completado);
  if (todosCompletados) {
    await achievementModel.grantIfNotExists(req.user.id, 'curso_completado');
  }

  res.json({ ok: true });
});

// --- Consumo: comentarios --------------------------------------------------

const listComments = asyncHandler(async (req, res) => {
  const chapter = await findChapterOrFail(req.params.chapterId);
  const unit = await findUnitOrFail(chapter.unit_id);
  const { esGestor } = await checkVerAcceso(unit.course_id, req.user);

  const comments = await chapterCommentModel.listByChapter(chapter.id);
  // Un comentario "oculto" (ver setCommentVisibility) sigue existiendo en
  // la base, pero un alumno no debe ni enterarse de que existe — no solo
  // no mostrarlo en el front, sino no mandarlo en la respuesta.
  const visibles = esGestor ? comments : comments.filter((c) => !c.oculto);
  res.json({ comments: visibles });
});

const createComment = asyncHandler(async (req, res) => {
  const chapter = await findChapterOrFail(req.params.chapterId);
  const unit = await findUnitOrFail(chapter.unit_id);
  await checkVerAcceso(unit.course_id, req.user);

  const { texto, parent_comment_id: parentComentarioId } = req.body;
  if (!texto || !texto.trim()) throw new AppError('El comentario no puede estar vacío', 400);

  let parentId = null;
  if (parentComentarioId) {
    const padre = await chapterCommentModel.findById(parentComentarioId);
    if (!padre || padre.chapter_id !== chapter.id) throw new AppError('El comentario al que intentás responder no existe en este capítulo', 400);
    parentId = padre.id;
  }

  const [id] = await chapterCommentModel.create({
    chapter_id: chapter.id,
    user_id: req.user.id,
    texto: texto.trim(),
    parent_comment_id: parentId,
  });
  const comment = await chapterCommentModel.findById(id);
  res.status(201).json({ comment });
});

// Ocultar (o volver a mostrar) un comentario sin borrarlo: pedido puntual
// para que el profesor/admin pueda moderar preguntas fuera de lugar sin
// perder el historial. Solo quien gestiona el curso puede hacerlo — un
// alumno no puede ocultar ni su propio comentario (para eso ya existe
// borrar, que sigue disponible).
const setCommentVisibility = asyncHandler(async (req, res) => {
  const comment = await chapterCommentModel.findById(req.params.commentId);
  if (!comment) throw new AppError('Comentario no encontrado', 404);
  const chapter = await findChapterOrFail(comment.chapter_id);
  const unit = await findUnitOrFail(chapter.unit_id);
  await checkGestionAcceso(unit.course_id, req.user);

  const { oculto } = req.body;
  if (typeof oculto !== 'boolean') throw new AppError('Falta indicar "oculto" (true/false)', 400);

  await chapterCommentModel.setOculto(comment.id, oculto);
  const actualizado = await chapterCommentModel.findById(comment.id);
  res.json({ comment: actualizado });
});

const deleteComment = asyncHandler(async (req, res) => {
  const comment = await chapterCommentModel.findById(req.params.commentId);
  if (!comment) throw new AppError('Comentario no encontrado', 404);
  const chapter = await findChapterOrFail(comment.chapter_id);
  const unit = await findUnitOrFail(chapter.unit_id);

  // Lo puede borrar quien lo escribió, o quien gestiona el curso
  // (profesor dueño/admin) — moderación básica.
  const esAutor = comment.user_id === req.user.id;
  if (!esAutor) {
    await checkGestionAcceso(unit.course_id, req.user);
  }

  await chapterCommentModel.remove(comment.id);
  res.json({ ok: true });
});

module.exports = {
  createUnit,
  updateUnit,
  deleteUnit,
  createChapter,
  updateChapter,
  deleteChapter,
  uploadChapterFile,
  deleteChapterFile,
  updateCourseSettings,
  getCurriculum,
  getUnitDetail,
  getChapterDetail,
  updateProgress,
  completeChapter,
  listComments,
  createComment,
  setCommentVisibility,
  deleteComment,
};
