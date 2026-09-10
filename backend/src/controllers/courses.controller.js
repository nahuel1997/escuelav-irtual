const courseModel = require('../models/course.model');
const courseChapterModel = require('../models/courseChapter.model');
const enrollmentModel = require('../models/enrollment.model');
const achievementModel = require('../models/achievement.model');
const paymentsService = require('../services/payments.service');
const checkoutService = require('../services/checkout.service');
const mailService = require('../services/mail.service');
const env = require('../config/env');
const userModel = require('../models/user.model');
const CATEGORIAS_CURSO = require('../config/categorias');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

function formatPrecio(precio) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precio);
}

// Catálogo público (tienda de cursos) — no requiere estar logueado. Solo
// cursos "subido": un curso en revisión, cancelado o fuera de sistema no
// tiene que aparecer acá (ver estadosCurso.js).
const listCourses = asyncHandler(async (req, res) => {
  const { categoria } = req.query;
  const courses = await courseModel.listAll({ categoria, estado: 'subido' });
  res.json({ courses });
});

// Lista fija de categorías para el desplegable del form de admin (ver
// config/categorias.js) — GET público porque no expone nada sensible y
// simplifica no tener que duplicar la lista en el frontend.
const listCategorias = asyncHandler(async (req, res) => {
  res.json({ categorias: CATEGORIAS_CURSO });
});

// Cursos que dicta el profesor logueado, sin importar su estado — a
// diferencia de listCourses (la tienda pública), acá el profesor tiene que
// seguir viendo los suyos aunque estén en revisión, cancelados o fuera de
// sistema, porque son igual "suyos" (los sigue gestionando/editando).
const myTeachingCourses = asyncHandler(async (req, res) => {
  const courses = await courseModel.listByProfesor(req.user.id);
  res.json({ courses });
});

// Detalle público del curso (/tienda/:id): además de los datos del curso,
// quién lo da y un temario "vidriera" — solo títulos de unidad/capítulo,
// SIN video_url ni nada del contenido en sí, para que quien todavía no
// compró pueda ver qué incluye el curso sin poder mirarlo gratis.
const getCourse = asyncHandler(async (req, res) => {
  const course = await courseModel.findByIdConProfesor(req.params.id);
  if (!course) throw new AppError('Curso no encontrado', 404);

  const capitulos = await courseChapterModel.listByCourse(course.id);
  const unidadesMap = new Map();
  for (const cap of capitulos) {
    if (!unidadesMap.has(cap.unit_id)) {
      unidadesMap.set(cap.unit_id, { titulo: cap.unidad_titulo, orden: cap.unidad_orden, capitulos: [] });
    }
    unidadesMap.get(cap.unit_id).capitulos.push({ titulo: cap.titulo, orden: cap.orden });
  }
  const temario = [...unidadesMap.values()].sort((a, b) => a.orden - b.orden);

  res.json({ course, temario });
});

// Solo profesores pueden crear cursos.
const createCourse = asyncHandler(async (req, res) => {
  const { titulo, descripcion, precio, categoria, imagen_url } = req.body;
  if (!titulo || !descripcion) {
    throw new AppError('Faltan título y/o descripción del curso', 400);
  }
  const [id] = await courseModel.create({
    titulo,
    descripcion,
    precio: precio || 0,
    categoria,
    imagen_url,
    profesor_id: req.user.id,
  });
  const course = await courseModel.findById(id);
  res.status(201).json({ course });
});

// "Comprar"/inscribirse a un solo curso, directo (sin pasar por el
// carrito). Pasa por payments.service.js (ver comentario ahí sobre por qué
// está aislado). Para comprar varios cursos juntos existe el carrito (ver
// cart.controller.js) — ambos caminos mandan el mismo mail de confirmación.
//
// `metodo_pago` es OPCIONAL en el body: sin él, este endpoint se comporta
// exactamente como siempre (pago simulado, síncrono, inscribe de una). Si
// se manda un método real (mercadopago/paypal), en cambio, no inscribe acá
// — arma la orden con checkoutService (que valida el curso/precio con SU
// PROPIA búsqueda, nunca con lo que mande el cliente) y devuelve el link de
// la pasarela; la inscripción real pasa recién cuando el webhook o
// /api/payments/retorno confirman el pago (ver checkout.service.js).
const enroll = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.id);
  const course = await courseModel.findById(courseId);
  if (!course) throw new AppError('Curso no encontrado', 404);
  if (course.estado !== 'subido') {
    throw new AppError('Este curso no está disponible para la compra', 400);
  }

  const yaInscripto = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
  if (yaInscripto) {
    throw new AppError('Ya estás inscripto en este curso', 409);
  }

  const user = await userModel.findById(req.user.id);

  const { metodo_pago } = req.body;
  if (metodo_pago) {
    const { ordenId, redirectUrl } = await checkoutService.iniciarOrden({
      userId: req.user.id,
      items: [{ course_id: course.id, titulo: course.titulo, precio: course.precio }],
      metodoPago: metodo_pago,
      payerEmail: user.email,
    });
    return res.status(201).json({ redirect: true, ordenId, redirectUrl });
  }

  const pago = await paymentsService.processPayment({ course, user });
  if (!pago.ok) {
    throw new AppError('El pago no pudo procesarse, intentá de nuevo', 402);
  }

  await enrollmentModel.create({
    user_id: req.user.id,
    course_id: courseId,
    payment_status: pago.status,
    payment_method: pago.method,
    transaction_id: pago.transactionId,
  });

  const esPrimerCurso = (await enrollmentModel.countForUser(req.user.id)).count == 1; // eslint-disable-line eqeqeq
  if (esPrimerCurso) {
    await achievementModel.grantIfNotExists(req.user.id, 'primer_curso');
  }

  // Mail de confirmación de compra — best effort, no bloquea la respuesta
  // si el envío falla (ver mail.service.js).
  await mailService.enviarMail({
    clave: 'confirmacion_compra',
    destinatario: user.email,
    variables: {
      nombre: user.nombre,
      cursos: `<ul><li>${course.titulo} — ${formatPrecio(course.precio)}</li></ul>`,
      total: formatPrecio(course.precio),
      link_mis_cursos: `${env.FRONTEND_URL}/mis-cursos`,
    },
    userId: user.id,
  });

  res.status(201).json({ ok: true, transactionId: pago.transactionId });
});

const myCourses = asyncHandler(async (req, res) => {
  const courses = await enrollmentModel.listForUser(req.user.id);
  res.json({ courses });
});

module.exports = { listCourses, listCategorias, myTeachingCourses, getCourse, createCourse, enroll, myCourses };
