// Controller de pagos reales. Dos públicos bien distintos:
//   - Rutas públicas (montadas en payments.routes.js, SIN requireAuth
//     salvo donde se marca): las pasarelas y el propio navegador del
//     alumno les pegan desde afuera, no pueden depender de nuestra
//     sesión.
//   - Rutas de admin (montadas en admin.routes.js, mismo patrón que
//     mails.controller.js): solo lectura de órdenes + la tasa de cambio
//     de PayPal.
const checkoutService = require('../services/checkout.service');
const paymentsService = require('../services/payments.service');
const paymentOrderModel = require('../models/paymentOrder.model');
const appSettingModel = require('../models/appSetting.model');
const env = require('../config/env');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Público (sin auth): así el frontend sabe, antes de mostrar el checkout,
// qué botones tiene sentido mostrar. Si no hay ninguno real configurado,
// el frontend no muestra selector — sigue comprando en modo simulado como
// siempre.
const metodosDisponibles = asyncHandler(async (req, res) => {
  res.json({ metodos: paymentsService.metodosDisponibles() });
});

// NOTA sobre "iniciar": a propósito NO hay un endpoint genérico acá que
// reciba `items` (curso + precio) del cliente y arranque una orden. Ese
// diseño permitiría que alguien mande cualquier precio desde el propio
// navegador (checkoutService.iniciarOrden confía en que el precio de cada
// item ya viene validado — ver el comentario en checkout.service.js). Por
// eso quien arranca una orden real es siempre cart.controller.js::checkout
// o courses.controller.js::enroll: son los únicos lugares que buscan el
// curso en la base y arman `items` con SU precio, no el que mande el
// cliente. Acá solo viven las rutas que de verdad son "de la pasarela
// hacia adentro" (webhooks, retorno) o de solo lectura (verOrden, admin).

// --- Webhooks ---------------------------------------------------------
// IMPORTANTE: nunca confiamos en el body/query de estas requests para
// decidir "está pagado" — solo los usamos para saber DE QUÉ orden hablan.
// El estado real siempre se vuelve a preguntar a la API del proveedor
// dentro de checkoutService.finalizarOrden. Por eso ninguna de las dos
// rutas necesita (ni debería tener) autenticación de por medio: aunque
// alguien mande un webhook falso, lo único que logra es que volvamos a
// consultar el estado real de una orden puntual, no que se dé por pagada
// sin más.
//
// Siempre respondemos 200 aunque no hayamos podido procesar del todo —
// devolver un error acá hace que Mercado Pago/PayPal reintenten sin fin,
// y el error ya queda en nuestros logs igual.
const webhookMercadoPago = asyncHandler(async (req, res) => {
  const paymentId = req.body?.data?.id || req.query['data.id'] || req.query.id;
  const tipo = req.body?.type || req.query.type || req.query.topic;
  if (tipo && tipo !== 'payment' || !paymentId) return res.sendStatus(200);

  try {
    const confirmacion = await paymentsService.confirmarPagoMercadoPago(paymentId);
    if (confirmacion.externalReference) {
      await checkoutService.finalizarOrden(confirmacion.externalReference, { paymentIdMercadoPago: paymentId });
    }
  } catch (err) {
    console.error('[payments.controller] Error procesando webhook de Mercado Pago:', err.message);
  }
  res.sendStatus(200);
});

const webhookPayPal = asyncHandler(async (req, res) => {
  const eventType = req.body?.event_type;
  const orderId = req.body?.resource?.id;
  if (eventType === 'CHECKOUT.ORDER.APPROVED' && orderId) {
    try {
      const orden = await paymentOrderModel.findByExternalId('paypal', orderId);
      if (orden) await checkoutService.finalizarOrden(orden.id);
    } catch (err) {
      console.error('[payments.controller] Error procesando webhook de PayPal:', err.message);
    }
  }
  res.sendStatus(200);
});

// --- Retorno del alumno a la app ---------------------------------------
// Acá vuelve el NAVEGADOR del alumno (no es una llamada servidor-a-servidor
// como los webhooks) después de pagar/cancelar en la pasarela — por eso
// termina en un redirect a una página del frontend, no en un JSON. Sirve
// además como red de seguridad si el webhook todavía no llegó (o nunca va
// a llegar, típicamente en desarrollo local sin URL pública): confirmamos
// el pago acá mismo antes de mandarlo de vuelta.
const retorno = asyncHandler(async (req, res) => {
  const esPaypal = req.query.provider === 'paypal';
  let resultado = { aprobado: false };

  try {
    if (esPaypal) {
      const orden = await paymentOrderModel.findByExternalId('paypal', req.query.token);
      if (orden) resultado = await checkoutService.finalizarOrden(orden.id);
    } else {
      const ordenId = req.query.external_reference;
      const paymentId = req.query.payment_id || req.query.collection_id;
      if (ordenId) resultado = await checkoutService.finalizarOrden(ordenId, { paymentIdMercadoPago: paymentId });
    }
  } catch (err) {
    console.error('[payments.controller] Error confirmando retorno de pago:', err.message);
  }

  const estado = resultado.aprobado ? 'ok' : resultado.pendiente ? 'pendiente' : 'rechazado';
  const destino = resultado.aprobado ? '/mis-cursos' : '/tienda';
  res.redirect(`${env.FRONTEND_URL}${destino}?pago=${estado}`);
});

// Con auth: para que el frontend pueda consultar "¿ya se confirmó?" sin
// esperar pasivamente — por ejemplo si el alumno vuelve a la pestaña de
// la app antes de que el redirect de la pasarela termine de cargar.
const verOrden = asyncHandler(async (req, res) => {
  const orden = await paymentOrderModel.findById(req.params.id);
  if (!orden || orden.user_id !== req.user.id) throw new AppError('Orden no encontrada', 404);
  res.json({ orden: { id: orden.id, provider: orden.provider, status: orden.status, total: orden.total, items: orden.items } });
});

// --- Admin (solo lectura de órdenes + tasa de cambio) -------------------

const listOrdenes = asyncHandler(async (req, res) => {
  const { estado, page } = req.query;
  const { rows, total } = await paymentOrderModel.listAll({ estado, page: page ? Number(page) : 1 });
  res.json({ ordenes: rows, total, page: page ? Number(page) : 1, totalPages: Math.max(1, Math.ceil(total / 20)) });
});

const getTasaCambio = asyncHandler(async (req, res) => {
  const valor = await appSettingModel.getValor('paypal_tasa_cambio_usd', '1000');
  res.json({ tasa: valor });
});

const setTasaCambio = asyncHandler(async (req, res) => {
  const { valor } = req.body;
  const numero = Number(valor);
  if (!valor || Number.isNaN(numero) || numero <= 0) throw new AppError('La tasa tiene que ser un número mayor a 0', 400);
  const actualizado = await appSettingModel.upsert('paypal_tasa_cambio_usd', valor);
  res.json({ tasa: actualizado.valor });
});

module.exports = {
  metodosDisponibles,
  webhookMercadoPago,
  webhookPayPal,
  retorno,
  verOrden,
  listOrdenes,
  getTasaCambio,
  setTasaCambio,
};
