const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Panel de soporte (/soporte). Responder mensajes es por socket (ver
// realtime/chatSocket.js) — esto es solo la lista de conversaciones y el
// historial de cada una.
router.use(requireAuth, requireRole('soporte'));

router.get('/conversaciones', supportController.listConversaciones);
router.get('/conversaciones/:id/mensajes', supportController.listMensajes);

module.exports = router;
