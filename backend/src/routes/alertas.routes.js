const express = require('express');
const router = express.Router();
const alertasController = require('../controllers/alertas.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// Cualquier usuario logueado puede tener alertas propias (en la práctica
// solo se le mandan a alumno/profesor, ver seguridad.controller.js::
// crearAlerta, pero no hace falta un requireRole acá: cada uno solo ve
// las suyas, filtradas siempre por req.user.id).
router.get('/pendiente', requireAuth, alertasController.pendiente);
router.get('/mias', requireAuth, alertasController.mias);
router.get('/contador', requireAuth, alertasController.contador);
router.post('/:id/recibido', requireAuth, alertasController.recibido);

module.exports = router;
