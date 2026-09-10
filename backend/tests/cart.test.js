process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-cart.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-cart.sqlite3');

describe('Carrito de compras', () => {
  let app;
  let db;
  let tokenAlumno;
  let cursoAId;
  let cursoBId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    await db('achievements').insert({ codigo: 'primer_curso', titulo: 'Primeros pasos', descripcion: '', icono: '🚀' });

    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    const [profesorId] = await db('users').insert({
      nombre: 'Profe', apellido: 'Uno', email: 'profe-cart@escuela.demo', password_hash: hash, rol: 'profesor',
    });
    [cursoAId] = await db('courses').insert({ titulo: 'Curso A', descripcion: 'x', precio: 1000, profesor_id: profesorId });
    [cursoBId] = await db('courses').insert({ titulo: 'Curso B', descripcion: 'y', precio: 2000, profesor_id: profesorId });

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Carrito', email: 'alumno-cart@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('el carrito arranca vacío', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test('agrega un curso al carrito', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ course_id: cursoAId });
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBe(1);
  });

  test('agregar el mismo curso dos veces no lo duplica', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ course_id: cursoAId });
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBe(1);
  });

  test('agrega un segundo curso distinto', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ course_id: cursoBId });
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBe(2);
  });

  test('quita un curso del carrito', async () => {
    const res = await request(app)
      .delete(`/api/cart/items/${cursoBId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  test('el checkout convierte el carrito en una inscripción real', async () => {
    const res = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(201);
    expect(res.body.comprados.some((c) => c.id === cursoAId)).toBe(true);

    const misCursos = await request(app).get('/api/courses/mine').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(misCursos.body.courses.some((c) => c.id === cursoAId)).toBe(true);

    const carritoVacio = await request(app).get('/api/cart').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(carritoVacio.body.items).toEqual([]);
  });

  test('no se puede hacer checkout de un carrito vacío', async () => {
    const res = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(400);
  });

  test('no se puede agregar al carrito un curso ya comprado', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ course_id: cursoAId });
    expect(res.status).toBe(409);
  });

  test('no se puede agregar al carrito un curso que no está "subido"', async () => {
    await db('courses').where({ id: cursoBId }).update({ estado: 'cancelado' });
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ course_id: cursoBId });
    expect(res.status).toBe(400);
  });
});
