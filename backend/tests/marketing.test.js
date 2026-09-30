process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-marketing.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-marketing.sqlite3');

// Marketing: ofertas en la app (con descuento real) y campañas de mail
// programadas (segmento, envío en segundo plano, apertura, click y baja).
describe('Marketing', () => {
  let app;
  let db;
  let procesos;
  let tokenAdmin;
  let tokenAlumno;
  let tokenProfe;
  let alumnoId;
  let cursoId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');
    procesos = require('../src/services/procesos');
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'T', email: 'admin-mkt@escuela.demo', password_hash: hash, rol: 'admin' });
    await db('users').insert({ nombre: 'Profe', apellido: 'T', email: 'profe-mkt@escuela.demo', password_hash: hash, rol: 'profesor' });
    const login = (email) => request(app).post('/api/auth/login').send({ email, password: '123456' }).then((r) => r.body.token);
    tokenAdmin = await login('admin-mkt@escuela.demo');
    tokenProfe = await login('profe-mkt@escuela.demo');
    const reg = await request(app).post('/api/auth/register').send({ nombre: 'Alu', apellido: 'T', email: 'alu-mkt@escuela.demo', password: '123456' });
    tokenAlumno = reg.body.token;
    alumnoId = reg.body.user.id;
    // Otro alumno que no acepta publicidad y uno de prueba: nunca reciben campañas.
    await db('users').insert({ nombre: 'NoQuiere', apellido: 'T', email: 'no-mkt@escuela.demo', password_hash: hash, rol: 'alumno', acepta_publicidad: false });
    await db('users').insert({ nombre: 'Tester', apellido: 'T', email: 'tester-mkt@prueba.invalid', password_hash: hash, rol: 'alumno', es_prueba: true });
    [cursoId] = await db('courses').insert({ titulo: 'Excel', descripcion: 'd', precio: 1000, estado: 'subido' });
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    fs.rmSync(require('../src/services/storage.service').PRIVADO_ROOT, { recursive: true, force: true });
  });

  const comoAdmin = (r) => r.set('Authorization', `Bearer ${tokenAdmin}`);
  const enHoras = (h) => new Date(Date.now() + h * 3600000).toISOString();

  describe('Ofertas en la app', () => {
    let ofertaId;

    test('valida los datos de la oferta', async () => {
      expect((await comoAdmin(request(app).post('/api/admin/ofertas')).send({ titulo: 'X', tipo: 'otro', inicia_en: enHoras(-1), termina_en: enHoras(1) })).status).toBe(400);
      expect((await comoAdmin(request(app).post('/api/admin/ofertas')).send({ titulo: 'X', tipo: 'barra', inicia_en: enHoras(1), termina_en: enHoras(-1) })).status).toBe(400);
      expect((await comoAdmin(request(app).post('/api/admin/ofertas')).send({ titulo: 'X', tipo: 'barra', descuento_pct: 20, inicia_en: enHoras(-1), termina_en: enHoras(1) })).status).toBe(400);
      expect((await comoAdmin(request(app).post('/api/admin/ofertas')).send({ titulo: 'X', tipo: 'barra', boton_url: 'javascript:alert(1)', inicia_en: enHoras(-1), termina_en: enHoras(1) })).status).toBe(400);
    });

    test('una oferta vigente para alumnos se ve (con contador) y aplica el descuento real', async () => {
      const r = await comoAdmin(request(app).post('/api/admin/ofertas')).send({
        titulo: '¡Excel con 30% off!', mensaje: 'Solo por hoy', tipo: 'barra', curso_id: cursoId, descuento_pct: 30,
        audiencia: 'todos', inicia_en: enHoras(-1), termina_en: enHoras(24), boton_texto: 'Lo quiero',
      });
      expect(r.status).toBe(201);
      ofertaId = r.body.id;

      const visitante = await request(app).get('/api/ofertas/activas');
      expect(visitante.body.ofertas).toHaveLength(1);
      expect(visitante.body.ofertas[0].curso.precioOferta).toBe(700);
      expect(visitante.body.ofertas[0].boton_url).toBe(`/tienda/${cursoId}`);

      const tienda = await request(app).get('/api/courses');
      const curso = tienda.body.courses.find((c) => c.id === cursoId);
      expect(curso.precio).toBe(700);
      expect(curso.precio_original).toBe(1000);

      // El carrito y el checkout cobran el precio con descuento.
      await request(app).post('/api/cart/items').set('Authorization', `Bearer ${tokenAlumno}`).send({ course_id: cursoId });
      const carrito = await request(app).get('/api/cart').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(carrito.body.items[0].precio).toBe(700);
      const compra = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${tokenAlumno}`).send({});
      expect(compra.status).toBe(201);
      const mail = await db('mail_log').where({ tipo: 'confirmacion_compra', user_id: alumnoId }).first();
      if (mail) expect(mail.cuerpo).toMatch(/700/);
    });

    test('audiencia: una oferta solo para visitantes no la ve un profesor; admin no ve ofertas', async () => {
      await comoAdmin(request(app).post('/api/admin/ofertas')).send({ titulo: 'Registrate', tipo: 'popup', audiencia: 'visitantes', inicia_en: enHoras(-1), termina_en: enHoras(5) });
      const profe = await request(app).get('/api/ofertas/activas').set('Authorization', `Bearer ${tokenProfe}`);
      expect(profe.body.ofertas.map((o) => o.titulo)).not.toContain('Registrate');
      const visitante = await request(app).get('/api/ofertas/activas');
      expect(visitante.body.ofertas.map((o) => o.titulo)).toContain('Registrate');
      expect((await request(app).get('/api/ofertas/activas').set('Authorization', `Bearer ${tokenAdmin}`)).body.ofertas).toHaveLength(0);
    });

    test('las vistas, clicks y cierres quedan en las estadísticas; una vencida ya no se ve ni descuenta', async () => {
      await request(app).post(`/api/ofertas/${ofertaId}/evento`).send({ tipo: 'vista', visitante: 'abcdef123456' });
      await request(app).post(`/api/ofertas/${ofertaId}/evento`).set('Authorization', `Bearer ${tokenAlumno}`).send({ tipo: 'click' });
      expect((await request(app).post(`/api/ofertas/${ofertaId}/evento`).send({ tipo: 'hackeo' })).status).toBe(400);
      const lista = await comoAdmin(request(app).get('/api/admin/ofertas'));
      const o = lista.body.ofertas.find((x) => x.id === ofertaId);
      expect(o.estadisticas.vistas).toBe(1);
      expect(o.estadisticas.clicks).toBe(1);

      await db('ofertas').where({ id: ofertaId }).update({ termina_en: '2020-01-01 00:00:00' });
      const tienda = await request(app).get('/api/courses');
      expect(tienda.body.courses.find((c) => c.id === cursoId).precio).toBe(1000);
    });
  });

  describe('Campañas de mail programadas', () => {
    let campaniaId;

    test('valida, cuenta destinatarios del segmento y muestra la vista previa escapada', async () => {
      expect((await comoAdmin(request(app).post('/api/admin/campanias')).send({ nombre: 'x' })).status).toBe(400);
      const r = await comoAdmin(request(app).post('/api/admin/campanias')).send({
        nombre: 'Primavera', asunto: 'Descuentos de primavera', titulo: 'Llegó la primavera', contenido: 'Aprovechá <b>ya</b>\nHasta el domingo',
        boton_texto: 'Ver cursos', boton_url: '/tienda', segmento: { roles: ['alumno'] },
      });
      expect(r.status).toBe(201);
      campaniaId = r.body.id;
      const cuenta = await comoAdmin(request(app).post('/api/admin/campanias/segmento/contar')).send({ segmento: { roles: ['alumno'] } });
      expect(cuenta.body.destinatarios).toBe(1); // ni el que no acepta publicidad ni el de prueba
      const vista = await comoAdmin(request(app).get(`/api/admin/campanias/${campaniaId}/vista-previa`));
      expect(vista.text).toContain('Aprovechá &lt;b&gt;ya&lt;/b&gt;');
    });

    test('programada: la tarea programada la lanza cuando llega la hora y se manda en segundo plano', async () => {
      expect((await comoAdmin(request(app).post(`/api/admin/campanias/${campaniaId}/programar`)).send({ programada_para: '2020-01-01T00:00:00Z' })).status).toBe(400);
      expect((await comoAdmin(request(app).post(`/api/admin/campanias/${campaniaId}/programar`)).send({ programada_para: enHoras(0.01) })).status).toBe(200);

      const campanias = require('../src/services/campanias.service');
      expect(await campanias.enviarCampaniasVencidas()).toBe(0); // todavía no es la hora
      await db('campanias').where({ id: campaniaId }).update({ programada_para: '2020-01-01 00:00:00' });
      expect(await campanias.enviarCampaniasVencidas()).toBe(1);
      expect(await campanias.enviarCampaniasVencidas()).toBe(0); // no se lanza dos veces

      await procesos.procesarPendientes();
      const est = await comoAdmin(request(app).get(`/api/admin/campanias/${campaniaId}/estadisticas`));
      expect(est.body.campania.estado).toBe('enviada');
      expect(est.body.enviados).toBe(1);
      const mail = await db('mail_log').where({ tipo: 'campania' }).first();
      expect(mail.destinatario).toBe('alu-mkt@escuela.demo');
      expect(mail.cuerpo).toContain('baja-publicidad/');
      // Ya enviada: no se puede editar.
      expect((await comoAdmin(request(app).put(`/api/admin/campanias/${campaniaId}`)).send({ nombre: 'x', asunto: 'y', titulo: 'z', contenido: 'w', segmento: { roles: ['alumno'] } })).status).toBe(409);
    });

    test('apertura, click (siempre al botón de la campaña) y baja de publicidad', async () => {
      const envio = await db('campania_envios').where({ campania_id: campaniaId }).first();
      const pixel = await request(app).get(`/api/m/a/${envio.token}.gif`);
      expect(pixel.headers['content-type']).toMatch(/gif/);
      const clic = await request(app).get(`/api/m/c/${envio.token}?url=https://malo.com`);
      expect(clic.status).toBe(302);
      expect(clic.headers.location).toMatch(/\/tienda$/);

      const info = await request(app).get(`/api/m/baja/${envio.token}`);
      expect(info.body.email).toMatch(/^al\*\*\*@/);
      await request(app).post(`/api/m/baja/${envio.token}`);
      expect((await db('users').where({ id: alumnoId }).first()).acepta_publicidad).toBeFalsy();

      const est = await comoAdmin(request(app).get(`/api/admin/campanias/${campaniaId}/estadisticas`));
      expect(est.body.abiertos).toBe(1);
      expect(est.body.conClick).toBe(1);
      expect(est.body.bajas).toBe(1);
      expect(est.body.tasaApertura).toBe(100);

      expect((await request(app).get('/api/m/baja/token-falso')).status).toBe(404);
    });

    test('duplicar, prueba y cancelar; sin destinatarios no se programa', async () => {
      const dup = await comoAdmin(request(app).post(`/api/admin/campanias/${campaniaId}/duplicar`));
      expect(dup.status).toBe(201);
      const prueba = await comoAdmin(request(app).post(`/api/admin/campanias/${dup.body.id}/prueba`)).send({ destinatario: 'yo@ejemplo.com' });
      expect(prueba.body.enviadoA).toBe('yo@ejemplo.com');
      // El único alumno se dio de baja: el segmento queda vacío.
      expect((await comoAdmin(request(app).post(`/api/admin/campanias/${dup.body.id}/programar`)).send({ programada_para: enHoras(2) })).status).toBe(400);
      await db('users').where({ id: alumnoId }).update({ acepta_publicidad: true });
      expect((await comoAdmin(request(app).post(`/api/admin/campanias/${dup.body.id}/programar`)).send({ programada_para: enHoras(2) })).status).toBe(200);
      expect((await comoAdmin(request(app).post(`/api/admin/campanias/${dup.body.id}/cancelar`))).status).toBe(200);
      expect((await comoAdmin(request(app).post(`/api/admin/campanias/${dup.body.id}/cancelar`))).status).toBe(409);
    });
  });
});
