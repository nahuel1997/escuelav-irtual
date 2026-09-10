const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// Todo /api/calendar/* requiere estar logueado. Quién puede hacer qué
// (solo alumno solicita, solo el profesor del turno acepta/rechaza) se
// valida adentro de cada controller según el rol y la titularidad del turno.
router.use(requireAuth);

router.get('/mis-turnos', calendarController.listMisTurnos);
router.post('/turnos', calendarController.solicitarTurno);
router.put('/turnos/:id/aceptar', calendarController.aceptarTurno);
router.put('/turnos/:id/rechazar', calendarController.rechazarTurno);
router.put('/turnos/:id/cancelar', calendarController.cancelarTurno);

module.exports = router;
