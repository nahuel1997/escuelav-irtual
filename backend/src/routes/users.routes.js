const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.get('/profile', requireAuth, usersController.getProfile);
router.put('/profile', requireAuth, usersController.updateProfile);
router.get('/profesores', requireAuth, usersController.listProfesores);

module.exports = router;
