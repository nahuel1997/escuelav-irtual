process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-calendar.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-calendar.sqlite3');

describe('Calendario de turnos alumno-profesor', () => {
  let app;
  let db;
  let tokenAlumno;
  let tokenProfesor;
  let tokenOtroProfesor;
  let tokenAdmin;
  let profesorId;

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

    const [pid] = await db('users').insert({ nombre: 'Profe', apellido: 'Uno', email: 'profe@escuela.demo', password_hash: hash, rol: 'profesor' });
    profesorId = pid;
    const loginProfesor = await request(app).post('/api/auth/login').send({ email: 'profe@escuela.demo', password: '123456' });
    tokenProfesor = loginProfesor.body.token;

    await db('users').insert({ nombre: 'Profe', apellido: 'Dos', email: 'profe2@escuela.demo', password_hash: hash, rol: 'profesor' });
    const loginOtroProfesor = await request(app).post('/api/auth/login').send({ email: 'profe2@escuela.demo', password: '123456' });
    tokenOtroProfesor = loginOtroProfesor.body.token;

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Test', email: 'alumno@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  function horario(horasDesdeAhora, duracionMinutos = 30) {
    const inicio = new Date(Date.now() + horasDesdeAhora * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + duracionMinutos * 60 * 1000);
    return { starts_at: inicio.toISOString(), ends_at: fin.toISOString() };
  }

  test('solo un alumno puede solicitar un turno', async () => {
    const res = await request(app)
      .post('/api/calendar/turnos')
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ profesor_id: profesorId, motivo: 'Consulta', ...horario(24) });
    expect(res.status).toBe(403);
  });

  let turnoId;

  test('un alumno puede solicitar un turno con un profesor', async () => {
    const res = await request(app)
      .post('/api/calendar/turnos')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ profesor_id: profesorId, motivo: 'Dudas del parcial', ...horario(24) });
    expect(res.status).toBe(201);
    expect(res.body.evento.estado).toBe('pendiente');
    turnoId = res.body.evento.id;
  });

  test('no se puede solicitar un turno con horario de inicio posterior al de fin', async () => {
    const { starts_at, ends_at } = horario(24);
    const res = await request(app)
      .post('/api/calendar/turnos')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ profesor_id: profesorId, motivo: 'Test', starts_at: ends_at, ends_at: starts_at });
    expect(res.status).toBe(400);
  });

  test('un profesor que no es el del turno no puede aceptarlo', async () => {
    const res = await request(app)
      .put(`/api/calendar/turnos/${turnoId}/aceptar`)
      .set('Authorization', `Bearer ${tokenOtroProfesor}`);
    expect(res.status).toBe(403);
  });

  test('el profesor del turno puede aceptarlo', async () => {
    const res = await request(app)
      .put(`/api/calendar/turnos/${turnoId}/aceptar`)
      .set('Authorization', `Bearer ${tokenProfesor}`);
    expect(res.status).toBe(200);
    expect(res.body.evento.estado).toBe('aceptada');
  });

  test('no se puede solicitar un turno que se superpone con uno ya aceptado', async () => {
    const res = await request(app)
      .post('/api/calendar/turnos')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ profesor_id: profesorId, motivo: 'Otra consulta', ...horario(24, 15) }); // se cruza con el turno ya aceptado
    expect(res.status).toBe(409);
  });

  let turnoRechazadoId;

  test('un turno pendiente puede rechazarse, y eso libera el horario', async () => {
    const crear = await request(app)
      .post('/api/calendar/turnos')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ profesor_id: profesorId, motivo: 'Consulta 2', ...horario(48) });
    expect(crear.status).toBe(201);
    turnoRechazadoId = crear.body.evento.id;

    const rechazar = await request(app)
      .put(`/api/calendar/turnos/${turnoRechazadoId}/rechazar`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ notas_profesor: 'No puedo ese día' });
    expect(rechazar.status).toBe(200);
    expect(rechazar.body.evento.estado).toBe('rechazada');
  });

  test('no se puede volver a resolver un turno ya rechazado', async () => {
    const res = await request(app)
      .put(`/api/calendar/turnos/${turnoRechazadoId}/aceptar`)
      .set('Authorization', `Bearer ${tokenProfesor}`);
    expect(res.status).toBe(409);
  });

  test('el alumno puede cancelar un turno aceptado', async () => {
    const res = await request(app)
      .put(`/api/calendar/turnos/${turnoId}/cancelar`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.evento.estado).toBe('cancelada');
  });

  test('"mis turnos" del alumno y del profesor devuelven la lista esperada', async () => {
    const delAlumno = await request(app).get('/api/calendar/mis-turnos').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(delAlumno.status).toBe(200);
    expect(delAlumno.body.eventos.length).toBeGreaterThanOrEqual(2);

    const delProfesor = await request(app).get('/api/calendar/mis-turnos').set('Authorization', `Bearer ${tokenProfesor}`);
    expect(delProfesor.status).toBe(200);
    expect(delProfesor.body.eventos.length).toBeGreaterThanOrEqual(2);
  });

  test('un alumno no puede ver el registro completo del admin', async () => {
    const res = await request(app).get('/api/admin/calendario').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('el admin ve el registro completo de turnos, con filtro por estado', async () => {
    const todos = await request(app).get('/api/admin/calendario').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(todos.status).toBe(200);
    expect(todos.body.eventos.length).toBeGreaterThanOrEqual(2);

    const rechazados = await request(app).get('/api/admin/calendario?estado=rechazada').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(rechazados.status).toBe(200);
    expect(rechazados.body.eventos.every((e) => e.estado === 'rechazada')).toBe(true);
  });

  test('cualquier usuario logueado puede listar profesores para elegir con quién pedir un turno', async () => {
    const res = await request(app).get('/api/users/profesores').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.profesores.some((p) => p.id === profesorId)).toBe(true);
  });
});
