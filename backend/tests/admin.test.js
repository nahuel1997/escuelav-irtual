process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-admin.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-admin.sqlite3');

describe('Panel de administración', () => {
  let app;
  let db;
  let tokenAdmin;
  let tokenAlumno;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    await db('achievements').insert([
      { codigo: 'primer_curso', titulo: 'Primeros pasos', descripcion: '', icono: '🚀' },
      { codigo: 'curso_completado', titulo: 'Curso completado', descripcion: '', icono: '🎓' },
    ]);

    app = require('../src/app');

    // El admin no se auto-registra: lo insertamos directo como se hace en
    // el seed real.
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

  test('el registro público ignora el rol enviado y siempre crea un alumno', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Truco', apellido: 'Test', email: 'truco@escuela.demo', password: '123456', rol: 'profesor',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.rol).toBe('alumno');
  });

  test('un alumno no puede acceder a /api/admin/*', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('sin token, /api/admin/* devuelve 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  let profesorId;

  test('el admin puede crear un profesor', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Nueva', apellido: 'Profe', email: 'nuevaprofe@escuela.demo', password: '123456', rol: 'profesor' });
    expect(res.status).toBe(201);
    expect(res.body.user.rol).toBe('profesor');
    profesorId = res.body.user.id;
  });

  let cursoId;

  test('el admin puede crear un curso asignándole un profesor', async () => {
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'Curso de prueba', descripcion: 'desc', precio: 5000, profesor_id: profesorId });
    expect(res.status).toBe(201);
    cursoId = res.body.course.id;
  });

  test('el admin puede editar el curso', async () => {
    const res = await request(app)
      .put(`/api/admin/courses/${cursoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'Curso editado' });
    expect(res.status).toBe(200);
    expect(res.body.course.titulo).toBe('Curso editado');
  });

  test('el admin puede editar contenido del sitio y se refleja en /api/content público', async () => {
    const put = await request(app)
      .put('/api/admin/content/home.hero.titulo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: 'texto', valor: 'Nuevo título de prueba' });
    expect(put.status).toBe(200);

    const publico = await request(app).get('/api/content');
    expect(publico.status).toBe(200);
    expect(publico.body.content['home.hero.titulo']).toBe('Nuevo título de prueba');
  });

  test('el admin puede editar el email de un usuario', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${profesorId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: 'profe-editado@escuela.demo' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('profe-editado@escuela.demo');
  });

  test('el admin no puede editar un usuario con un email ya usado por otra cuenta', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${profesorId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: 'admin@escuela.demo' });
    expect(res.status).toBe(409);
  });

  test('el admin puede resetear la contraseña de un usuario, y esto cierra sus sesiones abiertas', async () => {
    const loginProfe = await request(app)
      .post('/api/auth/login')
      .send({ email: 'profe-editado@escuela.demo', password: '123456' });
    expect(loginProfe.status).toBe(200);
    const tokenProfeViejo = loginProfe.body.token;

    // Antes de resetear, el token todavía sirve.
    const antes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenProfeViejo}`);
    expect(antes.status).toBe(200);

    const reset = await request(app)
      .put(`/api/admin/users/${profesorId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ password: 'nuevaClave123' });
    expect(reset.status).toBe(200);

    // La sesión vieja quedó revocada por el reset — el mismo token ahora rebota.
    const despues = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenProfeViejo}`);
    expect(despues.status).toBe(401);

    // La contraseña nueva funciona.
    const loginNuevo = await request(app)
      .post('/api/auth/login')
      .send({ email: 'profe-editado@escuela.demo', password: 'nuevaClave123' });
    expect(loginNuevo.status).toBe(200);
  });

  test('un alumno no puede editar usuarios', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${profesorId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ email: 'lo-que-sea@escuela.demo' });
    expect(res.status).toBe(403);
  });

  test('el historial de logins trae ip/país/provincia y el admin puede cerrar una sesión abierta', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'alumno@escuela.demo', password: '123456' });
    expect(login.status).toBe(200);
    const tokenSesion = login.body.token;

    const logins = await request(app).get('/api/admin/logins').set('Authorization', `Bearer ${tokenAdmin}`);
    // No filtramos por userId acá (no lo tenemos a mano todavía) — solo
    // confirmamos que la fila trae las columnas nuevas.
    expect(logins.status).toBe(200);
    const fila = logins.body.logins.find((l) => l.email === 'alumno@escuela.demo' && !l.logout_at && !l.revoked_at);
    expect(fila).toBeDefined();
    expect(fila).toHaveProperty('ip');
    expect(fila).toHaveProperty('pais');
    expect(fila).toHaveProperty('provincia');

    const cerrar = await request(app)
      .post(`/api/admin/logins/${fila.id}/cerrar`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(cerrar.status).toBe(200);
    expect(cerrar.body.sesion.revoked_at).toBeTruthy();

    // El token de esa sesión puntual queda inválido de inmediato.
    const meDespues = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenSesion}`);
    expect(meDespues.status).toBe(401);
  });

  test('dashboard trae las métricas esperadas', async () => {
    // inscribimos al alumno y marcamos el curso como completado
    await request(app).post(`/api/courses/${cursoId}/enroll`).set('Authorization', `Bearer ${tokenAlumno}`);

    const meAlumno = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenAlumno}`);
    const alumnoId = meAlumno.body.user.id;

    const completar = await request(app)
      .put(`/api/classroom/courses/${cursoId}/students/${alumnoId}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(completar.status).toBe(200);

    const dash = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(dash.status).toBe(200);
    expect(dash.body.cursosVendidos).toBeGreaterThanOrEqual(1);
    expect(dash.body.cursosCompletados).toBeGreaterThanOrEqual(1);
    expect(dash.body.profesores.some((p) => p.id === profesorId)).toBe(true);
  });
});
