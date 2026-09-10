process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-apiclients.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-apiclients.sqlite3');

// API de datos para sistemas externos: el admin crea un usuario/
// contraseña (api_clients), le da permiso a leer columnas puntuales de
// una tabla (api_client_permisos), y ese acceso consume /api/data/:tabla
// con Basic Auth — nunca con el JWT de la app. Ver dataApi.controller.js,
// apiClients.controller.js y dataCatalog.service.js.
describe('API de datos para sistemas externos', () => {
  let app;
  let db;
  let tokenAdmin;

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

    // Datos de prueba en una tabla real para poder leerlos después vía la
    // API de datos (usamos "courses", que no tiene columnas bloqueadas).
    await db('courses').insert({ titulo: 'Curso A', descripcion: 'desc', precio: 1000, estado: 'subido' });
    await db('courses').insert({ titulo: 'Curso B', descripcion: 'desc', precio: 2000, estado: 'subido' });
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('un alumno no puede administrar accesos de la API', async () => {
    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'A', apellido: 'B', email: 'alumnoapi@escuela.demo', password: '123456',
    });
    const res = await request(app).get('/api/admin/api-clients').set('Authorization', `Bearer ${alumno.body.token}`);
    expect(res.status).toBe(403);
  });

  test('el catálogo de tablas nunca incluye password_hash como columna exponible', async () => {
    const res = await request(app).get('/api/admin/api-clients/catalogo').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    const users = res.body.catalogo.find((t) => t.tabla === 'users');
    expect(users.columnas).not.toContain('password_hash');
    // Las tablas internas de la API misma tampoco se ofrecen para evitar
    // un acceso que se autoconceda permisos sobre sí mismo.
    expect(res.body.catalogo.some((t) => t.tabla === 'api_clients')).toBe(false);
  });

  let clientId;
  let passwordPlano;

  test('el admin crea un acceso y recibe la contraseña en texto plano una sola vez', async () => {
    const res = await request(app)
      .post('/api/admin/api-clients')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ username: 'sistema-externo', descripcion: 'Para pruebas' });
    expect(res.status).toBe(201);
    expect(res.body.password).toBeDefined();
    expect(res.body.client.username).toBe('sistema-externo');
    clientId = res.body.client.id;
    passwordPlano = res.body.password;
  });

  test('sin ningún permiso todavía, la API de datos rechaza con 403', async () => {
    const auth = Buffer.from(`sistema-externo:${passwordPlano}`).toString('base64');
    const res = await request(app).get('/api/data/courses').set('Authorization', `Basic ${auth}`);
    expect(res.status).toBe(403);
  });

  test('el admin le da acceso a "courses" con columnas puntuales', async () => {
    const res = await request(app)
      .put(`/api/admin/api-clients/${clientId}/permisos/courses`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ columnas: ['id', 'titulo', 'precio'] });
    expect(res.status).toBe(200);
    expect(res.body.permiso.columnas.sort()).toEqual(['id', 'precio', 'titulo']);
  });

  test('con el permiso otorgado, la API de datos devuelve SOLO esas columnas', async () => {
    const auth = Buffer.from(`sistema-externo:${passwordPlano}`).toString('base64');
    const res = await request(app).get('/api/data/courses').set('Authorization', `Basic ${auth}`);
    expect(res.status).toBe(200);
    expect(res.body.columnas.sort()).toEqual(['id', 'precio', 'titulo']);
    expect(res.body.filas.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(res.body.filas[0]).sort()).toEqual(['id', 'precio', 'titulo']);
    // descripcion no se pidió permiso para verla.
    expect(res.body.filas[0].descripcion).toBeUndefined();
  });

  test('con usuario o contraseña incorrectos, la API de datos devuelve 401', async () => {
    const auth = Buffer.from('sistema-externo:cualquier-cosa').toString('base64');
    const res = await request(app).get('/api/data/courses').set('Authorization', `Basic ${auth}`);
    expect(res.status).toBe(401);
  });

  test('sin acceso a la tabla pedida, la API de datos devuelve 403', async () => {
    const auth = Buffer.from(`sistema-externo:${passwordPlano}`).toString('base64');
    const res = await request(app).get('/api/data/users').set('Authorization', `Basic ${auth}`);
    expect(res.status).toBe(403);
  });

  test('cada consulta real queda en el registro de uso con IP y duración', async () => {
    const uso = await request(app).get(`/api/admin/api-clients/${clientId}/uso`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(uso.status).toBe(200);
    expect(uso.body.uso.length).toBeGreaterThanOrEqual(1);
    expect(uso.body.uso[0]).toHaveProperty('ip');
    expect(uso.body.uso[0]).toHaveProperty('duracion_ms');
    expect(uso.body.uso[0].tabla).toBe('courses');
  });

  test('desactivar el acceso hace que la API de datos empiece a rechazarlo', async () => {
    const desactivar = await request(app)
      .put(`/api/admin/api-clients/${clientId}/activo`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ activo: false });
    expect(desactivar.status).toBe(200);

    const auth = Buffer.from(`sistema-externo:${passwordPlano}`).toString('base64');
    const res = await request(app).get('/api/data/courses').set('Authorization', `Basic ${auth}`);
    expect(res.status).toBe(403);
  });

  test('regenerar la contraseña invalida la anterior', async () => {
    await request(app).put(`/api/admin/api-clients/${clientId}/activo`).set('Authorization', `Bearer ${tokenAdmin}`).send({ activo: true });

    const regenerar = await request(app)
      .post(`/api/admin/api-clients/${clientId}/regenerar`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(regenerar.status).toBe(200);
    const nuevaPassword = regenerar.body.password;
    expect(nuevaPassword).not.toBe(passwordPlano);

    const authVieja = Buffer.from(`sistema-externo:${passwordPlano}`).toString('base64');
    const rechazado = await request(app).get('/api/data/courses').set('Authorization', `Basic ${authVieja}`);
    expect(rechazado.status).toBe(401);

    const authNueva = Buffer.from(`sistema-externo:${nuevaPassword}`).toString('base64');
    const aceptado = await request(app).get('/api/data/courses').set('Authorization', `Basic ${authNueva}`);
    expect(aceptado.status).toBe(200);
  });

  describe('Borrar un acceso (DELETE /api/admin/api-clients/:id)', () => {
    test('un alumno no puede borrar un acceso', async () => {
      const alumno = await request(app).post('/api/auth/register').send({
        nombre: 'C', apellido: 'D', email: 'alumnoapi2@escuela.demo', password: '123456',
      });
      const res = await request(app)
        .delete(`/api/admin/api-clients/${clientId}`)
        .set('Authorization', `Bearer ${alumno.body.token}`);
      expect(res.status).toBe(403);

      const sigueExistiendo = await db('api_clients').where({ id: clientId }).first();
      expect(sigueExistiendo).toBeDefined();
    });

    test('un id inexistente da 404', async () => {
      const res = await request(app)
        .delete('/api/admin/api-clients/999999')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(404);
    });

    test('el admin borra el acceso, y se lleva puestos sus permisos y su registro de uso', async () => {
      // clientId ya tiene, de los tests anteriores, un permiso sobre
      // "courses" (setPermiso) y al menos una fila en api_usage_log (la
      // consulta real que hizo la API de datos más arriba) — el borrado
      // tiene que limpiar las tres tablas, no dejar huérfanos.
      const permisosAntes = await db('api_client_permisos').where({ client_id: clientId });
      const usoAntes = await db('api_usage_log').where({ client_id: clientId });
      expect(permisosAntes.length).toBeGreaterThan(0);
      expect(usoAntes.length).toBeGreaterThan(0);

      const res = await request(app)
        .delete(`/api/admin/api-clients/${clientId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(200);

      const cliente = await db('api_clients').where({ id: clientId }).first();
      expect(cliente).toBeUndefined();
      const permisosDespues = await db('api_client_permisos').where({ client_id: clientId });
      expect(permisosDespues.length).toBe(0);
      const usoDespues = await db('api_usage_log').where({ client_id: clientId });
      expect(usoDespues.length).toBe(0);

      const lista = await request(app).get('/api/admin/api-clients').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(lista.body.clients.some((c) => c.id === clientId)).toBe(false);
    });
  });
});
