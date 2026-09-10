process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-backoffice.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-backoffice.sqlite3');

describe('Backoffice: links, botones, errores y registro de logins', () => {
  let app;
  let db;
  let tokenAdmin;
  let tokenAlumno;
  let alumnoId;

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

    const registro = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Test', email: 'alumno@escuela.demo', password: '123456',
    });
    tokenAlumno = registro.body.token;
    alumnoId = registro.body.user.id;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  // --- Links de menú/footer ---

  let linkId;

  test('el admin crea un link de menú', async () => {
    const res = await request(app)
      .post('/api/admin/nav-links')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ubicacion: 'menu', texto: 'Blog', url: 'https://blog.escuela.demo' });
    expect(res.status).toBe(201);
    expect(res.body.link.texto).toBe('Blog');
    linkId = res.body.link.id;
  });

  test('rechaza una ubicación inválida', async () => {
    const res = await request(app)
      .post('/api/admin/nav-links')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ubicacion: 'sidebar', texto: 'X', url: '/x' });
    expect(res.status).toBe(400);
  });

  test('el link creado aparece en el contenido público (GET /api/content)', async () => {
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body.navLinks.some((l) => l.id === linkId)).toBe(true);
  });

  test('el admin edita y luego borra el link', async () => {
    const editar = await request(app)
      .put(`/api/admin/nav-links/${linkId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ texto: 'Blog editado' });
    expect(editar.status).toBe(200);
    expect(editar.body.link.texto).toBe('Blog editado');

    const borrar = await request(app).delete(`/api/admin/nav-links/${linkId}`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(borrar.status).toBe(200);
  });

  test('un alumno no puede administrar links', async () => {
    const res = await request(app)
      .post('/api/admin/nav-links')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ ubicacion: 'menu', texto: 'X', url: '/x' });
    expect(res.status).toBe(403);
  });

  // --- Registro de botones ---

  let botonId;

  test('el admin crea una "opción de botón" y el nombre se arma con el id', async () => {
    const res = await request(app)
      .post('/api/admin/botones')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ color_fondo: '#111111', color_texto: '#ffffff', link: '/tienda' });
    expect(res.status).toBe(201);
    botonId = res.body.opcion.id;
    expect(res.body.opcion.nombre).toBe(`Opción ${botonId}`);
  });

  test('la opción de botón aparece en /api/content junto con el resto', async () => {
    const res = await request(app).get('/api/content');
    expect(res.body.buttons.some((b) => b.id === botonId && b.nombre === `Opción ${botonId}`)).toBe(true);
  });

  test('el admin edita el color de la opción de botón', async () => {
    const res = await request(app)
      .put(`/api/admin/botones/${botonId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ color_fondo: '#222222' });
    expect(res.status).toBe(200);
    expect(res.body.opcion.color_fondo).toBe('#222222');
  });

  // --- tipo inválido en site_content ---

  test('rechaza un tipo de contenido inválido', async () => {
    const res = await request(app)
      .put('/api/admin/content/home.hero.titulo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: 'video', valor: 'x' });
    expect(res.status).toBe(400);
  });

  test('acepta el tipo "color" (nuevo)', async () => {
    const res = await request(app)
      .put('/api/admin/content/home.hero.color_fondo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: 'color', valor: '#fafafa' });
    expect(res.status).toBe(200);
  });

  // --- Errores del sistema ---

  test('un error 500 real queda registrado en /api/admin/errores', async () => {
    // No dependemos de encontrar un endpoint que rompa por accidente:
    // ejercitamos el errorHandler central directo, tal como lo llamaría
    // Express ante cualquier excepción sin manejar en cualquier controller
    // futuro. Es exactamente el mismo código que corre en producción.
    const { errorHandler } = require('../src/middlewares/error.middleware');
    const fakeReq = { originalUrl: '/api/algo-que-rompio', method: 'GET', user: { id: alumnoId } };
    const fakeRes = { status(s) { this._status = s; return this; }, json(body) { this._body = body; return this; } };
    errorHandler(new Error('Falla simulada de prueba'), fakeReq, fakeRes, () => {});
    // El insert es best-effort (no bloqueante): esperamos un tick para que
    // termine antes de consultar el registro.
    await new Promise((r) => setTimeout(r, 100));

    const res = await request(app).get('/api/admin/errores').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.errores.length).toBeGreaterThanOrEqual(1);
    expect(res.body.errores[0].status).toBeGreaterThanOrEqual(500);
    expect(res.body.errores[0].mensaje).toBe('Falla simulada de prueba');
  });

  test('un error 500 NUNCA le muestra al usuario el mensaje interno (solo un genérico)', async () => {
    // Este es justo el bug que vio un usuario real: un error de SQL (nombre
    // de tabla, columnas) se mostraba tal cual en la pantalla de login. El
    // detalle interno solo debe llegar al log del servidor y a
    // /admin-panel/errores (cubierto por el test de arriba) — al cliente
    // le tiene que llegar un mensaje genérico y claro, sin filtrar nada.
    const { errorHandler } = require('../src/middlewares/error.middleware');
    const fakeReq = { originalUrl: '/api/otra-cosa-que-rompio', method: 'POST', user: null };
    const fakeRes = { status(s) { this._status = s; return this; }, json(body) { this._body = body; return this; } };
    errorHandler(new Error("insert into `login_logs` (...) - no such table: login_logs"), fakeReq, fakeRes, () => {});

    expect(fakeRes._status).toBe(500);
    expect(fakeRes._body.error).not.toMatch(/login_logs|insert into|no such table/i);
    expect(fakeRes._body.error).toMatch(/error inesperado/i);
  });

  test('un alumno no puede ver los errores del sistema', async () => {
    const res = await request(app).get('/api/admin/errores').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('el registro de errores se pagina de a 20', async () => {
    // Ya hay al menos 1 error de un test anterior — completamos hasta
    // tener de sobra para una segunda página.
    const filas = Array.from({ length: 25 }, (_, i) => ({
      status: 500, mensaje: `Error de prueba ${i}`, ruta: '/api/x', metodo: 'GET',
    }));
    await db('error_logs').insert(filas);

    const pagina1 = await request(app).get('/api/admin/errores').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(pagina1.status).toBe(200);
    expect(pagina1.body.errores.length).toBe(20);
    expect(pagina1.body.page).toBe(1);
    expect(pagina1.body.total).toBeGreaterThanOrEqual(26);
    expect(pagina1.body.totalPages).toBeGreaterThanOrEqual(2);

    const pagina2 = await request(app).get('/api/admin/errores?page=2').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(pagina2.status).toBe(200);
    expect(pagina2.body.page).toBe(2);
    expect(pagina2.body.errores.length).toBeGreaterThanOrEqual(1);
    // No se repiten filas entre páginas.
    const idsPagina1 = pagina1.body.errores.map((e) => e.id);
    expect(pagina2.body.errores.every((e) => !idsPagina1.includes(e.id))).toBe(true);
  });

  test('un alumno no puede limpiar el registro de errores', async () => {
    const res = await request(app).delete('/api/admin/errores').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('el admin limpia el registro de errores', async () => {
    const antes = await request(app).get('/api/admin/errores').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(antes.body.total).toBeGreaterThan(0);

    const limpiar = await request(app).delete('/api/admin/errores').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(limpiar.status).toBe(200);

    const despues = await request(app).get('/api/admin/errores').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(despues.body.total).toBe(0);
    expect(despues.body.errores).toEqual([]);
  });

  // --- Registro de logins ---

  test('el registro y el login quedan asentados en login_logs, visibles para el admin', async () => {
    const res = await request(app).get('/api/admin/logins').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    const delAlumno = res.body.logins.filter((l) => l.user_id === alumnoId);
    expect(delAlumno.length).toBeGreaterThanOrEqual(1);
    expect(delAlumno[0].logout_at).toBeNull();
  });

  test('logout cierra la sesión abierta más reciente (queda con hora de fin)', async () => {
    const salir = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(salir.status).toBe(200);

    const res = await request(app).get(`/api/admin/logins?userId=${alumnoId}`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.logins[0].logout_at).not.toBeNull();
  });

  test('el filtro por usuario en /api/admin/logins funciona', async () => {
    const res = await request(app).get(`/api/admin/logins?userId=${alumnoId}`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.logins.every((l) => l.user_id === alumnoId)).toBe(true);
  });
});
