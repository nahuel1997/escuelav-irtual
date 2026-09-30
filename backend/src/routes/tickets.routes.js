// Tickets de soporte — ver tickets.controller.js.
//   /api/tickets/*          usuario logueado (sus propios tickets) + equipo
//   /api/tickets/gestion/*  solo admin y agentes de soporte
//   /api/aprobacion/:token  pública (ver app.js), el token es la credencial
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tickets.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { escrituraLimiter } = require('../middlewares/rateLimit.middleware');
const { uploadAdjuntosTicket } = require('../middlewares/upload.middleware');

router.use(requireAuth);

// Gestión (antes que /:id para que "gestion" no se tome como un id).
const gestion = requireRole(...ctrl.ROLES_GESTION);
router.get('/gestion', gestion, ctrl.listarGestion);
router.get('/gestion/tablero', gestion, ctrl.tablero);
router.get('/gestion/agentes', gestion, ctrl.agentes);
router.get('/gestion/etiquetas', gestion, ctrl.listEtiquetas);
router.post('/gestion/etiquetas', gestion, ctrl.crearEtiqueta);
router.put('/gestion/etiquetas/:id', gestion, ctrl.editarEtiqueta);
router.delete('/gestion/etiquetas/:id', gestion, ctrl.borrarEtiqueta);
router.put('/gestion/:id', gestion, ctrl.actualizar);
router.post('/gestion/:id/aprobaciones', gestion, escrituraLimiter, ctrl.pedirAprobacion);

// Usuario (y el equipo, que ve todos).
router.get('/', ctrl.mios);
router.post('/', escrituraLimiter, uploadAdjuntosTicket, ctrl.crear);
router.get('/adjuntos/:adjuntoId', ctrl.adjunto);
router.get('/:id', ctrl.detalle);
router.post('/:id/mensajes', escrituraLimiter, uploadAdjuntosTicket, ctrl.responder);
router.post('/:id/cerrar', escrituraLimiter, ctrl.cerrarPropio);

module.exports = router;
