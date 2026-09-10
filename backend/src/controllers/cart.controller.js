// Carrito de compras de la tienda de cursos. Convive con la compra directa
// de un solo curso que ya existía (POST /courses/:id/enroll, sin cambios) —
// el carrito es la alternativa para juntar varios cursos y pagarlos juntos.
// Reutiliza el mismo payments.service.js (pago simulado) que la compra
// directa: agregar el carrito no cambió cómo se "cobra", solo agrupa
// varias compras en un solo checkout.
const cartModel = require('../models/cart.model');
const courseModel = require('../models/course.model');
const enrollmentModel = require('../models/enrollment.model');
const achievementModel = require('../models/achievement.model');
const userModel = require('../models/user.model');
const paymentsService = require('../services/payments.service');
const checkoutService = require('../services/checkout.service');
const mailService = require('../services/mail.service');
const env = require('../config/env');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

function formatPrecio(precio) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precio);
}

const verCarrito = asyncHandler(async (req, res) => {
  const cart = await cartModel.obtenerOCrearActivo(req.user.id);
  const items = await cartModel.listItems(cart.id);
  res.json({ cart: { id: cart.id, estado: cart.estado }, items });
});

const agregarItem = asyncHandler(async (req, res) => {
  const { course_id } = req.body;
  if (!course_id) throw new AppError('Falta el curso a agregar', 400);

  const course = await courseModel.findById(course_id);
  if (!course) throw new AppError('Curso no encontrado', 404);
  if (course.estado !== 'subido') throw new AppError('Este curso no está disponible para la compra', 400);

  const yaInscripto = await enrollmentModel.findByUserAndCourse(req.user.id, course_id);
  if (yaInscripto) throw new AppError('Ya estás inscripto en este curso', 409);

  const cart = await cartModel.obtenerOCrearActivo(req.user.id);
  await cartModel.agregarItem(cart.id, course_id);
  const items = await cartModel.listItems(cart.id);
  res.status(201).json({ items });
});

const quitarItem = asyncHandler(async (req, res) => {
  const cart = await cartModel.obtenerOCrearActivo(req.user.id);
  await cartModel.quitarItem(cart.id, req.params.courseId);
  const items = await cartModel.listItems(cart.id);
  res.json({ items });
});

// Paga todos los cursos del carrito de una. `metodo_pago` es OPCIONAL en
// el body:
//   - Sin él: comportamiento de siempre — pago simulado, un pago por curso
//     (así uno que ya se compró en paralelo en otra pestaña no bloquea a
//     los demás), inscribe de una y devuelve { ok: true, comprados, ... }.
//   - Con un método real (mercadopago/paypal): NO inscribe acá. Arma UNA
//     sola orden con todos los cursos que sí se pueden pagar (mismo
//     filtro de siempre: disponibles y no comprados todavía) y devuelve el
//     link de la pasarela — { redirect: true, redirectUrl, ... }. El
//     carrito no se vacía en este punto (el pago todavía puede
//     rechazarse); se va vaciando curso por curso a medida que se
//     confirma el pago (ver checkout.service.js::finalizarOrden).
const checkout = asyncHandler(async (req, res) => {
  const cart = await cartModel.obtenerOCrearActivo(req.user.id);
  const items = await cartModel.listItems(cart.id);
  if (items.length === 0) throw new AppError('Tu carrito está vacío', 400);

  const user = await userModel.findById(req.user.id);
  const { metodo_pago } = req.body;

  // Mismo filtro para los dos caminos: qué del carrito de verdad se puede
  // pagar ahora mismo (defensa extra: si el curso se agregó al carrito
  // cuando estaba "subido" y después el admin lo cambió de estado, o si el
  // alumno ya lo compró por otro lado mientras tanto, no lo cobramos).
  const pagables = [];
  const yaInscriptos = [];
  const noDisponibles = [];
  for (const item of items) {
    if (item.estado !== 'subido') {
      noDisponibles.push(item.titulo);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const yaInscripto = await enrollmentModel.findByUserAndCourse(req.user.id, item.id);
    if (yaInscripto) {
      yaInscriptos.push(item.titulo);
      continue;
    }
    pagables.push(item);
  }

  if (pagables.length === 0) {
    const motivo = noDisponibles.length > 0 && yaInscriptos.length === 0
      ? 'Ningún curso de tu carrito está disponible para la compra'
      : 'Ya estás inscripto en todos los cursos de tu carrito';
    throw new AppError(motivo, 409);
  }

  if (metodo_pago) {
    const { ordenId, redirectUrl } = await checkoutService.iniciarOrden({
      userId: req.user.id,
      items: pagables.map((c) => ({ course_id: c.id, titulo: c.titulo, precio: c.precio })),
      metodoPago: metodo_pago,
      payerEmail: user.email,
    });
    return res.status(201).json({ redirect: true, ordenId, redirectUrl, yaInscriptos, noDisponibles });
  }

  const cantidadPrevia = (await enrollmentModel.countForUser(req.user.id)).count;
  const comprados = [];
  for (const item of pagables) {
    // eslint-disable-next-line no-await-in-loop
    const pago = await paymentsService.processPayment({ course: item, user });
    if (!pago.ok) continue; // el simulado siempre aprueba, pero dejamos el chequeo por si mañana no
    // eslint-disable-next-line no-await-in-loop
    await enrollmentModel.create({
      user_id: req.user.id,
      course_id: item.id,
      payment_status: pago.status,
      payment_method: pago.method,
      transaction_id: pago.transactionId,
    });
    comprados.push(item);
  }

  await cartModel.vaciar(cart.id);
  await cartModel.marcarConvertido(cart.id);

  if (Number(cantidadPrevia) === 0 && comprados.length > 0) {
    await achievementModel.grantIfNotExists(req.user.id, 'primer_curso');
  }

  const total = comprados.reduce((acc, c) => acc + Number(c.precio || 0), 0);
  const cursosHtml = `<ul>${comprados.map((c) => `<li>${c.titulo} — ${formatPrecio(c.precio)}</li>`).join('')}</ul>`;
  if (comprados.length > 0) {
    await mailService.enviarMail({
      clave: 'confirmacion_compra',
      destinatario: user.email,
      variables: { nombre: user.nombre, cursos: cursosHtml, total: formatPrecio(total), link_mis_cursos: `${env.FRONTEND_URL}/mis-cursos` },
      userId: user.id,
    });
  }

  res.status(201).json({
    ok: true,
    comprados: comprados.map((c) => ({ id: c.id, titulo: c.titulo })),
    yaInscriptos,
    noDisponibles,
  });
});

module.exports = { verCarrito, agregarItem, quitarItem, checkout };
