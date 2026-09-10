const express = require('express');
const router = express.Router();
const cvController = require('../controllers/cv.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// El perfil guardado sí exige estar logueado (no hay otro dueño posible
// para persistirlo).
router.get('/perfil', requireAuth, cvController.getPerfil);

// No exigimos requireAuth acá: el creador de CV funciona logueado o no.
// Si el usuario pide incluirCursosPlataforma sin estar logueado, el
// controller devuelve 401 solo en ese caso puntual. El guardado
// automático del perfil (ver cv.controller.js::generate) también es
// best-effort y solo pasa si hay token válido.
router.post('/generate', cvController.generate);

module.exports = router;
