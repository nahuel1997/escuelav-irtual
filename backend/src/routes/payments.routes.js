const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// Públicas a propósito (sin requireAuth): a estas rutas les pega la propia
// pasarela (webhooks, servidor a servidor) o el navegador del alumno
// llegando de vuelta desde Mercado Pago/PayPal (retorno) — ninguna de las
// dos puede depender de nuestra sesión. Ver payments.controller.js para el
// detalle de por qué esto es seguro igual (nunca se confía en el body/query
// de estas requests para decidir "está pagado").
router.get('/metodos', paymentsController.metodosDisponibles);
router.post('/webhook/mercadopago', paymentsController.webhookMercadoPago);
router.post('/webhook/paypal', paymentsController.webhookPayPal);
router.get('/retorno', paymentsController.retorno);

// Con auth: consultar el estado de UNA orden propia (ver comentario en el
// controller sobre por qué existe además del webhook/retorno).
router.get('/ordenes/:id', requireAuth, paymentsController.verOrden);

module.exports = router;
