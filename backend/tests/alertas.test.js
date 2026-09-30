// "Alertas": el admin manda un mensaje de texto libre a uno o varios
// alumnos/profesores. Cubre las dos puntas — alta/historial del admin
// (admin.controller.js) y el lado del destinatario (alertas.controller.js:
// pop-up la primera vez, después disponible en su propia pestaña).
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-alertas.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const dbFile = path.join(__dirname, '..', 'data', 'test-alertas.sqlite3');

describe('Alertas', () => {
  let app;
  let db;
  let tokenAdmin;
  let tokenAlumno;
  let tokenProfesor;
  let tokenOtroAlumno;
  let alumnoId;
  let profesorId;
  let otroAlumnoId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');

    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'Test', email: 'admin-alertas@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin-alertas@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Test', email: 'alumno-alertas@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;
    alumnoId = alumno.body.user.id;

    const otroAlumno = await request(app).post('/api/auth/register').send({
      nombre: 'Otro', apellido: 'Alumno', email: 'otro-alumno-alertas@escuela.demo', password: '123456',
    });
    tokenOtroAlumno = otroAlumno.body.token;
    otroAlumnoId = otroAlumno.body.user.id;

    const [idProfesor] = await db('users').insert({ nombre: 'Profe', apellido: 'Test', email: 'profesor-alertas@escuela.demo', password_hash: hash, rol: 'profesor' });
    profesorId = idProfesor;
    const loginProfesor = await request(app).post('/api/auth/login').send({ email: 'profesor-alertas@escuela.demo', password: '123456' });
    tokenProfesor = loginProfesor.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('sin sesión, ni el alta ni el lado del destinatario funcionan', async () => {
    const alta = await request(app).post('/api/admin/alertas').send({ userIds: [alumnoId], mensaje: 'hola' });
    expect(alta.status).toBe(401);

    const pendiente = await request(app).get('/api/alertas/pendiente');
    expect(pendiente.status).toBe(401);
  });

  test('un alumno no puede usar los endpoints de admin', async () => {
    const res = await request(app)
      .post('/api/admin/alertas')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ userIds: [alumnoId], mensaje: 'hola' });
    expect(res.status).toBe(403);
  });

  test('valida destinatarios y mensaje', async () => {
    const sinDestinatarios = await request(app)
      .post('/api/admin/alertas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [], mensaje: 'hola' });
    expect(sinDestinatarios.status).toBe(400);

    const sinMensaje = await request(app)
      .post('/api/admin/alertas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [alumnoId], mensaje: '   ' });
    expect(sinMensaje.status).toBe(400);

    const destinatarioInexistente = await request(app)
      .post('/api/admin/alertas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [999999], mensaje: 'hola' });
    expect(destinatarioInexistente.status).toBe(400);
  });

  test('no se le puede mandar una alerta a otro admin (solo alumno/profesor)', async () => {
    const otroAdmin = await db('users').where({ email: 'admin-alertas@escuela.demo' }).first();
    const res = await request(app)
      .post('/api/admin/alertas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [otroAdmin.id], mensaje: 'hola' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/alumno.*profesor|profesor.*alumno/i);
  });

  test('el admin manda una alerta a un alumno y a un profesor a la vez, y queda en el historial de cada uno', async () => {
    const envio = await request(app)
      .post('/api/admin/alertas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [alumnoId, profesorId], mensaje: 'Recordatorio: mañana no hay clases' });
    expect(envio.status).toBe(201);

    const historial = await request(app).get('/api/admin/alertas').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(historial.status).toBe(200);
    const paraAlumno = historial.body.alertas.find((a) => a.user_id === alumnoId);
    const paraProfesor = historial.body.alertas.find((a) => a.user_id === profesorId);
    expect(paraAlumno.mensaje).toBe('Recordatorio: mañana no hay clases');
    expect(paraProfesor.mensaje).toBe('Recordatorio: mañana no hay clases');
    expect(paraAlumno.mostrado_en).toBeFalsy();
  });

  test('el alumno ve la alerta como pop-up la primera vez, y no de nuevo después', async () => {
    const primeraVez = await request(app).get('/api/alertas/pendiente').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(primeraVez.status).toBe(200);
    expect(primeraVez.body.alerta).toBeTruthy();
    expect(primeraVez.body.alerta.mensaje).toBe('Recordatorio: mañana no hay clases');

    const segundaVez = await request(app).get('/api/alertas/pendiente').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(segundaVez.status).toBe(200);
    expect(segundaVez.body.alerta).toBeNull();
  });

  test('aunque ya no aparezca como pop-up, sigue visible en "mis alertas"', async () => {
    const res = await request(app).get('/api/alertas/mias').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.alertas).toHaveLength(1);
    expect(res.body.alertas[0].mensaje).toBe('Recordatorio: mañana no hay clases');
  });

  test('un alumno nunca ve alertas de otro (ni en pendiente ni en mias)', async () => {
    const pendiente = await request(app).get('/api/alertas/pendiente').set('Authorization', `Bearer ${tokenOtroAlumno}`);
    expect(pendiente.body.alerta).toBeNull();

    const mias = await request(app).get('/api/alertas/mias').set('Authorization', `Bearer ${tokenOtroAlumno}`);
    expect(mias.body.alertas).toHaveLength(0);
  });

  test('dos alertas seguidas sin que el destinatario entre en el medio: se muestra la más reciente, pero las dos quedan marcadas y ambas siguen en el historial', async () => {
    await request(app).post('/api/admin/alertas').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [otroAlumnoId], mensaje: 'Primer aviso' });
    await request(app).post('/api/admin/alertas').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [otroAlumnoId], mensaje: 'Segundo aviso' });

    const pendiente = await request(app).get('/api/alertas/pendiente').set('Authorization', `Bearer ${tokenOtroAlumno}`);
    expect(pendiente.body.alerta.mensaje).toBe('Segundo aviso');

    const otraVez = await request(app).get('/api/alertas/pendiente').set('Authorization', `Bearer ${tokenOtroAlumno}`);
    expect(otraVez.body.alerta).toBeNull();

    const mias = await request(app).get('/api/alertas/mias').set('Authorization', `Bearer ${tokenOtroAlumno}`);
    expect(mias.body.alertas).toHaveLength(2);
  });

  test('"Recibido": el destinatario acusa recibo y el admin lo ve; otro usuario no puede marcarla', async () => {
    const mias = await request(app).get('/api/alertas/mias').set('Authorization', `Bearer ${tokenAlumno}`);
    const alertaId = mias.body.alertas[0].id;

    const ajeno = await request(app).post(`/api/alertas/${alertaId}/recibido`).set('Authorization', `Bearer ${tokenOtroAlumno}`);
    expect(ajeno.status).toBe(404);

    const antes = await request(app).get('/api/alertas/contador').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(antes.body.sinRecibir).toBe(1);

    const ok = await request(app).post(`/api/alertas/${alertaId}/recibido`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(ok.status).toBe(200);

    const despues = await request(app).get('/api/alertas/contador').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(despues.body.sinRecibir).toBe(0);

    const historial = await request(app).get('/api/admin/alertas').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(historial.body.alertas.find((a) => a.id === alertaId).recibido_en).toBeTruthy();
  });

  test('un profesor también puede ver sus propias alertas pendientes/históricas', async () => {
    const pendiente = await request(app).get('/api/alertas/pendiente').set('Authorization', `Bearer ${tokenProfesor}`);
    expect(pendiente.body.alerta.mensaje).toBe('Recordatorio: mañana no hay clases');

    const mias = await request(app).get('/api/alertas/mias').set('Authorization', `Bearer ${tokenProfesor}`);
    expect(mias.body.alertas).toHaveLength(1);
  });
});
