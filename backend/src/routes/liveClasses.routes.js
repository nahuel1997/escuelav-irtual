const express = require('express');
const router = express.Router();
const liveClassesController = require('../controllers/liveClasses.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Todo /api/clases-en-vivo/* es de alumno y profesor (agendar/editar/
// cancelar es cosa del admin, ver admin.routes.js). Quién puede ver qué
// (según esté inscripto/asignado, y según el estado de la clase) se valida
// adentro de cada controller.
router.use(requireAuth, requireRole('alumno', 'profesor'));

router.get('/mias', liveClassesController.listMias);
router.get('/:id/sala', liveClassesController.getSala);
router.get('/:id/mensajes', liveClassesController.listMensajes);

// Solo el/los profesor/es asignado/s pueden iniciar/finalizar — se valida
// adentro del controller, no alcanza con requireRole('profesor') porque
// además tiene que ser ESE profesor.
router.put('/:id/iniciar', requireRole('profesor'), liveClassesController.iniciar);
router.put('/:id/finalizar', requireRole('profesor'), liveClassesController.finalizar);

module.exports = router;
