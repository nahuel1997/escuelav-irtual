const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// Todo el carrito requiere estar logueado (es personal de cada cuenta).
router.use(requireAuth);

router.get('/', cartController.verCarrito);
router.post('/items', cartController.agregarItem);
router.delete('/items/:courseId', cartController.quitarItem);
router.post('/checkout', cartController.checkout);

module.exports = router;
