process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-cv.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-cv.sqlite3');

describe('Perfil de CV', () => {
  let app;
  let db;
  let token;

  const datosPersonales = { nombreCompleto: 'Ana Pérez', email: 'ana@escuela.demo', telefono: '111', ubicacion: 'CABA', resumenProfesional: 'Backend dev' };
  const experiencia = [{ puesto: 'Desarrolladora', empresa: 'Acme', periodo: '2022-2024', descripcion: 'Backend' }];
  const educacion = [{ titulo: 'Ingeniería', institucion: 'UBA', periodo: '2018-2023' }];
  const habilidades = ['Node.js', 'SQL'];
  const idiomas = [{ idioma: 'Inglés', nivel: 'Avanzado' }];

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();

    app = require('../src/app');

    const registro = await request(app).post('/api/auth/register').send({
      nombre: 'Ana', apellido: 'Pérez', email: 'ana-cv@escuela.demo', password: '123456',
    });
    token = registro.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('GET /cv/perfil sin token da 401', async () => {
    const res = await request(app).get('/api/cv/perfil');
    expect(res.status).toBe(401);
  });

  test('GET /cv/perfil devuelve null si el usuario todavía no generó ningún CV', async () => {
    const res = await request(app).get('/api/cv/perfil').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.perfil).toBeNull();
  });

  test('POST /cv/generate devuelve el PDF y guarda el perfil del usuario logueado', async () => {
    const res = await request(app)
      .post('/api/cv/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ datosPersonales, experiencia, educacion, habilidades, idiomas, incluirCursosPlataforma: false });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeGreaterThan(0);

    // El guardado del perfil es "best-effort" en el mismo tick del
    // request (no hay await en el controller para no demorar la
    // descarga) — como corre en el mismo proceso sqlite in-memory, para
    // este test alcanza con esperar un tick.
    await new Promise((r) => setTimeout(r, 50));

    const perfil = await request(app).get('/api/cv/perfil').set('Authorization', `Bearer ${token}`);
    expect(perfil.status).toBe(200);
    expect(perfil.body.perfil).not.toBeNull();
    expect(perfil.body.perfil.nombre_completo).toBe('Ana Pérez');
    expect(perfil.body.perfil.experiencia).toEqual(experiencia);
    expect(perfil.body.perfil.educacion).toEqual(educacion);
    expect(perfil.body.perfil.habilidades).toEqual(habilidades);
    expect(perfil.body.perfil.idiomas).toEqual(idiomas);
  });

  test('un segundo POST /cv/generate pisa el perfil anterior (no lo duplica)', async () => {
    await request(app)
      .post('/api/cv/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        datosPersonales: { ...datosPersonales, nombreCompleto: 'Ana Pérez Actualizada' },
        experiencia: [],
        educacion,
        habilidades,
        idiomas,
        incluirCursosPlataforma: false,
      });

    await new Promise((r) => setTimeout(r, 50));

    const fila = await db('cv_profiles').select('*');
    expect(fila.length).toBe(1);
    expect(fila[0].nombre_completo).toBe('Ana Pérez Actualizada');
    expect(JSON.parse(fila[0].experiencia)).toEqual([]);
  });

  test('POST /cv/generate sin login funciona igual (no guarda perfil, no rompe)', async () => {
    const res = await request(app)
      .post('/api/cv/generate')
      .send({ datosPersonales, experiencia, educacion, habilidades, idiomas, incluirCursosPlataforma: false });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  test('POST /cv/generate con incluirCursosPlataforma sin login da 401', async () => {
    const res = await request(app)
      .post('/api/cv/generate')
      .send({ datosPersonales, experiencia: [], educacion: [], habilidades: [], idiomas: [], incluirCursosPlataforma: true });

    expect(res.status).toBe(401);
  });
});
