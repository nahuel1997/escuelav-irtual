// Estas 4 líneas tienen que ir antes de cualquier require de la app: fuerzan
// que se use una base sqlite descartable para tests, separada de la de
// desarrollo (data/escuela.sqlite3).
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-auth.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-auth.sqlite3');

describe('Autenticación', () => {
  let app;
  let db;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    // Seedea las plantillas de mail (verificacion_cuenta, bienvenida) para
    // que el flujo de validación de cuenta mande algo real en vez de un
    // no-op por plantilla inexistente — ver src/db/seeds/002_email_templates.js.
    await require('../src/db/seeds/002_email_templates').seed(db);
    app = require('../src/app');
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('registra un usuario nuevo y devuelve token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Test',
      apellido: 'User',
      email: 'test1@escuela.demo',
      password: '123456',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test1@escuela.demo');
    expect(res.body.user.password_hash).toBeUndefined();
    // La cuenta arranca sin validar — el código de 6 dígitos es un paso
    // aparte que no bloquea el registro/login (ver auth.controller.js).
    expect(res.body.user.email_verificado).toBe(false);
  });

  test('rechaza un registro con email duplicado', async () => {
    await request(app).post('/api/auth/register').send({
      nombre: 'Dup', apellido: 'Uno', email: 'dup@escuela.demo', password: '123456',
    });
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Dup', apellido: 'Dos', email: 'dup@escuela.demo', password: '123456',
    });
    expect(res.status).toBe(409);
  });

  test('login con credenciales correctas devuelve token', async () => {
    await request(app).post('/api/auth/register').send({
      nombre: 'Login', apellido: 'Test', email: 'login@escuela.demo', password: 'secreta123',
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@escuela.demo', password: 'secreta123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  // Mensaje y status unificados a propósito (ver comentario en
  // auth.controller.js): que la cuenta no exista y que la contraseña sea
  // incorrecta tienen que dar exactamente la misma respuesta, para no
  // permitir enumerar emails registrados probando logins.
  test('login con password incorrecta devuelve 401 con mensaje genérico', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@escuela.demo', password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/email o contraseña/i);
  });

  test('login con un email que no existe devuelve el mismo 401 genérico (no permite enumerar emails)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@escuela.demo', password: 'cualquiera' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/email o contraseña/i);
  });

  test('registro con email ya usado sugiere iniciar sesión en vez de solo decir "duplicado"', async () => {
    await request(app).post('/api/auth/register').send({
      nombre: 'Dup2', apellido: 'Uno', email: 'dup2@escuela.demo', password: '123456',
    });
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Dup2', apellido: 'Dos', email: 'dup2@escuela.demo', password: '123456',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/iniciar sesión/i);
  });

  test('/api/auth/me sin token devuelve 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('/api/auth/me con token válido devuelve el usuario', async () => {
    const registro = await request(app).post('/api/auth/register').send({
      nombre: 'Me', apellido: 'Test', email: 'me@escuela.demo', password: '123456',
    });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${registro.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@escuela.demo');
  });

  // --- Sesiones (jti): logout cierra SOLO la sesión que lo llamó ---

  describe('sesiones', () => {
    test('cerrar sesión en un dispositivo no afecta la sesión abierta en otro', async () => {
      await request(app).post('/api/auth/register').send({
        nombre: 'Multi', apellido: 'Device', email: 'multidevice@escuela.demo', password: '123456',
      });
      const dispositivoA = await request(app).post('/api/auth/login').send({
        email: 'multidevice@escuela.demo', password: '123456',
      });
      const dispositivoB = await request(app).post('/api/auth/login').send({
        email: 'multidevice@escuela.demo', password: '123456',
      });
      expect(dispositivoA.body.token).not.toBe(dispositivoB.body.token);

      const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${dispositivoA.body.token}`);
      expect(logout.status).toBe(200);

      // A quedó cerrada...
      const meA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${dispositivoA.body.token}`);
      expect(meA.status).toBe(401);

      // ...pero B (otro dispositivo, mismo usuario) sigue funcionando.
      const meB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${dispositivoB.body.token}`);
      expect(meB.status).toBe(200);
    });
  });

  // --- Validación de cuenta por código de 6 dígitos ---

  describe('validación de cuenta', () => {
    let token;
    let userId;

    beforeAll(async () => {
      const registro = await request(app).post('/api/auth/register').send({
        nombre: 'Verifica', apellido: 'Test', email: 'verifica@escuela.demo', password: '123456',
      });
      token = registro.body.token;
      userId = registro.body.user.id;
    });

    test('un código incorrecto es rechazado', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ codigo: '000000' });
      expect(res.status).toBe(400);
    });

    test('el código real (leído de la base) valida la cuenta y manda el mail de bienvenida', async () => {
      const fila = await db('email_verifications').where({ user_id: userId }).orderBy('created_at', 'desc').first();
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ codigo: fila.codigo });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(me.body.user.email_verificado).toBe(true);
    }, 20000);

    test('verificar de nuevo una cuenta ya validada no rompe nada', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ codigo: '000000' });
      expect(res.status).toBe(200);
      expect(res.body.yaEstabaVerificado).toBe(true);
    });

    test('resend-verification manda un código nuevo para una cuenta sin validar', async () => {
      const registro = await request(app).post('/api/auth/register').send({
        nombre: 'Reenvio', apellido: 'Test', email: 'reenvio@escuela.demo', password: '123456',
      });
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${registro.body.token}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    }, 20000);
  });
});
