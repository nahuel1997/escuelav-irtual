process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-courses.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-courses.sqlite3');

describe('Cursos / tienda / inscripción', () => {
  let app;
  let db;
  let tokenProfesor;
  let tokenAlumno;
  let tokenAdmin;
  let cursoId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    // Necesitamos al menos el logro "primer_curso" para probar el otorgado
    // automático al inscribirse.
    await db('achievements').insert({ codigo: 'primer_curso', titulo: 'Primeros pasos', descripcion: '', icono: '🚀' });

    app = require('../src/app');

    // El registro público ya no permite elegir rol (siempre crea alumno);
    // las cuentas de profesor las crea un admin. Para el test insertamos
    // el profesor directo en la base, como haría el seed real.
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const hash = await bcrypt.hash('123456', 10);
    const [profesorId] = await db('users').insert({
      nombre: 'Profe', apellido: 'Uno', email: 'profe@escuela.demo', password_hash: hash, rol: 'profesor',
    });
    tokenProfesor = jwt.sign({ id: profesorId, email: 'profe@escuela.demo', rol: 'profesor', nombre: 'Profe' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Uno', email: 'alumno@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;

    await db('users').insert({ nombre: 'Admin', apellido: 'Uno', email: 'admin-courses@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin-courses@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('un alumno no puede crear cursos', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ titulo: 'Curso trucho', descripcion: 'x' });
    expect(res.status).toBe(403);
  });

  test('un profesor puede crear un curso', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ titulo: 'JavaScript desde cero', descripcion: 'Curso introductorio', precio: 10000, categoria: 'Programación' });
    expect(res.status).toBe(201);
    expect(res.body.course.titulo).toBe('JavaScript desde cero');
    cursoId = res.body.course.id;
  });

  test('el catálogo público lista el curso sin necesidad de login', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(200);
    expect(res.body.courses.length).toBeGreaterThanOrEqual(1);
  });

  test('un alumno puede inscribirse (compra simulada) y recibe el logro de primer curso', async () => {
    const res = await request(app)
      .post(`/api/courses/${cursoId}/enroll`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(201);
    expect(res.body.transactionId).toMatch(/^SIM-/);

    const misCursos = await request(app).get('/api/courses/mine').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(misCursos.body.courses.length).toBe(1);

    const misLogros = await request(app).get('/api/achievements/mine').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(misLogros.body.achievements.some((a) => a.codigo === 'primer_curso')).toBe(true);
  });

  test('no se puede inscribir dos veces al mismo curso', async () => {
    const res = await request(app)
      .post(`/api/courses/${cursoId}/enroll`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(409);
  });

  test('la lista de categorías fijas está disponible sin login', async () => {
    const res = await request(app).get('/api/courses/categories');
    expect(res.status).toBe(200);
    expect(res.body.categorias).toContain('Programación');
  });

  test('estado del curso: valores inválidos se rechazan', async () => {
    const res = await request(app)
      .put(`/api/admin/courses/${cursoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'no_existe' });
    expect(res.status).toBe(400);
  });

  test('estado "en_revision": desaparece de la tienda pública y no se puede comprar', async () => {
    const otro = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ titulo: 'Curso en revisión', descripcion: 'x', precio: 5000 });
    const cursoRevisionId = otro.body.course.id;

    await request(app)
      .put(`/api/admin/courses/${cursoRevisionId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'en_revision' })
      .expect(200);

    const catalogo = await request(app).get('/api/courses');
    expect(catalogo.body.courses.some((c) => c.id === cursoRevisionId)).toBe(false);

    const compra = await request(app)
      .post(`/api/courses/${cursoRevisionId}/enroll`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(compra.status).toBe(400);

    // Pero el profesor dueño lo sigue viendo en /courses/teaching aunque no
    // esté "subido" — es su curso, lo sigue gestionando.
    const propios = await request(app)
      .get('/api/courses/teaching')
      .set('Authorization', `Bearer ${tokenProfesor}`);
    expect(propios.body.courses.some((c) => c.id === cursoRevisionId)).toBe(true);
  });

  test('estado "cancelado": no se puede comprar, pero un alumno que ya lo tenía sigue con acceso al classroom', async () => {
    const cursoCancelId = (await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ titulo: 'Curso a cancelar', descripcion: 'x', precio: 3000 })).body.course.id;

    await request(app)
      .post(`/api/courses/${cursoCancelId}/enroll`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(201);

    await request(app)
      .put(`/api/admin/courses/${cursoCancelId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'cancelado' })
      .expect(200);

    const otroAlumno = await request(app).post('/api/auth/register').send({
      nombre: 'Otro', apellido: 'Alumno', email: 'otro-alumno-cancel@escuela.demo', password: '123456',
    });
    const compraNueva = await request(app)
      .post(`/api/courses/${cursoCancelId}/enroll`)
      .set('Authorization', `Bearer ${otroAlumno.body.token}`);
    expect(compraNueva.status).toBe(400);

    const misCursos = await request(app).get('/api/courses/mine').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(misCursos.body.courses.some((c) => c.id === cursoCancelId)).toBe(true);

    const classroom = await request(app)
      .get(`/api/classroom/courses/${cursoCancelId}/curriculum`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(classroom.status).toBe(200);
  });

  test('estado "fuera_sistema": ni el alumno que ya lo había comprado lo ve más', async () => {
    const cursoFueraId = (await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ titulo: 'Curso a archivar', descripcion: 'x', precio: 2000 })).body.course.id;

    await request(app)
      .post(`/api/courses/${cursoFueraId}/enroll`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(201);

    await request(app)
      .put(`/api/admin/courses/${cursoFueraId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'fuera_sistema' })
      .expect(200);

    const misCursos = await request(app).get('/api/courses/mine').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(misCursos.body.courses.some((c) => c.id === cursoFueraId)).toBe(false);

    const classroom = await request(app)
      .get(`/api/classroom/courses/${cursoFueraId}/curriculum`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(classroom.status).toBe(403);

    // El profesor dueño sigue pudiendo entrar (para poder reactivarlo).
    const comoProfe = await request(app)
      .get(`/api/classroom/courses/${cursoFueraId}/curriculum`)
      .set('Authorization', `Bearer ${tokenProfesor}`);
    expect(comoProfe.status).toBe(200);
  });
});
