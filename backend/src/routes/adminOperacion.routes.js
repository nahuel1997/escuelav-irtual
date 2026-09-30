// Rutas de operación del panel de admin (se montan dentro de
// admin.routes.js, así que ya pasaron por requireAuth + rol admin):
// configuración, estado de la app, tráfico, versiones, procesos, tareas
// programadas, backups y actualizaciones.
const express = require('express');
const router = express.Router();
const configuracion = require('../controllers/configuracion.controller');
const operacion = require('../controllers/operacion.controller');
const procesos = require('../controllers/procesos.controller');
const sistema = require('../controllers/sistema.controller');
const panel = require('../controllers/panel.controller');
const encuestas = require('../controllers/encuestas.controller');
const calificaciones = require('../controllers/calificaciones.controller');
const reportes = require('../services/reportes.service');
const { uploadAdjuntosCalificacion } = require('../middlewares/upload.middleware');
const jobs = require('../jobs');
const { requerirListaBlanca } = require('../middlewares/listaBlanca.middleware');
const { limiterPorUsuario, pdfLimiter } = require('../middlewares/rateLimit.middleware');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Configuración general (mantenimiento, páginas de error, modo oscuro,
// feriados, logo de mails).
router.get('/configuracion', configuracion.listar);
router.put('/configuracion/:seccion', configuracion.guardar);

// Estado de la app. El test de velocidad genera PDFs y hashes reales: tope
// para que no se pueda lanzar en bucle.
const testVelocidadLimiter = limiterPorUsuario({ max: 3, mensaje: 'Limitado a 3 tests de velocidad por minuto.' });
router.get('/estado-app', operacion.getEstado);
router.post('/estado-app/test-velocidad', testVelocidadLimiter, operacion.postTestVelocidad);
router.get('/estado-app/pdf', pdfLimiter, operacion.getEstadoPdf);

// Tráfico.
router.get('/trafico', operacion.getTrafico);
router.get('/trafico/pdf', pdfLimiter, operacion.getTraficoPdf);

// Versiones (registro de cambios).
router.get('/versiones', operacion.listVersiones);
router.post('/versiones', operacion.crearVersion);
router.put('/versiones/:id', operacion.editarVersion);
router.delete('/versiones/:id', operacion.borrarVersion);
router.get('/versiones/pdf', pdfLimiter, operacion.getVersionesPdf);

// Procesos en segundo plano (todos los usuarios).
router.get('/procesos', procesos.listarTodos);
router.post('/procesos/:id/reintentar', procesos.reintentar);

// Tareas programadas.
router.get('/jobs', asyncHandler(async (req, res) => res.json(await jobs.listar())));
router.put('/jobs/:clave', asyncHandler(async (req, res) => {
  const job = await jobs.actualizar(req.params.clave, req.body || {});
  if (!job) throw new AppError('Tarea desconocida', 404);
  res.json(await jobs.listar());
}));
const ejecutarLimiter = limiterPorUsuario({ max: 5, mensaje: 'Esperá un momento antes de volver a ejecutar tareas.' });
router.post('/jobs/:clave/ejecutar', ejecutarLimiter, asyncHandler(async (req, res) => {
  if (!jobs.JOBS[req.params.clave]) throw new AppError('Tarea desconocida', 404);
  res.json(await jobs.ejecutar(req.params.clave));
}));

// Backups y Actualizaciones: cada una con su lista blanca (no alcanza con
// esconder el menú — se chequea acá, adivines o no la URL).
const soloBackups = requerirListaBlanca('backups');
const soloActualizaciones = requerirListaBlanca('actualizaciones');
const descargaLimiter = limiterPorUsuario({ max: 3, mensaje: 'Esperá un momento antes de pedir otro backup.' });

router.get('/backups', soloBackups, sistema.getBackups);
router.get('/backups/db', soloBackups, descargaLimiter, sistema.getBackupDb);
router.get('/backups/proyecto', soloBackups, descargaLimiter, sistema.getBackupProyecto);

router.get('/actualizaciones', soloActualizaciones, sistema.getActualizaciones);
router.post('/actualizaciones/diagnostico/:tipo', soloActualizaciones, sistema.postDiagnostico);
router.post('/actualizaciones/ver-pendientes', soloActualizaciones, sistema.postVerPendientes);
router.post('/actualizaciones/actualizar', soloActualizaciones, sistema.postActualizar);

// Menú del panel, habilitación de pantallas, Tester y manual por rol.
router.get('/menu', panel.getMenu);
router.put('/menu', panel.guardarMenu);
router.delete('/menu', panel.resetMenu);
router.get('/pantallas', panel.getPantallas);
router.put('/pantallas', panel.guardarPantallas);
router.post('/pantallas/bloqueos', panel.bloquearPantalla);
router.delete('/pantallas/bloqueos/:id', panel.desbloquearPantalla);
router.get('/tester', panel.listTester);
router.post('/tester/sesiones', limiterPorUsuario({ max: 10, mensaje: 'Esperá un momento antes de abrir otra sesión de prueba.' }), panel.crearSesionTester);
router.post('/tester/sesiones/:id/cerrar', panel.cerrarSesionTester);
router.post('/tester/observaciones', panel.agregarObservacion);
router.delete('/tester/observaciones/:id', panel.borrarObservacion);
router.get('/tester/observaciones/pdf', pdfLimiter, panel.observacionesPdf);
router.get('/manual', panel.listManual);
router.post('/manual', panel.crearSeccionManual);
router.put('/manual/:id', panel.editarSeccionManual);
router.delete('/manual/:id', panel.borrarSeccionManual);

// Reportes (el PDF y el envío por mail van por procesos: tipo reporte_admin).
router.get('/reportes/:tipo', asyncHandler(async (req, res) => {
  const { courseId, desde, hasta } = req.query;
  res.json(await reportes.generar(req.params.tipo, { courseId: courseId ? Number(courseId) : undefined, desde, hasta }));
}));

// Encuestas de satisfacción: preguntas y resultados.
router.get('/encuestas/preguntas', encuestas.listPreguntas);
router.post('/encuestas/preguntas', encuestas.crearPregunta);
router.put('/encuestas/preguntas/:id', encuestas.editarPregunta);
router.delete('/encuestas/preguntas/:id', encuestas.borrarPregunta);
router.get('/encuestas/resultados', encuestas.resultados);

// Calificaciones internas de profesores (con adjuntos privados).
router.get('/calificaciones', calificaciones.resumen);
router.get('/calificaciones/:id', calificaciones.detalle);
router.post('/calificaciones/:id', calificaciones.calificar);
router.delete('/calificaciones/:id/:calificacionId', calificaciones.borrarCalificacion);
router.post('/calificaciones/:id/adjuntos', uploadAdjuntosCalificacion, calificaciones.subirAdjuntos);
router.get('/calificaciones/:id/adjuntos/:adjuntoId', calificaciones.bajarAdjunto);
router.delete('/calificaciones/:id/adjuntos/:adjuntoId', calificaciones.borrarAdjunto);

// Marketing: campañas de mail programadas y ofertas en la app.
const marketing = require('../controllers/marketing.controller');
router.get('/campanias', marketing.listCampanias);
router.post('/campanias', marketing.crearCampania);
router.post('/campanias/segmento/contar', marketing.contarSegmento);
router.get('/campanias/:id', marketing.verCampania);
router.put('/campanias/:id', marketing.editarCampania);
router.delete('/campanias/:id', marketing.borrarCampania);
router.post('/campanias/:id/duplicar', marketing.duplicarCampania);
router.post('/campanias/:id/programar', marketing.programarCampania);
router.post('/campanias/:id/cancelar', marketing.cancelarCampania);
router.post('/campanias/:id/enviar', limiterPorUsuario({ max: 5, mensaje: 'Esperá un momento antes de lanzar otra campaña.' }), marketing.enviarAhora);
router.post('/campanias/:id/prueba', limiterPorUsuario({ max: 10, mensaje: 'Esperá un momento antes de mandar otra prueba.' }), marketing.pruebaCampania);
router.get('/campanias/:id/estadisticas', marketing.estadisticasCampania);
router.get('/campanias/:id/vista-previa', marketing.vistaPrevia);
router.get('/ofertas', marketing.listOfertas);
router.post('/ofertas', marketing.crearOferta);
router.put('/ofertas/:id', marketing.editarOferta);
router.delete('/ofertas/:id', marketing.borrarOferta);

// Asistente IA (solo lectura sobre los datos de la escuela).
const asistente = require('../services/asistente');
const asistenteLimiter = limiterPorUsuario({ max: 15, mensaje: 'Hiciste muchas preguntas seguidas al asistente, esperá un momento.' });
router.get('/asistente', asyncHandler(async (req, res) => res.json({ conversaciones: await asistente.listar(req.user.id), modelo: asistente.MODELO })));
router.get('/asistente/:id', asyncHandler(async (req, res) => res.json({ conversacion: await asistente.ver(req.user.id, req.params.id) })));
router.post('/asistente', asistenteLimiter, asyncHandler(async (req, res) => {
  const { conversacionId, mensaje } = req.body || {};
  res.json(await asistente.preguntar({ adminId: req.user.id, conversacionId: conversacionId ? Number(conversacionId) : null, mensaje }));
}));
router.delete('/asistente/:id', asyncHandler(async (req, res) => {
  await asistente.borrar(req.user.id, req.params.id);
  res.json({ ok: true });
}));

// Alta/baja en cada lista blanca (solo quien ya tiene acceso a esa sección).
router.post('/listas/:seccion/admins', (req, res, next) => requerirListaBlanca(req.params.seccion === 'actualizaciones' ? 'actualizaciones' : 'backups')(req, res, next), sistema.agregarAdmin);
router.delete('/listas/:seccion/admins/:id', (req, res, next) => requerirListaBlanca(req.params.seccion === 'actualizaciones' ? 'actualizaciones' : 'backups')(req, res, next), sistema.quitarAdmin);

module.exports = router;
