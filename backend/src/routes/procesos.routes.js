// Procesos en segundo plano (cualquier usuario logueado; cada tipo define
// qué roles lo pueden iniciar). Ver services/procesos/index.js.
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/procesos.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { limiterPorUsuario } = require('../middlewares/rateLimit.middleware');

// Encolar es barato para el pedido pero caro para el servidor: tope por usuario.
const encolarLimiter = limiterPorUsuario({ max: 10, mensaje: 'Iniciaste muchos procesos seguidos, esperá un momento.' });

router.use(requireAuth);
router.post('/', encolarLimiter, ctrl.crear);
router.get('/', ctrl.mios);
router.get('/:id', ctrl.ver);
router.get('/:id/archivo', ctrl.archivo);
router.post('/:id/cancelar', ctrl.cancelar);

module.exports = router;
