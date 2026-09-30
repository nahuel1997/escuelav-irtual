process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-apiseguridad.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-apiseguridad.sqlite3');

function basic(usuario, password) {
  return `Basic ${Buffer.from(`${usuario}:${password}`).toString('base64')}`;
}

// Seguridad de la API de datos: bloqueos por IP/usuario, fuerza bruta
// escalonada y mensajes de error editables (ver apiClientAuth.middleware.js).
describe('Seguridad de la API de datos', () => {
  let app;
  let db;
  let tokenAdmin;
  let passwordCliente;
  let ipReal;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'Test', email: 'admin-apiseg@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin-apiseg@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;
    ipReal = (await db('login_logs').orderBy('id', 'desc').first()).ip;

    await db('courses').insert({ titulo: 'Curso A', descripcion: 'desc', precio: 1000, estado: 'subido' });
    const alta = await request(app).post('/api/admin/api-clients').set('Authorization', `Bearer ${tokenAdmin}`).send({ username: 'sistema-x' });
    passwordCliente = alta.body.password;
    await request(app)
      .put(`/api/admin/api-clients/${alta.body.client.id}/permisos/courses`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ columnas: ['id', 'titulo'] });
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  afterEach(async () => {
    await db('api_bloqueados').del();
    await db('api_bruteforce').del();
  });

  test('las credenciales buenas funcionan', async () => {
    const res = await request(app).get('/api/data/courses').set('Authorization', basic('sistema-x', passwordCliente));
    expect(res.status).toBe(200);
  });

  test('bloquear el usuario de API corta el acceso aunque la contraseña sea buena', async () => {
    const b = await request(app).post('/api/admin/api-clients/bloqueados').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: 'usuario', valor: 'sistema-x', motivo: 'prueba' });
    expect(b.status).toBe(201);
    const res = await request(app).get('/api/data/courses').set('Authorization', basic('sistema-x', passwordCliente));
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('BLOQUEADO');

    const lista = await request(app).get('/api/admin/api-clients/bloqueados').set('Authorization', `Bearer ${tokenAdmin}`);
    await request(app).delete(`/api/admin/api-clients/bloqueados/${lista.body.bloqueados[0].id}`).set('Authorization', `Bearer ${tokenAdmin}`);
    const otraVez = await request(app).get('/api/data/courses').set('Authorization', basic('sistema-x', passwordCliente));
    expect(otraVez.status).toBe(200);
  });

  test('valida IP y motivo al bloquear', async () => {
    const malaIp = await request(app).post('/api/admin/api-clients/bloqueados').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: 'ip', valor: 'no-es-ip', motivo: 'x' });
    expect(malaIp.status).toBe(400);
    const sinMotivo = await request(app).post('/api/admin/api-clients/bloqueados').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: 'ip', valor: '203.0.113.7', motivo: '' });
    expect(sinMotivo.status).toBe(400);
  });

  test('fuerza bruta: a los 10 fallos arranca la espera (429), incluso con la contraseña buena', async () => {
    for (let i = 0; i < 9; i += 1) {
      const r = await request(app).get('/api/data/courses').set('Authorization', basic('sistema-x', 'mala'));
      expect(r.status).toBe(401);
    }
    const decimo = await request(app).get('/api/data/courses').set('Authorization', basic('sistema-x', 'mala'));
    expect(decimo.status).toBe(429);
    const conBuena = await request(app).get('/api/data/courses').set('Authorization', basic('sistema-x', passwordCliente));
    expect(conBuena.status).toBe(429);
    expect(conBuena.body.error).toMatch(/esperá/i);
  });

  test('fuerza bruta: pasada la etapa 2, el próximo fallo bloquea la IP (nunca el usuario)', async () => {
    const clave = `${ipReal}|sistema-x`;
    await db('api_bruteforce').insert({ clave, fallos: 0, etapa: 2, bloqueado_hasta: null });
    const r = await request(app).get('/api/data/courses').set('Authorization', basic('sistema-x', 'mala'));
    expect(r.status).toBe(401);
    const bloqueos = await db('api_bloqueados').select('*');
    expect(bloqueos).toHaveLength(1);
    expect(bloqueos[0].tipo).toBe('ip');
  });

  test('los mensajes de error se editan desde el panel y la API los usa', async () => {
    const lista = await request(app).get('/api/admin/api-clients/errores').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(lista.body.errores.some((e) => e.codigo === 'CREDENCIALES_INVALIDAS')).toBe(true);

    const vacio = await request(app).put('/api/admin/api-clients/errores/CREDENCIALES_INVALIDAS').set('Authorization', `Bearer ${tokenAdmin}`).send({ mensaje: '  ' });
    expect(vacio.status).toBe(400);

    const ok = await request(app).put('/api/admin/api-clients/errores/CREDENCIALES_INVALIDAS').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ mensaje: 'Credenciales rechazadas por la escuela' });
    expect(ok.status).toBe(200);

    const r = await request(app).get('/api/data/courses').set('Authorization', basic('sistema-x', 'mala'));
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Credenciales rechazadas por la escuela');
    expect(r.body.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  test('las tablas de seguridad nunca aparecen en el catálogo exponible', async () => {
    const res = await request(app).get('/api/admin/api-clients/catalogo').set('Authorization', `Bearer ${tokenAdmin}`);
    const tablas = res.body.catalogo.map((t) => t.tabla);
    ['api_bloqueados', 'api_bruteforce', 'api_errores', 'login_eventos', 'ips_bloqueadas'].forEach((t) => expect(tablas).not.toContain(t));
  });
});
