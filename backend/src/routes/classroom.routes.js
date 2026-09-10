const express = require('express');
const router = express.Router();
const classroomController = require('../controllers/classroom.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { uploadTarea } = require('../middlewares/upload.middleware');

// Todo el classroom requiere estar logueado (el control de si puede ver
// este curso puntual se hace adentro del controller, según inscripción).
router.use(requireAuth);

router.get('/courses/:courseId/assignments', classroomController.listAssignments);
router.post('/courses/:courseId/assignments', classroomController.createAssignment);

router.post('/assignments/:assignmentId/submissions', uploadTarea, classroomController.submitAssignment);
router.get('/assignments/:assignmentId/submissions', classroomController.listSubmissions);

router.put('/submissions/:submissionId/grade', classroomController.gradeSubmission);

router.get('/courses/:courseId/students', classroomController.listStudents);
router.put('/courses/:courseId/students/:userId/complete', classroomController.markCompleted);

module.exports = router;
