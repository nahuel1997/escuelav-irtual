// =============================================================================
// calificaciones.controller.js — Calificaciones internas de profesores
// (portado de las calificaciones de consultores de DBA24): el admin anota
// puntajes por criterio con comentario y sube adjuntos (privados). Nada de
// esto lo ve el profesor. Se cruza con la encuesta de los alumnos.
// =============================================================================
const fs = require('fs');
const db = require('../config/db');
const storage = require('../services/storage.service');
const reportes = require('../services/reportes.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const CRITERIOS = ['Contenido', 'Claridad', 'Puntualidad', 'Trato con alumnos', 'Cumplimiento', 'General'];

async function profesor(id) {
  const p = await db('users').where({ id, rol: 'profesor' }).first();
  if (!p) throw new AppError('Profesor no encontrado', 404);
  return p;
}

const resumen = asyncHandler(async (req, res) => {
  const datos = await reportes.generar('profesores', { desde: '2000-01-01' });
  res.json({ profesores: datos.profesores, criterios: CRITERIOS });
});

const detalle = asyncHandler(async (req, res) => {
  const p = await profesor(req.params.id);
  const [calificaciones, adjuntos] = await Promise.all([
    db('profesor_calificaciones as c').leftJoin('users as a', 'a.id', 'c.admin_id').where('c.profesor_id', p.id)
      .select('c.*', 'a.nombre as admin_nombre').orderBy('c.fecha', 'desc').orderBy('c.id', 'desc'),
    db('profesor_adjuntos').where({ profesor_id: p.id }).select('id', 'nombre_original', 'mime', 'tamano', 'created_at').orderBy('id', 'desc'),
  ]);
  const porCriterio = {};
  calificaciones.forEach((c) => { (porCriterio[c.criterio] = porCriterio[c.criterio] || []).push(c.puntaje); });
  res.json({
    profesor: { id: p.id, nombre: p.nombre, apellido: p.apellido, email: p.email },
    calificaciones,
    adjuntos,
    promedios: Object.fromEntries(Object.entries(porCriterio).map(([k, v]) => [k, Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10])),
    criterios: CRITERIOS,
  });
});

const calificar = asyncHandler(async (req, res) => {
  const p = await profesor(req.params.id);
  const puntaje = Number(req.body.puntaje);
  const criterio = String(req.body.criterio || '');
  const fecha = String(req.body.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (!Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) throw new AppError('El puntaje va del 1 al 5', 400);
  if (!CRITERIOS.includes(criterio)) throw new AppError('Criterio inválido', 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new AppError('Fecha inválida', 400);
  await db('profesor_calificaciones').insert({
    profesor_id: p.id, admin_id: req.user.id, puntaje, criterio, fecha,
    comentario: String(req.body.comentario || '').trim().slice(0, 3000) || null,
  });
  res.status(201).json({ ok: true });
});

const borrarCalificacion = asyncHandler(async (req, res) => {
  await db('profesor_calificaciones').where({ id: req.params.calificacionId, profesor_id: req.params.id }).del();
  res.json({ ok: true });
});

const subirAdjuntos = asyncHandler(async (req, res) => {
  const p = await profesor(req.params.id).catch((e) => { (req.files || []).forEach((f) => fs.unlink(f.path, () => {})); throw e; });
  const files = req.files || [];
  if (!files.length) throw new AppError('Elegí al menos un archivo', 400);
  await db('profesor_adjuntos').insert(files.map((f) => ({
    profesor_id: p.id, archivo: f.filename, nombre_original: String(f.originalname || '').slice(0, 200), mime: f.mimetype, tamano: f.size, subido_por: req.user.id,
  })));
  res.status(201).json({ ok: true });
});

const bajarAdjunto = asyncHandler(async (req, res) => {
  const a = await db('profesor_adjuntos').where({ id: req.params.adjuntoId, profesor_id: req.params.id }).first();
  if (!a) throw new AppError('Archivo no encontrado', 404);
  const ruta = storage.rutaPrivada('calificaciones', a.archivo);
  if (!fs.existsSync(ruta)) throw new AppError('El archivo ya no está en el servidor', 404);
  res.type(a.mime || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(a.nombre_original || a.archivo)}"`);
  res.set('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(ruta).pipe(res);
});

const borrarAdjunto = asyncHandler(async (req, res) => {
  const a = await db('profesor_adjuntos').where({ id: req.params.adjuntoId, profesor_id: req.params.id }).first();
  if (!a) throw new AppError('Archivo no encontrado', 404);
  await db('profesor_adjuntos').where({ id: a.id }).del();
  fs.unlink(storage.rutaPrivada('calificaciones', a.archivo), () => {});
  res.json({ ok: true });
});

module.exports = { resumen, detalle, calificar, borrarCalificacion, subirAdjuntos, bajarAdjunto, borrarAdjunto };
