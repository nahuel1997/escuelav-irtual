process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-payments.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

// Estos tests ejercitan la ORQUESTACIÓN (payments.controller.js,
// checkout.service.js, cart/courses controllers, admin) de punta a punta
// vía HTTP, no la integración real con Mercado Pago/PayPal — para eso ver
// paymentsService.test.js. Mockeamos todo payments.service.js: así
// controlamos exactamente qué "dice la pasarela" en cada test sin
// necesitar el módulo `mercadopago` de verdad ni pegarle a PayPal.
jest.mock('../src/services/payments.service');
const paymentsService = require('../src/services/payments.service');

const dbFile = path.join(__dirname, '..', 'data', 'test-payments.sqlite3');

describe('Pagos reales (Mercado Pago / PayPal)', () => {
  let app;
  let db;
  let tokenAlumno;
  let tokenAdmin;
  let cursoAId;
  let cursoBId;
  let cursoCId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    await db('achievements').insert({ codigo: 'primer_curso', titulo: 'Primeros pasos', descripcion: '', icono: '🚀' });

    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'Test', email: 'admin@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;

    const [profesorId] = await db('users').insert({
      nombre: 'Profe', apellido: 'Pago', email: 'profe-pago@escuela.demo', password_hash: hash, rol: 'profesor',
    });
    [cursoAId] = await db('courses').insert({ titulo: 'Curso Pago A', descripcion: 'x', precio: 1000, profesor_id: profesorId });
    [cursoBId] = await db('courses').insert({ titulo: 'Curso Pago B', descripcion: 'y', precio: 2000, profesor_id: profesorId });
    [cursoCId] = await db('courses').insert({ titulo: 'Curso Pago C', descripcion: 'z', precio: 500, profesor_id: profesorId });

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Pago', email: 'alumno-pago@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    paymentsService.metodosDisponibles.mockReturnValue(['mercadopago', 'paypal']);
  });

  test('GET /api/payments/metodos expone tal cual lo que devuelve el service (sin auth)', async () => {
    paymentsService.metodosDisponibles.mockReturnValue(['mercadopago']);
    const res = await request(app).get('/api/payments/metodos');
    expect(res.status).toBe(200);
    expect(res.body.metodos).toEqual(['mercadopago']);
  });

  test('un método de pago no disponible se rechaza con 400, sin crear ninguna orden', async () => {
    paymentsService.metodosDisponibles.mockReturnValue([]); // ninguno configurado
    const res = await request(app)
      .post(`/api/courses/${cursoAId}/enroll`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ metodo_pago: 'mercadopago' });
    expect(res.status).toBe(400);

    const ordenes = await db('payment_orders').count({ c: '*' }).first();
    expect(Number(ordenes.c)).toBe(0);
  });

  describe('Compra directa de un curso (courses.controller.js::enroll) con Mercado Pago', () => {
    let ordenId;

    test('con metodo_pago real, arma la orden y devuelve el link, sin inscribir todavía', async () => {
      paymentsService.crearCheckoutMercadoPago.mockResolvedValue({ externalId: 'MP-PREF-1', redirectUrl: 'https://mp.example/pagar/1' });

      const res = await request(app)
        .post(`/api/courses/${cursoAId}/enroll`)
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ metodo_pago: 'mercadopago' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ redirect: true, ordenId: expect.any(Number), redirectUrl: 'https://mp.example/pagar/1' });
      ordenId = res.body.ordenId;

      const misCursos = await request(app).get('/api/courses/mine').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(misCursos.body.courses.some((c) => c.id === cursoAId)).toBe(false); // todavía NO inscripto

      const orden = await db('payment_orders').where({ id: ordenId }).first();
      expect(orden.status).toBe('pendiente');
      expect(orden.provider).toBe('mercadopago');
      expect(orden.external_id).toBe('MP-PREF-1');
      expect(JSON.parse(orden.items)).toEqual([{ course_id: cursoAId, titulo: 'Curso Pago A', precio: 1000 }]);
    });

    test('el webhook de Mercado Pago confirma el pago e inscribe recién ahí', async () => {
      paymentsService.confirmarPagoMercadoPago.mockResolvedValue({
        aprobado: true, status: 'approved', externalReference: String(ordenId), montoTotal: 1000, paymentId: 'MP-PAY-1',
      });

      const res = await request(app)
        .post('/api/payments/webhook/mercadopago')
        .send({ type: 'payment', data: { id: 'MP-PAY-1' } });
      expect(res.status).toBe(200);

      const orden = await db('payment_orders').where({ id: ordenId }).first();
      expect(orden.status).toBe('aprobado');
      expect(orden.payment_id).toBe('MP-PAY-1');

      const misCursos = await request(app).get('/api/courses/mine').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(misCursos.body.courses.some((c) => c.id === cursoAId)).toBe(true);

      const inscripcion = await db('enrollments').where({ course_id: cursoAId }).first();
      expect(inscripcion.payment_status).toBe('pagado');
      expect(inscripcion.payment_method).toBe('mercadopago');
      expect(inscripcion.payment_order_id).toBe(ordenId);

      // Primera compra del alumno → logro otorgado, mismo criterio que el
      // checkout simulado (cart.controller.js/courses.controller.js).
      const achievement = await db('achievements').where({ codigo: 'primer_curso' }).first();
      const logro = await db('user_achievements').where({ achievement_id: achievement.id }).first();
      expect(logro).toBeDefined();
    });

    test('el webhook es idempotente: si llega dos veces, no duplica la inscripción ni el logro', async () => {
      // El controller SIEMPRE vuelve a preguntarle a MP por el payment_id
      // (así sabe a qué orden corresponde) — lo idempotente es lo que pasa
      // DESPUÉS: finalizarOrden ve que la orden ya quedó 'aprobado' y corta
      // ahí, sin volver a inscribir ni a otorgar el logro de nuevo (ver
      // checkout.service.js).
      const res = await request(app)
        .post('/api/payments/webhook/mercadopago')
        .send({ type: 'payment', data: { id: 'MP-PAY-1' } });
      expect(res.status).toBe(200);
      expect(paymentsService.confirmarPagoMercadoPago).toHaveBeenCalledTimes(1);

      const inscripciones = await db('enrollments').where({ course_id: cursoAId });
      expect(inscripciones.length).toBe(1);

      const achievement = await db('achievements').where({ codigo: 'primer_curso' }).first();
      const logros = await db('user_achievements').where({ achievement_id: achievement.id });
      expect(logros.length).toBe(1);
    });

    test('un webhook sin type=payment ni id no dispara ninguna confirmación (pero igual responde 200)', async () => {
      const res = await request(app).post('/api/payments/webhook/mercadopago').send({ type: 'merchant_order' });
      expect(res.status).toBe(200);
      expect(paymentsService.confirmarPagoMercadoPago).not.toHaveBeenCalled();
    });
  });

  describe('Checkout del carrito con PayPal (varios cursos en una sola orden)', () => {
    let ordenId;

    beforeAll(async () => {
      await request(app).post('/api/cart/items').set('Authorization', `Bearer ${tokenAlumno}`).send({ course_id: cursoBId });
      await request(app).post('/api/cart/items').set('Authorization', `Bearer ${tokenAlumno}`).send({ course_id: cursoCId });
    });

    test('con metodo_pago paypal arma UNA orden con los dos cursos y no vacía el carrito todavía', async () => {
      paymentsService.crearCheckoutPayPal.mockResolvedValue({ externalId: 'PP-ORDER-1', redirectUrl: 'https://paypal.example/approve/1' });

      const res = await request(app)
        .post('/api/cart/checkout')
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ metodo_pago: 'paypal' });

      expect(res.status).toBe(201);
      expect(res.body.redirect).toBe(true);
      expect(res.body.redirectUrl).toBe('https://paypal.example/approve/1');
      ordenId = res.body.ordenId;

      const orden = await db('payment_orders').where({ id: ordenId }).first();
      expect(orden.provider).toBe('paypal');
      expect(orden.total).toBe(2500); // 2000 + 500
      expect(JSON.parse(orden.items).map((i) => i.course_id).sort()).toEqual([cursoBId, cursoCId].sort());

      // El carrito sigue teniendo los items — el pago todavía no se confirmó.
      const carrito = await request(app).get('/api/cart').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(carrito.body.items.length).toBe(2);
    });

    test('el retorno del alumno desde PayPal confirma el pago, inscribe los dos cursos y AHORA sí vacía el carrito', async () => {
      paymentsService.capturarPagoPayPal.mockResolvedValue({
        aprobado: true, status: 'COMPLETED', externalReference: String(ordenId), paymentId: 'PP-CAPTURE-1',
      });

      const res = await request(app).get('/api/payments/retorno').query({ provider: 'paypal', token: 'PP-ORDER-1' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:3500/mis-cursos?pago=ok');

      const misCursos = await request(app).get('/api/courses/mine').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(misCursos.body.courses.some((c) => c.id === cursoBId)).toBe(true);
      expect(misCursos.body.courses.some((c) => c.id === cursoCId)).toBe(true);

      const carrito = await request(app).get('/api/cart').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(carrito.body.items).toEqual([]);
    });
  });

  describe('Pago rechazado o pendiente', () => {
    async function crearCursoYOrdenPendiente(titulo) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('123456', 10);
      const [profesorId] = await db('users').insert({ nombre: 'Profe', apellido: titulo, email: `profe-${titulo}@escuela.demo`, password_hash: hash, rol: 'profesor' });
      const [cursoId] = await db('courses').insert({ titulo: `Curso ${titulo}`, descripcion: 'x', precio: 300, profesor_id: profesorId });

      paymentsService.crearCheckoutMercadoPago.mockResolvedValue({ externalId: `MP-PREF-${titulo}`, redirectUrl: `https://mp.example/pagar/${titulo}` });
      const inicio = await request(app)
        .post(`/api/courses/${cursoId}/enroll`)
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ metodo_pago: 'mercadopago' });
      return inicio.body.ordenId;
    }

    test('un pago pendiente (in_process) en el retorno manda a /tienda con ?pago=pendiente, sin inscribir', async () => {
      const ordenId = await crearCursoYOrdenPendiente('Pendiente');

      paymentsService.confirmarPagoMercadoPago.mockResolvedValue({ aprobado: false, status: 'in_process', externalReference: String(ordenId) });
      const res = await request(app).get('/api/payments/retorno').query({ external_reference: ordenId, payment_id: 'MP-PAY-PEND' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:3500/tienda?pago=pendiente');

      const orden = await db('payment_orders').where({ id: ordenId }).first();
      expect(orden.status).toBe('pendiente');
    });

    test('un pago rechazado en el retorno manda a /tienda con ?pago=rechazado', async () => {
      const ordenId = await crearCursoYOrdenPendiente('Rechazo');

      paymentsService.confirmarPagoMercadoPago.mockResolvedValue({ aprobado: false, status: 'rejected', externalReference: String(ordenId) });
      const res = await request(app).get('/api/payments/retorno').query({ external_reference: ordenId, payment_id: 'MP-PAY-R' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:3500/tienda?pago=rechazado');

      const orden = await db('payment_orders').where({ id: ordenId }).first();
      expect(orden.status).toBe('rechazado');
    });
  });

  describe('Admin: órdenes de pago y tasa de cambio', () => {
    test('lista las órdenes creadas, con datos del usuario', async () => {
      const res = await request(app).get('/api/admin/pagos').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(200);
      expect(res.body.ordenes.length).toBeGreaterThan(0);
      expect(res.body.ordenes[0]).toHaveProperty('email');
      expect(res.body.ordenes[0]).toHaveProperty('provider');
    });

    test('filtra por estado', async () => {
      const res = await request(app).get('/api/admin/pagos').query({ estado: 'aprobado' }).set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(200);
      expect(res.body.ordenes.every((o) => o.status === 'aprobado')).toBe(true);
    });

    test('un alumno no puede ver el listado de órdenes', async () => {
      const res = await request(app).get('/api/admin/pagos').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(res.status).toBe(403);
    });

    test('tasa de cambio: default, edición, y validación', async () => {
      const inicial = await request(app).get('/api/admin/pagos/tasa-cambio').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(inicial.status).toBe(200);
      expect(inicial.body.tasa).toBe('1000');

      const editar = await request(app)
        .put('/api/admin/pagos/tasa-cambio')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ valor: '1250' });
      expect(editar.status).toBe(200);
      expect(editar.body.tasa).toBe('1250');

      const invalida = await request(app)
        .put('/api/admin/pagos/tasa-cambio')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ valor: '0' });
      expect(invalida.status).toBe(400);
    });
  });

  describe('Consulta de una orden propia (GET /api/payments/ordenes/:id)', () => {
    test('el dueño de la orden la puede consultar', async () => {
      const propia = await db('payment_orders').orderBy('id', 'desc').first();
      const res = await request(app).get(`/api/payments/ordenes/${propia.id}`).set('Authorization', `Bearer ${tokenAlumno}`);
      expect(res.status).toBe(200);
      expect(res.body.orden.id).toBe(propia.id);
    });

    test('otro usuario no puede consultar una orden ajena', async () => {
      const propia = await db('payment_orders').orderBy('id', 'desc').first();
      const otro = await request(app).post('/api/auth/register').send({
        nombre: 'Otro', apellido: 'Alumno', email: 'otro-pago@escuela.demo', password: '123456',
      });
      const res = await request(app).get(`/api/payments/ordenes/${propia.id}`).set('Authorization', `Bearer ${otro.body.token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Test Pagos (/admin-panel/testing/pagos) — herramienta de admin para probar el recorrido de pago', () => {
    test('GET /api/admin/testing/pagos/metodos expone lo mismo que el service, solo para admin', async () => {
      paymentsService.metodosDisponibles.mockReturnValue(['mercadopago']);
      const comoAlumno = await request(app).get('/api/admin/testing/pagos/metodos').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(comoAlumno.status).toBe(403);

      const comoAdmin = await request(app).get('/api/admin/testing/pagos/metodos').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(comoAdmin.status).toBe(200);
      expect(comoAdmin.body.metodos).toEqual(['mercadopago']);
    });

    test('valida título, precio y método de pago antes de crear nada', async () => {
      const sinTitulo = await request(app)
        .post('/api/admin/testing/pagos/orden')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ precio: 100, metodo_pago: 'mercadopago' });
      expect(sinTitulo.status).toBe(400);

      const precioInvalido = await request(app)
        .post('/api/admin/testing/pagos/orden')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ titulo: 'Prueba', precio: 0, metodo_pago: 'mercadopago' });
      expect(precioInvalido.status).toBe(400);

      paymentsService.metodosDisponibles.mockReturnValue([]); // ninguno configurado
      const metodoNoDisponible = await request(app)
        .post('/api/admin/testing/pagos/orden')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ titulo: 'Prueba', precio: 100, metodo_pago: 'mercadopago' });
      expect(metodoNoDisponible.status).toBe(400);
    });

    test('un alumno no puede usar la herramienta (403), aunque mande datos válidos', async () => {
      paymentsService.metodosDisponibles.mockReturnValue(['mercadopago']);
      const res = await request(app)
        .post('/api/admin/testing/pagos/orden')
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ titulo: 'Prueba', precio: 100, metodo_pago: 'mercadopago' });
      expect(res.status).toBe(403);
    });

    describe('recorrido completo con Mercado Pago, precio libre', () => {
      let ordenId;

      test('arma la orden con el precio que puso el admin, marcada como prueba (course_id null)', async () => {
        paymentsService.metodosDisponibles.mockReturnValue(['mercadopago', 'paypal']);
        paymentsService.crearCheckoutMercadoPago.mockResolvedValue({ externalId: 'MP-PREF-TEST', redirectUrl: 'https://mp.example/pagar/test' });

        const res = await request(app)
          .post('/api/admin/testing/pagos/orden')
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .send({ titulo: 'Verificando integración', precio: 12345, metodo_pago: 'mercadopago' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ ordenId: expect.any(Number), redirectUrl: 'https://mp.example/pagar/test' });
        ordenId = res.body.ordenId;

        const orden = await db('payment_orders').where({ id: ordenId }).first();
        expect(orden.es_prueba).toBeTruthy();
        expect(orden.total).toBe(12345);
        expect(orden.user_id).toBe((await db('users').where({ email: 'admin@escuela.demo' }).first()).id);
        const items = JSON.parse(orden.items);
        expect(items).toEqual([{ course_id: null, titulo: '[PRUEBA] Verificando integración', precio: 12345 }]);
      });

      test('aparece en el historial de pruebas del admin (GET /pagos/ordenes)', async () => {
        const res = await request(app).get('/api/admin/testing/pagos/ordenes').set('Authorization', `Bearer ${tokenAdmin}`);
        expect(res.status).toBe(200);
        expect(res.body.ordenes.some((o) => o.id === ordenId)).toBe(true);
        expect(res.body.ordenes.every((o) => o.es_prueba)).toBeTruthy();
      });

      test('un alumno no ve el historial de pruebas del admin (403)', async () => {
        const res = await request(app).get('/api/admin/testing/pagos/ordenes').set('Authorization', `Bearer ${tokenAlumno}`);
        expect(res.status).toBe(403);
      });

      test('confirmar el pago (retorno) lo marca aprobado de verdad, pero NO inscribe en ningún curso, no otorga logros ni manda mail', async () => {
        const enrollmentsAntes = await db('enrollments').count({ c: '*' }).first();
        const mailsAntes = await db('mail_log').where({ tipo: 'confirmacion_compra' }).count({ c: '*' }).first();

        paymentsService.confirmarPagoMercadoPago.mockResolvedValue({
          aprobado: true, status: 'approved', externalReference: String(ordenId), montoTotal: 12345, paymentId: 'MP-PAY-TEST',
        });

        const res = await request(app).get('/api/payments/retorno').query({ external_reference: ordenId, payment_id: 'MP-PAY-TEST' });
        expect(res.status).toBe(302);
        // Mismo destino genérico que cualquier pago aprobado — la pantalla
        // de "listo" de la herramienta vive en el propio panel de admin, que
        // sigue consultando el estado de la orden en la pestaña original
        // (ver AdminTestPagos.jsx); esta redirección es a una pestaña aparte.
        expect(res.headers.location).toBe('http://localhost:3500/mis-cursos?pago=ok');

        const orden = await db('payment_orders').where({ id: ordenId }).first();
        expect(orden.status).toBe('aprobado');
        expect(orden.payment_id).toBe('MP-PAY-TEST');

        const enrollmentsDespues = await db('enrollments').count({ c: '*' }).first();
        expect(Number(enrollmentsDespues.c)).toBe(Number(enrollmentsAntes.c));

        const mailsDespues = await db('mail_log').where({ tipo: 'confirmacion_compra' }).count({ c: '*' }).first();
        expect(Number(mailsDespues.c)).toBe(Number(mailsAntes.c));
      });
    });
  });
});
