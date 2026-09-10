const express = require('express');
const router = express.Router();
const achievementsController = require('../controllers/achievements.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.get('/', achievementsController.listAll); // catálogo completo de logros posibles
router.get('/mine', requireAuth, achievementsController.myAchievements);

module.exports = router;
