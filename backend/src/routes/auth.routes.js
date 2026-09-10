const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { loginLimiter, registerLimiter, verificationLimiter } = require('../middlewares/rateLimit.middleware');

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/me', requireAuth, authController.me);
router.post('/logout', requireAuth, authController.logout);

router.post('/verify-email', requireAuth, verificationLimiter, authController.verifyEmail);
router.post('/resend-verification', requireAuth, verificationLimiter, authController.resendVerification);

module.exports = router;
