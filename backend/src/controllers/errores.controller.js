// =============================================================================
// errores.controller.js — Admin → Errores: errores de la app agrupados
// (servidor + navegador), errores de mails, y el endpoint por el que el
// navegador reporta sus propios errores de JS.
// =============================================================================
const db = require('../config/db');
const errorAppModel = require('../models/errorApp.model');
const erroresApp = require('../services/erroresApp.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const texto = (v, n) => (v == null ? '' : String(v)).slice(0, n);

// POST /api/app/errores — errores de JS de las pantallas (cualquier usuario
// logueado; con tope por usuario para que un error en bucle no llene nada).
const registrarNavegador = asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.mensaje) throw new AppError('Falta el mensaje', 400);
  erroresApp.registrar({
    origen: 'navegador',
    mensaje: texto(b.mensaje, 2000),
    stack: texto(b.stack, 8000) || null,
    url: texto(b.pagina, 500),
    metodo: 'GET',
    usuario: { id: req.user.id, nombre: req.user.nombre || req.user.email, rol: req.user.rol },
    navegador: req.headers['user-agent'],
    detalle: {
      archivo: texto(b.archivo, 300) || undefined,
      linea: Number(b.linea) || undefined,
      columna: Number(b.columna) || undefined,
    },
  });
  res.json({ ok: true });
});

const listApp = asyncHandler(async (req, res) => {
  // Lo pendiente en memoria se escribe antes de listar: así el admin ve
  // también lo que pasó en los últimos segundos.
  await erroresApp.escribirAhora();
  const { origen, q, desde, hasta, page } = req.query;
  const data = await errorAppModel.listPage({ origen, q, desde, hasta, page });
  res.json({ errores: data.rows, total: data.total, page: data.page, totalPages: data.totalPages });
});

const detalleApp = asyncHandler(async (req, res) => {
  const error = await errorAppModel.findById(req.params.id);
  if (!error) throw new AppError('Error no encontrado', 404);
  res.json({ error });
});

const borrarApp = asyncHandler(async (req, res) => {
  await errorAppModel.remove(req.params.id);
  res.json({ ok: true });
});

const limpiarApp = asyncHandler(async (req, res) => {
  await errorAppModel.clearAll();
  res.json({ ok: true });
});

// Errores de mails: los envíos fallidos de mail_log (mismo lugar donde los
// muestra DBA24, junto a los de la app).
const listMails = asyncHandler(async (req, res) => {
  const errores = await db('mail_log')
    .where({ estado: 'fallido' })
    .select('id', 'destinatario', 'asunto', 'tipo', 'error_detalle', 'intentos', 'created_at')
    .orderBy('id', 'desc')
    .limit(300);
  res.json({ errores });
});

module.exports = { registrarNavegador, listApp, detalleApp, borrarApp, limpiarApp, listMails };
