const express = require('express');
const router = express.Router();
const cvController = require('../controllers/cv.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// El perfil guardado sí exige estar logueado (no hay otro dueño posible
// para persistirlo).
router.get('/perfil', requireAuth, cvController.getPerfil);
router.put('/perfil', requireAuth, cvController.guardarPerfil);

// No exigimos requireAuth acá: el creador de CV funciona logueado o no.
// Si el usuario pide incluirCursosPlataforma sin estar logueado, el
// controller devuelve 401 solo en ese caso puntual. El guardado
// automático del perfil (ver cv.controller.js::generate) también es
// best-effort y solo pasa si hay token válido.
router.post('/generate', cvController.generate);

// Catálogo de destinos de "CV para IA" (ChatGPT/Claude/Gemini) y su
// generación — mismo criterio de auth opcional que /generate arriba.
router.get('/generadores-ia', cvController.getGeneradoresIA);
router.post('/generar-ia', cvController.generarIA);

module.exports = router;
