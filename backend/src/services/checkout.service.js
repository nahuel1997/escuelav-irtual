// checkout.service.js — orquesta un pago real de punta a punta: crear la
// orden pendiente, mandar al alumno a la pasarela, y confirmar/inscribir
// cuando el pago se aprueba. Se separó de payments.service.js (que SOLO
// habla con Mercado Pago/PayPal, sin saber qué es un "curso" ni una
// "inscripción") para que tanto el checkout del carrito como la compra
// directa de un curso puedan reusar exactamente la misma lógica sin
// duplicarla, y para que el webhook y el retorno del alumno confirmen el
// pago llamando siempre a la misma función (finalizarOrden).
const paymentOrderModel = require('../models/paymentOrder.model');
const paymentsService = require('./payments.service');
const enrollmentModel = require('../models/enrollment.model');
const achievementModel = require('../models/achievement.model');
const cartModel = require('../models/cart.model');
const mailService = require('./mail.service');
const userModel = require('../models/user.model');
const env = require('../config/env');
const { AppError } = require('../middlewares/error.middleware');

function formatPrecio(precio) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precio);
}

const NOMBRE_PROVIDER = { mercadopago: 'Mercado Pago', paypal: 'PayPal' };

// Lógica común para arrancar una orden con el proveedor real, compartida
// entre iniciarOrden (compra de verdad, items validados por el caller) e
// iniciarOrdenDePrueba (herramienta de admin, ver más abajo) — para que
// las dos sigan EXACTAMENTE el mismo camino contra Mercado Pago/PayPal y
// no se desincronicen con el tiempo.
async function crearOrdenConProveedor({ userId, items, total, metodoPago, payerEmail, esPrueba }) {
  if (!paymentsService.metodosDisponibles().includes(metodoPago)) {
    throw new AppError('Ese método de pago no está disponible todavía', 400);
  }

  // El total siempre se guarda en ARS (nuestra moneda "real" de precios) —
  // para PayPal la conversión a USD pasa adentro de
  // payments.service.js::crearCheckoutPayPal, es un detalle de esa
  // pasarela puntual, no algo que valga la pena reflejar acá y complicar
  // la comparación entre órdenes de distintos proveedores.
  const [ordenId] = await paymentOrderModel.create({ userId, provider: metodoPago, items, total, moneda: 'ARS', esPrueba });

  let resultado;
  try {
    resultado = metodoPago === 'mercadopago'
      ? await paymentsService.crearCheckoutMercadoPago({ items, externalReference: ordenId, payerEmail })
      : await paymentsService.crearCheckoutPayPal({ total, externalReference: ordenId });
  } catch (err) {
    await paymentOrderModel.marcarEstado(ordenId, { status: 'rechazado' });
    console.error(`[checkout.service] No se pudo iniciar orden #${ordenId} con ${metodoPago}:`, err.message);
    throw new AppError(`No se pudo iniciar el pago con ${NOMBRE_PROVIDER[metodoPago]}. Intentá de nuevo en un momento.`, 502);
  }

  if (!resultado.redirectUrl) {
    await paymentOrderModel.marcarEstado(ordenId, { status: 'rechazado' });
    throw new AppError(`${NOMBRE_PROVIDER[metodoPago]} no devolvió un link de pago. Intentá de nuevo.`, 502);
  }

  await paymentOrderModel.setExternalId(ordenId, resultado.externalId);
  return { ordenId, redirectUrl: resultado.redirectUrl };
}

// `items`: [{course_id, titulo, precio}], ya validados y filtrados por
// quien llama (curso disponible, no comprado todavía) — este servicio no
// vuelve a chequear eso, confía en el controller.
async function iniciarOrden({ userId, items, metodoPago, payerEmail }) {
  const total = items.reduce((acc, i) => acc + Number(i.precio || 0), 0);
  return crearOrdenConProveedor({ userId, items, total, metodoPago, payerEmail, esPrueba: false });
}

// Herramienta de admin (/admin-panel/testing/pagos, "Test Pagos"): arranca
// una orden real con Mercado Pago o PayPal igual que una compra de
// verdad — mismas credenciales, mismo Checkout Pro/Orders API, mismo
// recorrido — pero con un precio libre que pone el admin (no sale de
// ningún curso real) y marcada `esPrueba: true`, para que
// finalizarOrden confirme el pago contra el proveedor de verdad (así se
// valida que las credenciales/integración andan) pero NO inscriba a
// nadie en ningún curso, no otorgue el logro de "primer curso" ni mande
// el mail de confirmación de compra — ver el corte temprano en
// finalizarOrden más abajo.
async function iniciarOrdenDePrueba({ userId, titulo, precio, metodoPago, payerEmail }) {
  const items = [{ course_id: null, titulo: `[PRUEBA] ${titulo}`, precio }];
  return crearOrdenConProveedor({ userId, items, total: precio, metodoPago, payerEmail, esPrueba: true });
}

// Confirma una orden contra el proveedor real y, si está aprobada,
// inscribe al alumno en lo que haya comprado. IDEMPOTENTE a propósito: el
// webhook y el retorno del alumno a la app pueden llamar a esto casi al
// mismo tiempo para la MISMA orden — la segunda llamada ve que ya quedó
// 'aprobado' y no vuelve a inscribir ni a mandar el mail de nuevo.
//
// `datos` trae lo que cada camino ya sabe: el webhook/retorno de Mercado
// Pago da un payment_id; el de PayPal no necesita nada más que el id de
// la orden (ya guardado como external_id).
async function finalizarOrden(ordenId, datos = {}) {
  const orden = await paymentOrderModel.findById(ordenId);
  if (!orden) return { encontrada: false };
  if (orden.status === 'aprobado') return { encontrada: true, yaProcesada: true, aprobado: true, comprados: [] };

  let confirmacion;
  if (orden.provider === 'mercadopago') {
    if (!datos.paymentIdMercadoPago) return { encontrada: true, aprobado: false, pendiente: true };
    confirmacion = await paymentsService.confirmarPagoMercadoPago(datos.paymentIdMercadoPago);
  } else {
    confirmacion = await paymentsService.capturarPagoPayPal(orden.external_id);
  }

  if (!confirmacion.aprobado) {
    const enProceso = confirmacion.status === 'pending' || confirmacion.status === 'in_process';
    await paymentOrderModel.marcarEstado(ordenId, { status: enProceso ? 'pendiente' : 'rechazado' });
    return { encontrada: true, aprobado: false, pendiente: enProceso };
  }

  await paymentOrderModel.marcarEstado(ordenId, { status: 'aprobado', paymentId: confirmacion.paymentId });

  // Orden de prueba (herramienta de admin "Test Pagos"): ya se confirmó de
  // verdad contra el proveedor (eso es lo que se quería probar) y quedó
  // 'aprobado' arriba — pero acá corta, sin inscribir en ningún curso, sin
  // otorgar logros ni mandar el mail de confirmación de compra, porque
  // `orden.items[0].course_id` es null (no es un curso real).
  if (orden.es_prueba) {
    return { encontrada: true, aprobado: true, comprados: [], esPrueba: true };
  }

  const user = await userModel.findById(orden.user_id);
  const cantidadPrevia = (await enrollmentModel.countForUser(orden.user_id)).count;
  const comprados = [];
  for (const item of orden.items) {
    // eslint-disable-next-line no-await-in-loop
    const yaInscripto = await enrollmentModel.findByUserAndCourse(orden.user_id, item.course_id);
    if (yaInscripto) continue; // ya lo tenía (ej: lo compró en paralelo por otro lado) — no duplicar
    // eslint-disable-next-line no-await-in-loop
    await enrollmentModel.create({
      user_id: orden.user_id,
      course_id: item.course_id,
      payment_status: 'pagado',
      payment_method: orden.provider,
      transaction_id: confirmacion.paymentId,
      payment_order_id: ordenId,
    });
    // El checkout con pago real no vacía el carrito al iniciar la orden
    // (el pago podría rechazarse) — recién acá, con el pago ya confirmado,
    // sacamos el curso del carrito si seguía ahí. Best-effort: si esto
    // falla no tiene que tirar abajo la confirmación del pago en sí.
    // eslint-disable-next-line no-await-in-loop
    await cartModel.quitarDeCarritoActivoSiExiste(orden.user_id, item.course_id).catch(() => {});
    comprados.push(item);
  }

  if (Number(cantidadPrevia) === 0 && comprados.length > 0) {
    await achievementModel.grantIfNotExists(orden.user_id, 'primer_curso');
  }

  if (comprados.length > 0 && user) {
    const cursosHtml = `<ul>${comprados.map((c) => `<li>${c.titulo} — ${formatPrecio(c.precio)}</li>`).join('')}</ul>`;
    await mailService.enviarMail({
      clave: 'confirmacion_compra',
      destinatario: user.email,
      variables: { nombre: user.nombre, cursos: cursosHtml, total: formatPrecio(orden.total), link_mis_cursos: `${env.FRONTEND_URL}/mis-cursos` },
      userId: user.id,
    });
  }

  return { encontrada: true, aprobado: true, comprados };
}

module.exports = { iniciarOrden, iniciarOrdenDePrueba, finalizarOrden };
