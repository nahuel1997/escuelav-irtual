// =============================================================================
// reportesError.controller.js — "Reportar error" (alumno/profesor) y la
// bandeja "Errores alertados" del admin (portado de reportesError de DBA24).
//
// Las capturas se guardan en backend/privado/reportes-error (no públicas) y
// solo las puede bajar el autor del reporte o un admin.
// =============================================================================
const fs = require('fs');
const env = require('../config/env');
const reporteModel = require('../models/reporteError.model');
const storageService = require('../services/storage.service');
const mailService = require('../services/mail.service');
const { escaparHtml } = require('../utils/template');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

function borrarSubidos(files) {
  (files || []).forEach((f) => fs.unlink(f.path, () => {}));
}

const crear = asyncHandler(async (req, res) => {
  const titulo = String(req.body.titulo || '').trim();
  const descripcion = String(req.body.descripcion || '').trim();
  if (!titulo || !descripcion) {
    borrarSubidos(req.files);
    throw new AppError('Contanos un título y qué pasó', 400);
  }
  if (titulo.length > 200 || descripcion.length > 5000) {
    borrarSubidos(req.files);
    throw new AppError('El texto es demasiado largo', 400);
  }

  const adjuntos = (req.files || []).map((f) => ({
    archivo: f.filename,
    nombre_original: String(f.originalname || '').slice(0, 200),
    mime: f.mimetype,
    tamano: f.size,
  }));
  const id = await reporteModel.crear({
    userId: req.user.id,
    rol: req.user.rol,
    titulo,
    descripcion,
    pagina: String(req.body.pagina || '').slice(0, 500) || null,
    navegador: String(req.headers['user-agent'] || '').slice(0, 300),
    adjuntos,
  });

  // Aviso opcional por mail (ALERTA_ERRORES_MAIL), best-effort.
  if (env.ALERTA_ERRORES_MAIL) {
    mailService.enviarMail({
      clave: 'reporte_error_admin',
      destinatario: env.ALERTA_ERRORES_MAIL,
      variables: {
        nombre: escaparHtml(req.user.nombre || req.user.email),
        rol: req.user.rol,
        titulo: escaparHtml(titulo),
        descripcion: escaparHtml(descripcion),
        numero: id,
      },
    }).catch(() => {});
  }

  res.status(201).json({ id });
});

const mios = asyncHandler(async (req, res) => {
  res.json({ reportes: await reporteModel.listByUser(req.user.id) });
});

async function reporteVisible(req, id) {
  const reporte = await reporteModel.findConAdjuntos(id);
  if (!reporte) throw new AppError('Reporte no encontrado', 404);
  if (req.user.rol !== 'admin' && reporte.user_id !== req.user.id) throw new AppError('Reporte no encontrado', 404);
  return reporte;
}

const detalle = asyncHandler(async (req, res) => {
  res.json({ reporte: await reporteVisible(req, req.params.id) });
});

// Descarga de una captura: el autor o un admin. El nombre en disco sale
// de la base, nunca del request.
const adjunto = asyncHandler(async (req, res) => {
  const a = await reporteModel.findAdjunto(req.params.adjuntoId);
  if (!a || (req.user.rol !== 'admin' && a.user_id !== req.user.id)) throw new AppError('Archivo no encontrado', 404);
  const ruta = storageService.rutaPrivada('reportes-error', a.archivo);
  if (!fs.existsSync(ruta)) throw new AppError('El archivo ya no está en el servidor', 404);
  res.type(a.mime || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(a.nombre_original || a.archivo)}"`);
  res.set('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(ruta).pipe(res);
});

// --- Admin ---

const listAdmin = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  if (estado && !reporteModel.ESTADOS.includes(estado)) throw new AppError('Estado inválido', 400);
  res.json({ reportes: await reporteModel.listAll({ estado }) });
});

const resumen = asyncHandler(async (req, res) => {
  res.json({ nuevos: await reporteModel.contarNuevos() });
});

const setEstado = asyncHandler(async (req, res) => {
  const { estado, respuesta } = req.body;
  if (!reporteModel.ESTADOS.includes(estado)) throw new AppError(`Estado inválido. Válidos: ${reporteModel.ESTADOS.join(', ')}`, 400);
  const existente = await reporteModel.findConAdjuntos(req.params.id);
  if (!existente) throw new AppError('Reporte no encontrado', 404);
  await reporteModel.setEstado(req.params.id, {
    estado,
    respuesta: respuesta === undefined ? undefined : String(respuesta).slice(0, 5000),
  });
  res.json({ reporte: await reporteModel.findConAdjuntos(req.params.id) });
});

module.exports = { crear, mios, detalle, adjunto, listAdmin, resumen, setEstado };
