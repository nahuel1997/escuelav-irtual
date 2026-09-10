const express = require('express');
const router = express.Router();
const curriculumController = require('../controllers/curriculum.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { uploadArchivoUtil } = require('../middlewares/upload.middleware');

// Igual que classroom.routes.js: todo requiere estar logueado, el control
// fino de "te corresponde ver/editar ESTE curso" vive en el controller.
router.use(requireAuth);

// Configuración de avance del curso (profesor dueño / admin).
router.put('/courses/:courseId/settings', curriculumController.updateCourseSettings);

// Curriculum completo (alumno inscripto / profesor dueño / admin).
router.get('/courses/:courseId/curriculum', curriculumController.getCurriculum);

// Unidades.
router.post('/courses/:courseId/units', curriculumController.createUnit);
router.get('/units/:unitId', curriculumController.getUnitDetail);
router.put('/units/:unitId', curriculumController.updateUnit);
router.delete('/units/:unitId', curriculumController.deleteUnit);

// Capítulos.
router.post('/units/:unitId/chapters', curriculumController.createChapter);
router.get('/chapters/:chapterId', curriculumController.getChapterDetail);
router.put('/chapters/:chapterId', curriculumController.updateChapter);
router.delete('/chapters/:chapterId', curriculumController.deleteChapter);

// Progreso de video / marcar como visto.
router.post('/chapters/:chapterId/progress', curriculumController.updateProgress);
router.post('/chapters/:chapterId/complete', curriculumController.completeChapter);

// Archivos de utilidad.
router.post('/chapters/:chapterId/files', uploadArchivoUtil, curriculumController.uploadChapterFile);
router.delete('/chapter-files/:fileId', curriculumController.deleteChapterFile);

// Comentarios.
router.get('/chapters/:chapterId/comments', curriculumController.listComments);
router.post('/chapters/:chapterId/comments', curriculumController.createComment);
router.put('/comments/:commentId/visibility', curriculumController.setCommentVisibility);
router.delete('/comments/:commentId', curriculumController.deleteComment);

module.exports = router;
