// Endpoints "de la app" para cualquier usuario logueado que no son de un
// dominio puntual: errores de JS del navegador y "Reportar error".
const express = require('express');
const router = express.Router();
const errores = require('../controllers/errores.controller');
const reportes = require('../controllers/reportesError.controller');
const operacion = require('../controllers/operacion.controller');
const panel = require('../controllers/panel.controller');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middlewares/auth.middleware');
const { limiterPorUsuario, reporteErrorLimiter } = require('../middlewares/rateLimit.middleware');
const { uploadCapturasReporte } = require('../middlewares/upload.middleware');

// Un error de JS en bucle no puede llenar nada: 20 por minuto por usuario.
const erroresNavegadorLimiter = limiterPorUsuario({ max: 20 });

router.post('/errores', requireAuth, erroresNavegadorLimiter, errores.registrarNavegador);

// Páginas vistas para Tráfico (también visitantes sin sesión): tope por IP.
const vistasLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test', message: { error: 'Demasiadas solicitudes' } });
router.post('/vista', vistasLimiter, operacion.postVista);

// "Novedades": el registro de versiones, para cualquier usuario logueado.
router.get('/novedades', requireAuth, operacion.novedades);

// Manual de uso del rol del usuario y sus pantallas bloqueadas.
router.get('/manual', requireAuth, panel.miManual);
router.get('/mis-bloqueos', requireAuth, panel.misBloqueos);

router.post('/reportes-error', requireAuth, reporteErrorLimiter, uploadCapturasReporte, reportes.crear);
router.get('/reportes-error', requireAuth, reportes.mios);
router.get('/reportes-error/adjuntos/:adjuntoId', requireAuth, reportes.adjunto);
router.get('/reportes-error/:id', requireAuth, reportes.detalle);

module.exports = router;
