const express = require('express');
const router = express.Router();
const agentFlowController = require('../controllers/agentFlow.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Sandbox de orquestación de agentes: disponible para alumnos y
// profesores (mismo criterio que /cv o /calendario) — no es una
// herramienta de administración, así que admin/soporte quedan afuera.
router.use(requireAuth, requireRole('alumno', 'profesor'));

router.get('/proveedores', agentFlowController.listarProveedores);
router.get('/flujos', agentFlowController.listar);
router.post('/flujos', agentFlowController.crear);
router.put('/flujos/:id', agentFlowController.actualizar);
router.delete('/flujos/:id', agentFlowController.borrar);
router.post('/ejecutar', agentFlowController.ejecutar);

module.exports = router;
