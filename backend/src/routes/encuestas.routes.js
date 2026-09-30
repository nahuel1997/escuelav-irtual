// Encuesta de satisfacción del alumno (una por curso inscripto).
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/encuestas.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { escrituraLimiter } = require('../middlewares/rateLimit.middleware');

router.use(requireAuth, requireRole('alumno'));
router.get('/', ctrl.pendientes);
router.post('/:courseId', escrituraLimiter, ctrl.responder);

module.exports = router;
