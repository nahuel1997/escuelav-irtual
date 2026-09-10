const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/courses.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Público: catálogo de la tienda.
router.get('/', coursesController.listCourses);

// Requiere login: "mis cursos" tiene que ir antes de /:id para no matchear
// "mine" como si fuera un id. Mismo motivo para /categories y /teaching.
router.get('/mine', requireAuth, coursesController.myCourses);
router.get('/categories', coursesController.listCategorias);
router.get('/teaching', requireAuth, requireRole('profesor'), coursesController.myTeachingCourses);

router.get('/:id', coursesController.getCourse);

// Solo profesores.
router.post('/', requireAuth, requireRole('profesor'), coursesController.createCourse);

// Cualquier usuario logueado puede inscribirse/"comprar".
router.post('/:id/enroll', requireAuth, coursesController.enroll);

module.exports = router;
