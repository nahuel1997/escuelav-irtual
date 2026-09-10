const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const aiGptsController = require('../controllers/aiGpts.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// "Integraciones IA": pedido explícitamente para la parte de alumnos (a
// diferencia de /cv o /agentes, que son para cualquier usuario logueado)
// — cada alumno vincula su PROPIA API key de ChatGPT/Claude/Gemini y
// chatea con esa IA real usando su propia cuenta, nunca la nuestra (ver
// services/aiChat/ y utils/crypto.js).
router.use(requireAuth, requireRole('alumno'));

router.get('/proveedores', aiController.listarProveedores);
router.post('/vinculaciones/:proveedor', aiController.vincular);
router.delete('/vinculaciones/:proveedor', aiController.desvincular);

router.get('/conversaciones', aiController.listarConversaciones);
router.post('/conversaciones', aiController.crearConversacion);
router.delete('/conversaciones/:id', aiController.borrarConversacion);
router.get('/conversaciones/:id/mensajes', aiController.listarMensajes);
router.post('/conversaciones/:id/mensajes', aiController.mandarMensaje);

// "GPTs" propios del alumno — ver aiGpts.controller.js y la migración
// create_ai_gpts para el porqué de esto (equivalente propio, no una
// integración real con GPTs/Proyectos/Gems de cada proveedor).
router.get('/gpts', aiGptsController.listar);
router.post('/gpts', aiGptsController.crear);
router.put('/gpts/:id', aiGptsController.actualizar);
router.delete('/gpts/:id', aiGptsController.borrar);

module.exports = router;
