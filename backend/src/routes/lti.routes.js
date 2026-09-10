const express = require('express');
const router = express.Router();
const ltiController = require('../controllers/lti.controller');

// Todo esto es SIN requireAuth a propósito: quien nos llama acá todavía
// no tiene sesión en esta app — literalmente estamos armándosela (login y
// launch los llama el navegador siguiendo un redirect/submit del LMS,
// jwks lo llama la plataforma sola desde su backend, exchange lo llama el
// frontend con el código de un solo uso que sí probamos que es válido
// adentro del controller).
router.get('/login', ltiController.login);
router.post('/login', ltiController.login);
router.post('/launch', ltiController.launch);
router.post('/exchange', ltiController.exchange);
router.get('/jwks', ltiController.jwks);

module.exports = router;
