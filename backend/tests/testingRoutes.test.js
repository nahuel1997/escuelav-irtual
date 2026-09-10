// Cubre GET /api/admin/testing/suites (permisos y forma de la respuesta).
// A propósito NO probamos acá POST /api/admin/testing/run/:id: ese
// endpoint dispara un `npx jest` como proceso hijo (ver
// testing.controller.js), y correr Jest desde ADENTRO de un test de Jest
// (proceso anidado, con su propio --json de por medio) es frágil y lento
// para lo que aporta. Ese endpoint se verifica manualmente desde el botón
// "Correr" en /admin-panel/testing, contra la propia suite real.
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-testing-routes.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-testing-routes.sqlite3');

describe('Rutas de /api/admin/testing', () => {
  let app;
  let db;
  let tokenAdmin;
  let tokenAlumno;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'Test', email: 'admin@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Test', email: 'alumno@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('sin token, listar suites devuelve 401', async () => {
    const res = await request(app).get('/api/admin/testing/suites');
    expect(res.status).toBe(401);
  });

  test('un alumno no puede listar suites (403)', async () => {
    const res = await request(app).get('/api/admin/testing/suites').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('un admin lista las suites disponibles', async () => {
    const res = await request(app).get('/api/admin/testing/suites').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suites)).toBe(true);
    expect(res.body.suites.length).toBeGreaterThan(0);
    const ids = res.body.suites.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['auth', 'admin', 'courses', 'calendar', 'backoffice', 'rateLimit']));
  });

  test('correr una suite desconocida devuelve 404', async () => {
    const res = await request(app).post('/api/admin/testing/run/no-existe').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(404);
  });
});
