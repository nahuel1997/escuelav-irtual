process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-agentflows.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-agentflows.sqlite3');

describe('Sandbox de orquestación de agentes', () => {
  let app;
  let db;
  let tokenAlumno;
  let tokenProfesor;
  let tokenAdmin;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Agentes', email: 'alumno-agentes@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Profe', apellido: 'Agentes', email: 'profe-agentes@escuela.demo', password_hash: hash, rol: 'profesor' });
    const loginProfesor = await request(app).post('/api/auth/login').send({ email: 'profe-agentes@escuela.demo', password: '123456' });
    tokenProfesor = loginProfesor.body.token;

    await db('users').insert({ nombre: 'Admin', apellido: 'Agentes', email: 'admin-agentes@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin-agentes@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('sin token, todo /api/agentes/* da 401', async () => {
    const res = await request(app).get('/api/agentes/flujos');
    expect(res.status).toBe(401);
  });

  test('admin no puede usar el sandbox (403) — es solo para alumno/profesor', async () => {
    const res = await request(app).get('/api/agentes/flujos').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(403);
  });

  test('GET /agentes/proveedores devuelve el catálogo con los 4 proveedores pedidos', async () => {
    const res = await request(app).get('/api/agentes/proveedores').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    const claves = res.body.proveedores.map((p) => p.clave);
    expect(claves).toEqual(expect.arrayContaining(['claude', 'gemini', 'chatgpt', 'privado']));
  });

  test('POST /agentes/ejecutar corre un flujo de 2 agentes en cadena (simulado)', async () => {
    const res = await request(app)
      .post('/api/agentes/ejecutar')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({
        nodos: [
          { nombre: 'Clasificador', rol: 'Clasificar tickets entrantes', instrucciones: 'Separar por urgencia', proveedor: 'chatgpt' },
          { nombre: 'Redactor', rol: 'Redactar respuesta', instrucciones: 'Responder al cliente', proveedor: 'claude' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.pasos).toHaveLength(2);
    expect(res.body.pasos[0].proveedor).toBe('chatgpt');
    expect(res.body.pasos[0].meta.simulado).toBe(true);
    expect(res.body.pasos[1].proveedor).toBe('claude');
    // El segundo paso tiene que reflejar que recibió contexto del primero.
    expect(res.body.pasos[1].salida.toLowerCase()).toMatch(/contexto|entrada recibida|paso anterior/);
    expect(res.body.resultadoFinal).toBe(res.body.pasos[1].salida);
  });

  test('POST /agentes/ejecutar sin nodos da 400', async () => {
    const res = await request(app).post('/api/agentes/ejecutar').set('Authorization', `Bearer ${tokenAlumno}`).send({ nodos: [] });
    expect(res.status).toBe(400);
  });

  test('un proveedor inválido cae a "privado" en vez de romper', async () => {
    const res = await request(app)
      .post('/api/agentes/ejecutar')
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ nodos: [{ nombre: 'Agente raro', proveedor: 'no-existe' }] });

    expect(res.status).toBe(200);
    expect(res.body.pasos[0].proveedor).toBe('privado');
  });

  test('CRUD completo de flujos guardados: crear, listar, actualizar, borrar', async () => {
    const crear = await request(app)
      .post('/api/agentes/flujos')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({
        nombre: 'Mi primer flujo',
        descripcion: 'Prueba',
        nodos: [{ nombre: 'Agente 1', rol: 'rol', instrucciones: 'instr', proveedor: 'gemini' }],
      });
    expect(crear.status).toBe(201);
    const flujoId = crear.body.flujo.id;
    expect(crear.body.flujo.nodos).toHaveLength(1);

    const listar = await request(app).get('/api/agentes/flujos').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(listar.body.flujos.map((f) => f.id)).toContain(flujoId);

    const actualizar = await request(app)
      .put(`/api/agentes/flujos/${flujoId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({
        nombre: 'Mi flujo renombrado',
        nodos: [
          { nombre: 'Agente 1', proveedor: 'gemini' },
          { nombre: 'Agente 2', proveedor: 'privado' },
        ],
      });
    expect(actualizar.status).toBe(200);
    expect(actualizar.body.flujo.nombre).toBe('Mi flujo renombrado');
    expect(actualizar.body.flujo.nodos).toHaveLength(2);

    const borrar = await request(app).delete(`/api/agentes/flujos/${flujoId}`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(borrar.status).toBe(200);

    const listarDespues = await request(app).get('/api/agentes/flujos').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(listarDespues.body.flujos.map((f) => f.id)).not.toContain(flujoId);
  });

  test('un alumno no puede editar ni borrar el flujo de otro alumno', async () => {
    const crear = await request(app)
      .post('/api/agentes/flujos')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ nombre: 'Flujo privado', nodos: [{ nombre: 'A', proveedor: 'claude' }] });
    const flujoId = crear.body.flujo.id;

    const editarAjeno = await request(app)
      .put(`/api/agentes/flujos/${flujoId}`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ nombre: 'Hackeado', nodos: [{ nombre: 'A', proveedor: 'claude' }] });
    expect(editarAjeno.status).toBe(404);

    const borrarAjeno = await request(app).delete(`/api/agentes/flujos/${flujoId}`).set('Authorization', `Bearer ${tokenProfesor}`);
    expect(borrarAjeno.status).toBe(404);
  });
});
