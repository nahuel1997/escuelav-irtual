const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Chat de soporte, lado alumno/profesor. Mandar mensajes es por socket
// (ver realtime/chatSocket.js) — esto es solo para cargar el historial.
router.use(requireAuth, requireRole('alumno', 'profesor'));

router.get('/mi-conversacion', chatController.miConversacion);

module.exports = router;
