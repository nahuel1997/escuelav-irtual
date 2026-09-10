process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-cv-ai.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-cv-ai.sqlite3');

// idOf: knex .returning('id') a veces devuelve un array de ids crudos y a
// veces un array de filas {id: ...} según el driver — mismo criterio que
// tests/lti.test.js.
function idOf(row) {
  return typeof row === 'object' ? row.id : row;
}

describe('CV para IA (nivel, recomendaciones, plantillas)', () => {
  let app;
  let db;
  let tokenAdmin;
  let tokenAlumno;
  let profesorId;
  let cursoFundamentosId;
  let cursoAutomatizacionId;
  let cursoLtiId;

  const datosPersonales = { nombreCompleto: 'Ana Pérez', email: 'ana@escuela.demo', resumenProfesional: 'Backend dev' };

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();

    // Las plantillas de CV para IA no las crea el flujo normal de la app
    // (nacen del seed 003_cv_ai_templates.js) — como los tests no corren
    // el seed, se insertan acá con el mismo shape mínimo que necesita
    // templateEngine.js, para no depender de correr `npm run seed` antes
    // de testear.
    await db('cv_ai_templates').insert([
      {
        clave: 'chatgpt',
        nombre: 'ChatGPT',
        html: '<html><body><h1>{{nombreCompleto}}</h1><p>{{destino}}</p><div>{{nivelIAEtiqueta}} - {{nivelIADescripcion}}</div><div>{{cursosPlataformaHtml}}</div><div>{{recomendacionesHtml}}</div><div>{{resumenProfesional}}</div></body></html>',
        variables_disponibles: 'nombreCompleto,destino,nivelIAEtiqueta,nivelIADescripcion,cursosPlataformaHtml,recomendacionesHtml,resumenProfesional',
        activo: true,
      },
      {
        clave: 'claude',
        nombre: 'Claude',
        html: '<html><body><h1>{{nombreCompleto}} para Claude</h1></body></html>',
        variables_disponibles: 'nombreCompleto',
        activo: true,
      },
      {
        clave: 'gemini',
        nombre: 'Gemini',
        html: '<html><body><h1>{{nombreCompleto}} para Gemini</h1></body></html>',
        variables_disponibles: 'nombreCompleto',
        activo: false, // a propósito inactiva, para probar que no aparece en el catálogo
      },
    ]);

    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'CV', email: 'admin-cvai@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin-cvai@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;

    const [profRow] = await db('users').insert({ nombre: 'Profe', apellido: 'CV', email: 'profe-cvai@escuela.demo', password_hash: hash, rol: 'profesor' }).returning('id');
    profesorId = idOf(profRow);

    // Catálogo de cursos IA (categoría fija, ver config/categorias.js) —
    // 3 cursos, mismo criterio pedagógico que el seed real: fundamentos,
    // automatización, LMS.
    const [c1] = await db('courses').insert({ titulo: 'IA para la oficina: herramientas y fundamentos', descripcion: 'x', precio: 0, categoria: 'Inteligencia Artificial', profesor_id: profesorId }).returning('id');
    cursoFundamentosId = idOf(c1);
    const [c2] = await db('courses').insert({ titulo: 'Automatización de procesos de oficina con IA', descripcion: 'x', precio: 0, categoria: 'Inteligencia Artificial', profesor_id: profesorId }).returning('id');
    cursoAutomatizacionId = idOf(c2);
    const [c3] = await db('courses').insert({ titulo: 'Conectando la IA a tu LMS', descripcion: 'x', precio: 0, categoria: 'Inteligencia Artificial', profesor_id: profesorId }).returning('id');
    cursoLtiId = idOf(c3);
    // Un curso de otra categoría, para confirmar que no cuenta para el
    // nivel/recomendaciones de IA aunque el alumno lo complete.
    await db('courses').insert({ titulo: 'Curso de otra categoría', descripcion: 'x', precio: 0, categoria: 'Programación', profesor_id: profesorId });

    const registro = await request(app).post('/api/auth/register').send({
      nombre: 'Alumna', apellido: 'CV', email: 'alumna-cvai@escuela.demo', password: '123456',
    });
    tokenAlumno = registro.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('GET /cv/generadores-ia (sin login) solo trae las plantillas activas', async () => {
    const res = await request(app).get('/api/cv/generadores-ia');
    expect(res.status).toBe(200);
    const claves = res.body.generadores.map((g) => g.clave).sort();
    expect(claves).toEqual(['chatgpt', 'claude']); // gemini está inactiva
  });

  test('POST /cv/generar-ia sin destino da 400', async () => {
    const res = await request(app).post('/api/cv/generar-ia').send({ datosPersonales });
    expect(res.status).toBe(400);
  });

  test('POST /cv/generar-ia con destino inexistente da 404', async () => {
    const res = await request(app).post('/api/cv/generar-ia').send({ datosPersonales, destino: 'no-existe' });
    expect(res.status).toBe(404);
  });

  test('POST /cv/generar-ia con destino inactivo da 409', async () => {
    const res = await request(app).post('/api/cv/generar-ia').send({ datosPersonales, destino: 'gemini' });
    expect(res.status).toBe(409);
  });

  test('POST /cv/generar-ia anónimo: nivel inicial, recomendación genérica de arranque, y datos escapados', async () => {
    const res = await request(app)
      .post('/api/cv/generar-ia')
      .send({ datosPersonales: { ...datosPersonales, nombreCompleto: 'Ana <b>Pérez</b> & Cía' }, destino: 'chatgpt' });

    expect(res.status).toBe(200);
    expect(res.body.html).toContain('Ana &lt;b&gt;Pérez&lt;/b&gt; &amp; Cía');
    expect(res.body.html).not.toContain('<b>Pérez</b>'); // no se coló HTML sin escapar
    expect(res.body.html).toContain('Nivel inicial en IA aplicada a la oficina');
    // sin cursos completados, recomienda el primero del catálogo (orden pedagógico)
    expect(res.body.html).toContain('IA para la oficina: herramientas y fundamentos');
  });

  test('POST /cv/generar-ia con incluirCursosPlataforma sin login da 401', async () => {
    const res = await request(app)
      .post('/api/cv/generar-ia')
      .send({ datosPersonales, destino: 'chatgpt', incluirCursosPlataforma: true });
    expect(res.status).toBe(401);
  });

  test('logueada sin cursos completados: nivel inicial y recomienda los primeros 2 cursos IA', async () => {
    const res = await request(app)
      .post('/api/cv/generar-ia')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ datosPersonales, destino: 'chatgpt', incluirCursosPlataforma: true });

    expect(res.status).toBe(200);
    expect(res.body.html).toContain('Nivel inicial en IA aplicada a la oficina');
    expect(res.body.html).toContain('IA para la oficina: herramientas y fundamentos');
    expect(res.body.html).toContain('Automatización de procesos de oficina con IA');
  });

  test('al completar 1 curso IA, el nivel sube a básico y ese curso sale de las recomendaciones', async () => {
    const alumno = await db('users').where({ email: 'alumna-cvai@escuela.demo' }).first();
    await db('enrollments').insert({ user_id: alumno.id, course_id: cursoFundamentosId, completado_at: db.fn.now() });

    const res = await request(app)
      .post('/api/cv/generar-ia')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ datosPersonales, destino: 'chatgpt', incluirCursosPlataforma: true });

    expect(res.status).toBe(200);
    expect(res.body.html).toContain('Nivel básico');
    expect(res.body.html).toContain('IA para la oficina: herramientas y fundamentos'); // sigue en "mis cursos"
    expect(res.body.html).toContain('Automatización de procesos de oficina con IA'); // recomendado
    expect(res.body.html).toContain('Conectando la IA a tu LMS'); // segundo recomendado
  });

  test('al completar los 3 cursos IA, nivel avanzado y sin recomendaciones (recomendacionesHtml vacío)', async () => {
    const alumno = await db('users').where({ email: 'alumna-cvai@escuela.demo' }).first();
    await db('enrollments').insert({ user_id: alumno.id, course_id: cursoAutomatizacionId, completado_at: db.fn.now() });
    await db('enrollments').insert({ user_id: alumno.id, course_id: cursoLtiId, completado_at: db.fn.now() });

    const res = await request(app)
      .post('/api/cv/generar-ia')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ datosPersonales, destino: 'chatgpt', incluirCursosPlataforma: true });

    expect(res.status).toBe(200);
    expect(res.body.html).toContain('Nivel avanzado');
    // ya no queda ningún curso IA por recomendar
    expect(res.body.html).not.toMatch(/Para seguir avanzando en IA aplicada a la oficina\./);
  });

  test('completar un curso de otra categoría no mueve el nivel de IA', async () => {
    const alumno2 = await request(app).post('/api/auth/register').send({
      nombre: 'Alumna2', apellido: 'CV', email: 'alumna2-cvai@escuela.demo', password: '123456',
    });
    const otroUsuario = await db('users').where({ email: 'alumna2-cvai@escuela.demo' }).first();
    const otroCurso = await db('courses').where({ categoria: 'Programación' }).first();
    await db('enrollments').insert({ user_id: otroUsuario.id, course_id: otroCurso.id, completado_at: db.fn.now() });

    const res = await request(app)
      .post('/api/cv/generar-ia')
      .set('Authorization', `Bearer ${alumno2.body.token}`)
      .send({ datosPersonales, destino: 'chatgpt', incluirCursosPlataforma: true });

    expect(res.status).toBe(200);
    expect(res.body.html).toContain('Nivel inicial en IA aplicada a la oficina');
  });

  // --- Admin: CRUD de plantillas ---

  test('GET /admin/cv-templates sin token da 401', async () => {
    const res = await request(app).get('/api/admin/cv-templates');
    expect(res.status).toBe(401);
  });

  test('GET /admin/cv-templates con alumno da 403', async () => {
    const res = await request(app).get('/api/admin/cv-templates').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('GET /admin/cv-templates con admin trae las 3 (activas e inactivas)', async () => {
    const res = await request(app).get('/api/admin/cv-templates').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.plantillas.length).toBe(3);
    const gemini = res.body.plantillas.find((p) => p.clave === 'gemini');
    expect(gemini.activo).toBe(false);
  });

  test('PUT /admin/cv-templates/:clave inexistente da 404', async () => {
    const res = await request(app)
      .put('/api/admin/cv-templates/no-existe')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'x' });
    expect(res.status).toBe(404);
  });

  test('PUT /admin/cv-templates/:clave con html vacío da 400', async () => {
    const res = await request(app)
      .put('/api/admin/cv-templates/chatgpt')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ html: '   ' });
    expect(res.status).toBe(400);
  });

  test('PUT /admin/cv-templates/:clave edita el HTML y se refleja en la próxima generación', async () => {
    const nuevoHtml = '<html><body>Versión editada — {{nombreCompleto}}</body></html>';
    const put = await request(app)
      .put('/api/admin/cv-templates/claude')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ html: nuevoHtml, nombre: 'Claude (editado)' });

    expect(put.status).toBe(200);
    expect(put.body.plantilla.html).toBe(nuevoHtml);
    expect(put.body.plantilla.nombre).toBe('Claude (editado)');

    const gen = await request(app).post('/api/cv/generar-ia').send({ datosPersonales, destino: 'claude' });
    expect(gen.status).toBe(200);
    expect(gen.body.html).toContain('Versión editada — Ana Pérez');
  });

  test('activar/desactivar una plantilla la saca/mete del catálogo público', async () => {
    await request(app)
      .put('/api/admin/cv-templates/gemini')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ activo: true });

    const catalogo = await request(app).get('/api/cv/generadores-ia');
    expect(catalogo.body.generadores.map((g) => g.clave).sort()).toEqual(['chatgpt', 'claude', 'gemini']);

    const generarGemini = await request(app).post('/api/cv/generar-ia').send({ datosPersonales, destino: 'gemini' });
    expect(generarGemini.status).toBe(200);
  });
});
