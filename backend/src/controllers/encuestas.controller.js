// =============================================================================
// encuestas.controller.js — Encuesta de satisfacción (portado de la
// encuesta de clientes de DBA24, adaptada a alumnos y cursos): el alumno
// califica cada curso en el que está inscripto una sola vez; el admin arma
// las preguntas y ve los resultados (y el reporte en PDF).
// =============================================================================
const db = require('../config/db');
const reportes = require('../services/reportes.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const TIPOS = ['escala', 'si_no', 'texto'];

async function preguntasActivas() {
  return db('encuesta_preguntas').where({ activa: true }).orderBy('orden').orderBy('id').select('id', 'texto', 'tipo');
}

// Alumno: sus cursos, cuáles ya calificó y las preguntas activas.
const pendientes = asyncHandler(async (req, res) => {
  const cursos = await db('enrollments as e').join('courses as c', 'c.id', 'e.course_id')
    .where('e.user_id', req.user.id).select('c.id', 'c.titulo');
  const respondidos = new Set((await db('encuesta_respuestas').where({ user_id: req.user.id }).distinct('course_id')).map((r) => r.course_id));
  res.json({
    preguntas: await preguntasActivas(),
    cursos: cursos.map((c) => ({ ...c, respondida: respondidos.has(c.id) })),
  });
});

const responder = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  const inscripto = await db('enrollments').where({ user_id: req.user.id, course_id: courseId }).first();
  if (!inscripto) throw new AppError('Solo podés calificar cursos en los que estás inscripto/a', 403);
  if (await db('encuesta_respuestas').where({ user_id: req.user.id, course_id: courseId }).first()) {
    throw new AppError('Ya respondiste la encuesta de este curso. ¡Gracias!', 409);
  }
  const preguntas = await preguntasActivas();
  const recibidas = Array.isArray(req.body.respuestas) ? req.body.respuestas : [];
  const filas = [];
  for (const p of preguntas) {
    const r = recibidas.find((x) => Number(x.preguntaId) === p.id) || {};
    if (p.tipo === 'escala') {
      const v = Number(r.valor);
      if (!Number.isInteger(v) || v < 1 || v > 5) throw new AppError(`Respondé "${p.texto}" con un valor del 1 al 5`, 400);
      filas.push({ pregunta_id: p.id, valor: v });
    } else if (p.tipo === 'si_no') {
      if (![0, 1, true, false].includes(r.valor)) throw new AppError(`Respondé sí o no en "${p.texto}"`, 400);
      filas.push({ pregunta_id: p.id, valor: r.valor ? 1 : 0 });
    } else {
      const t = String(r.texto || '').trim().slice(0, 2000);
      if (t) filas.push({ pregunta_id: p.id, texto: t });
    }
  }
  if (!filas.length) throw new AppError('La encuesta está vacía', 400);
  await db('encuesta_respuestas').insert(filas.map((f) => ({ ...f, user_id: req.user.id, course_id: courseId })));
  res.status(201).json({ ok: true });
});

// --- Admin ---

const listPreguntas = asyncHandler(async (req, res) => {
  res.json({ preguntas: (await db('encuesta_preguntas').orderBy('orden').orderBy('id')).map((p) => ({ ...p, activa: Boolean(p.activa) })) });
});

function validarPregunta(b) {
  const texto = String(b.texto || '').trim();
  if (!texto) throw new AppError('Escribí la pregunta', 400);
  if (!TIPOS.includes(b.tipo)) throw new AppError('Tipo inválido (escala, si_no o texto)', 400);
  return { texto: texto.slice(0, 300), tipo: b.tipo, orden: Number.isInteger(Number(b.orden)) ? Number(b.orden) : 0, activa: b.activa !== false };
}

const crearPregunta = asyncHandler(async (req, res) => {
  await db('encuesta_preguntas').insert(validarPregunta(req.body || {}));
  res.status(201).json({ ok: true });
});

const editarPregunta = asyncHandler(async (req, res) => {
  const p = await db('encuesta_preguntas').where({ id: req.params.id }).first();
  if (!p) throw new AppError('Pregunta no encontrada', 404);
  const nuevo = validarPregunta({ ...p, activa: Boolean(p.activa), ...req.body });
  // Cambiar el tipo de una pregunta ya respondida mezclaría respuestas incompatibles.
  if (nuevo.tipo !== p.tipo && await db('encuesta_respuestas').where({ pregunta_id: p.id }).first()) {
    throw new AppError('Esa pregunta ya tiene respuestas: no se le puede cambiar el tipo (desactivala y creá otra)', 409);
  }
  await db('encuesta_preguntas').where({ id: p.id }).update({ ...nuevo, updated_at: db.fn.now() });
  res.json({ ok: true });
});

const borrarPregunta = asyncHandler(async (req, res) => {
  if (await db('encuesta_respuestas').where({ pregunta_id: req.params.id }).first()) {
    throw new AppError('Esa pregunta ya tiene respuestas: desactivala en vez de borrarla', 409);
  }
  await db('encuesta_preguntas').where({ id: req.params.id }).del();
  res.json({ ok: true });
});

const resultados = asyncHandler(async (req, res) => {
  res.json(await reportes.generar('encuestas', { courseId: req.query.courseId ? Number(req.query.courseId) : undefined }));
});

module.exports = { pendientes, responder, listPreguntas, crearPregunta, editarPregunta, borrarPregunta, resultados };
