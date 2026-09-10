const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminLtiController = require('../controllers/adminLti.controller');
const testingController = require('../controllers/testing.controller');
const mailsController = require('../controllers/mails.controller');
const apiClientsController = require('../controllers/apiClients.controller');
const paymentsController = require('../controllers/payments.controller');
const liveClassesController = require('../controllers/liveClasses.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { uploadImagen } = require('../middlewares/upload.middleware');

// Todo /api/admin/* requiere estar logueado Y tener rol admin.
router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', adminController.getDashboard);

router.get('/users', adminController.listUsersByRole);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);

router.get('/courses', adminController.listCourses);
router.post('/courses', adminController.createCourse);
router.put('/courses/:id', adminController.updateCourse);

router.get('/content', adminController.listContent);
router.put('/content/:clave', adminController.updateContent);

router.post('/upload-imagen', uploadImagen, adminController.uploadImage);

router.get('/calendario', adminController.listCalendarEvents);

router.get('/nav-links', adminController.listNavLinks);
router.post('/nav-links', adminController.createNavLink);
router.put('/nav-links/:id', adminController.updateNavLink);
router.delete('/nav-links/:id', adminController.deleteNavLink);

router.get('/botones', adminController.listButtonOptions);
router.post('/botones', adminController.createButtonOption);
router.put('/botones/:id', adminController.updateButtonOption);
router.delete('/botones/:id', adminController.deleteButtonOption);

router.get('/errores', adminController.listErrorLogs);
router.delete('/errores', adminController.clearErrorLogs);

router.get('/logins', adminController.listLoginLogs);
router.post('/logins/:id/cerrar', adminController.revocarSesion);

// Registro de chats de soporte (solo lectura — ver support.routes.js para
// el panel donde de verdad se responde).
router.get('/chats', adminController.listChats);
router.get('/chats/:id/mensajes', adminController.listChatMessages);

// Entorno de mails (/admin-panel/mails): plantillas, configuración,
// listas de mailing y registro de envíos — ver mails.controller.js.
router.get('/mails/plantillas', mailsController.listTemplates);
router.put('/mails/plantillas/:clave', mailsController.updateTemplate);
router.post('/mails/plantillas/:clave/probar', mailsController.testSend);

router.get('/mails/configuracion', mailsController.listSettings);
router.put('/mails/configuracion/:clave', mailsController.updateSetting);

router.get('/mails/registro', mailsController.listLog);

router.get('/mails/listas', mailsController.listLists);
router.post('/mails/listas', mailsController.createList);
router.put('/mails/listas/:id', mailsController.updateList);
router.delete('/mails/listas/:id', mailsController.deleteList);
router.get('/mails/listas/:id/miembros', mailsController.listMembers);
router.post('/mails/listas/:id/miembros', mailsController.addMember);
router.post('/mails/listas/:id/miembros/todos', mailsController.addTodos);
router.delete('/mails/listas/:id/miembros/todos', mailsController.removeTodos);
router.delete('/mails/listas/:id/miembros/:userId', mailsController.removeMember);
router.post('/mails/listas/:id/enviar', mailsController.sendToList);

// Entorno de testing (corre la suite de Jest a pedido — ver
// testing.controller.js para el detalle de por qué es seguro).
router.get('/testing/suites', testingController.listSuites);
router.post('/testing/run/:id', testingController.runSuite);

// "Test Pagos" (ver testing.controller.js): probar Mercado Pago/PayPal de
// punta a punta con un precio libre, sin inscribir a nadie en ningún curso.
router.get('/testing/pagos/metodos', testingController.metodosPagoDisponibles);
router.get('/testing/pagos/ordenes', testingController.listPagosDePrueba);
router.post('/testing/pagos/orden', testingController.iniciarPagoDePrueba);

// Accesos a la API de datos para sistemas externos (usuario/contraseña +
// permisos por tabla/columna — ver dataApi.controller.js, que es el
// endpoint que consumen esos accesos, autenticado aparte con Basic Auth).
router.get('/api-clients', apiClientsController.listClients);
router.get('/api-clients/catalogo', apiClientsController.getCatalogo);
router.post('/api-clients', apiClientsController.createClient);
router.post('/api-clients/:id/regenerar', apiClientsController.regenerarPassword);
router.put('/api-clients/:id/activo', apiClientsController.setActivo);
router.delete('/api-clients/:id', apiClientsController.deleteClient);
router.put('/api-clients/:id/permisos/:tabla', apiClientsController.setPermiso);
router.delete('/api-clients/:id/permisos/:tabla', apiClientsController.quitarPermiso);
router.get('/api-clients/:id/uso', apiClientsController.listUso);

// Órdenes de pago real (Mercado Pago/PayPal) — solo lectura, más la tasa
// de cambio manual que usa PayPal para convertir ARS a USD (ver
// payments.controller.js y payments.service.js::convertirATotalUsd).
router.get('/pagos', paymentsController.listOrdenes);
router.get('/pagos/tasa-cambio', paymentsController.getTasaCambio);
router.put('/pagos/tasa-cambio', paymentsController.setTasaCambio);

// Clases en vivo: agendar/editar/cancelar es solo del admin (ver
// clarificación del usuario) — iniciar/finalizar la transmisión es del
// profesor asignado, ver liveClasses.routes.js.
router.get('/clases-en-vivo', liveClassesController.listar);
router.get('/clases-en-vivo/:id', liveClassesController.obtener);
router.post('/clases-en-vivo', liveClassesController.crear);
router.put('/clases-en-vivo/:id', liveClassesController.editar);
router.put('/clases-en-vivo/:id/cancelar', liveClassesController.cancelar);

// Integraciones LMS reales vía LTI 1.3 — ver lti.controller.js (endpoints
// públicos que consume el LMS) y adminLti.controller.js (alta/baja de
// plataformas, acá).
router.get('/lti/info', adminLtiController.infoTool);
router.get('/lti/plataformas', adminLtiController.listar);
router.post('/lti/plataformas', adminLtiController.crear);
router.put('/lti/plataformas/:id', adminLtiController.actualizar);
router.put('/lti/plataformas/:id/activo', adminLtiController.toggleActivo);
router.delete('/lti/plataformas/:id', adminLtiController.borrar);

module.exports = router;
