// Página de aprobación que recibe el usuario por mail — pública, sin
// login: el token del link es la única credencial (ver
// tickets.controller.js::pedirAprobacion). Rate limit por IP para que no
// se pueda probar tokens a lo loco.
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ctrl = require('../controllers/tickets.controller');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});

router.get('/:token', limiter, ctrl.verAprobacion);
router.post('/:token', limiter, ctrl.responderAprobacion);

module.exports = router;
