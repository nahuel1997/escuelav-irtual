process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-live-classes.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const http = require('http');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');

const dbFile = path.join(__dirname, '..', 'data', 'test-live-classes.sqlite3');

// Profesor/admin se cargan directo en la base (el registro público solo da
// de alta alumnos) — mismo criterio que calendar.test.js/chat.test.js.
function firmarToken(user) {
  return jwt.sign({ id: user.id, email: user.email, rol: user.rol, nombre: user.nombre }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function esperarEvento(socket, evento) {
  return new Promise((resolve) => socket.once(evento, resolve));
}

describe('Clases en vivo', () => {
  let app;
  let db;
  let httpServer;
  let io;
  let port;

  let tokenAdmin;
  let tokenProfesor; // asignado a la clase
  let tokenOtroProfesor; // NO asignado
  let tokenAlumno; // inscripto en el curso
  let tokenOtroAlumno; // NO inscripto
  let alumno;
  let profesor;
  let otroProfesor;
  let cursoId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    await db.seed.run(); // trae las plantillas de mail (clase_en_vivo_programada/cancelada)

    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);

    const [adminId] = await db('users').insert({ nombre: 'Ada', apellido: 'Admin', email: 'admin-live@escuela.demo', password_hash: hash, rol: 'admin' });
    tokenAdmin = firmarToken({ id: adminId, email: 'admin-live@escuela.demo', nombre: 'Ada', rol: 'admin' });

    const [profId] = await db('users').insert({ nombre: 'Profe', apellido: 'Uno', email: 'profe-live@escuela.demo', password_hash: hash, rol: 'profesor' });
    profesor = { id: profId, email: 'profe-live@escuela.demo', nombre: 'Profe', rol: 'profesor' };
    tokenProfesor = firmarToken(profesor);

    const [otroProfId] = await db('users').insert({ nombre: 'Profe', apellido: 'Dos', email: 'profe2-live@escuela.demo', password_hash: hash, rol: 'profesor' });
    otroProfesor = { id: otroProfId, email: 'profe2-live@escuela.demo', nombre: 'Profe2', rol: 'profesor' };
    tokenOtroProfesor = firmarToken(otroProfesor);

    const registroAlumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Live', email: 'alumno-live@escuela.demo', password: '123456',
    });
    tokenAlumno = registroAlumno.body.token;
    alumno = registroAlumno.body.user;

    const registroOtroAlumno = await request(app).post('/api/auth/register').send({
      nombre: 'Otro', apellido: 'Alumno', email: 'otro-alumno-live@escuela.demo', password: '123456',
    });
    tokenOtroAlumno = registroOtroAlumno.body.token;

    const [cid] = await db('courses').insert({ titulo: 'Curso Live', descripcion: 'x', precio: 0, profesor_id: profId, estado: 'publicado' });
    cursoId = cid;
    await db('enrollments').insert({ user_id: alumno.id, course_id: cursoId, payment_status: 'aprobado', purchased_at: db.fn.now() });

    // Servidor HTTP real (no supertest) para poder conectar sockets de
    // verdad, con AMBOS módulos de socket enganchados sobre la misma
    // instancia `io` — igual que hace app.js en producción.
    httpServer = http.createServer(app);
    io = require('../src/realtime/chatSocket').attachChatSocket(httpServer);
    require('../src/realtime/liveClassSocket').attachLiveClassSocket(io);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;
  });

  afterAll(async () => {
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  function fechaFutura(horas = 2) {
    return new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
  }

  // --- Admin: agendar ---------------------------------------------------

  test('un alumno no puede agendar una clase (solo admin)', async () => {
    const res = await request(app)
      .post('/api/admin/clases-en-vivo')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ course_id: cursoId, titulo: 'x', scheduled_at: fechaFutura(), profesor_ids: [profesor.id] });
    expect(res.status).toBe(403);
  });

  test('el admin no puede agendar sin profesores asignados', async () => {
    const res = await request(app)
      .post('/api/admin/clases-en-vivo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ course_id: cursoId, titulo: 'Sin profes', scheduled_at: fechaFutura(), profesor_ids: [] });
    expect(res.status).toBe(400);
  });

  test('el admin no puede agendar una clase en una fecha ya pasada', async () => {
    const res = await request(app)
      .post('/api/admin/clases-en-vivo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ course_id: cursoId, titulo: 'Ya pasó', scheduled_at: fechaFutura(-2), profesor_ids: [profesor.id] });
    expect(res.status).toBe(400);
  });

  let claseId;

  test('el admin agenda una clase con un profesor asignado, y se avisa por mail a alumnos inscriptos y profesores', async () => {
    const res = await request(app)
      .post('/api/admin/clases-en-vivo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        course_id: cursoId,
        titulo: 'Clase de repaso',
        descripcion: 'Repasamos el parcial',
        scheduled_at: fechaFutura(),
        duracion_minutos: 45,
        profesor_ids: [profesor.id],
      });
    expect(res.status).toBe(201);
    expect(res.body.clase.estado).toBe('programada');
    expect(res.body.clase.room_id).toBeTruthy();
    expect(res.body.profesores.map((p) => p.id)).toEqual([profesor.id]);
    claseId = res.body.clase.id;

    const mails = await db('mail_log').where({ tipo: 'clase_en_vivo_programada' });
    const destinatarios = mails.map((m) => m.destinatario).sort();
    expect(destinatarios).toEqual([alumno.email, profesor.email].sort());
  });

  test('room_id es distinto del id numérico y no correlativo entre clases', async () => {
    const clase = await db('live_classes').where({ id: claseId }).first();
    expect(clase.room_id).not.toBe(String(claseId));
    expect(clase.room_id.length).toBeGreaterThan(20);
  });

  // --- Listado admin / "mis clases" --------------------------------------

  test('el admin ve la clase en su listado', async () => {
    const res = await request(app).get('/api/admin/clases-en-vivo').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.clases.some((c) => c.id === claseId)).toBe(true);
  });

  test('el alumno inscripto ve la clase en "mis clases"', async () => {
    const res = await request(app).get('/api/clases-en-vivo/mias').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.clases.some((c) => c.id === claseId)).toBe(true);
  });

  test('un alumno NO inscripto no ve la clase', async () => {
    const res = await request(app).get('/api/clases-en-vivo/mias').set('Authorization', `Bearer ${tokenOtroAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.clases.some((c) => c.id === claseId)).toBe(false);
  });

  test('el profesor asignado ve la clase; el que no está asignado, no', async () => {
    const delAsignado = await request(app).get('/api/clases-en-vivo/mias').set('Authorization', `Bearer ${tokenProfesor}`);
    expect(delAsignado.body.clases.some((c) => c.id === claseId)).toBe(true);

    const delOtro = await request(app).get('/api/clases-en-vivo/mias').set('Authorization', `Bearer ${tokenOtroProfesor}`);
    expect(delOtro.body.clases.some((c) => c.id === claseId)).toBe(false);
  });

  // --- Sala: control de acceso según estado -------------------------------

  test('el alumno inscripto NO puede ver la sala mientras la clase está "programada"', async () => {
    const res = await request(app).get(`/api/clases-en-vivo/${claseId}/sala`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(409);
  });

  test('un alumno no inscripto no puede ver la sala en ningún estado', async () => {
    const res = await request(app).get(`/api/clases-en-vivo/${claseId}/sala`).set('Authorization', `Bearer ${tokenOtroAlumno}`);
    expect(res.status).toBe(403);
  });

  test('el profesor asignado SÍ puede ver la sala mientras está "programada" (para probar cámara/mic)', async () => {
    const res = await request(app).get(`/api/clases-en-vivo/${claseId}/sala`).set('Authorization', `Bearer ${tokenProfesor}`);
    expect(res.status).toBe(200);
    expect(res.body.room_id).toBeTruthy();
    expect(res.body.jitsi_domain).toBeTruthy();
  });

  test('un profesor NO asignado no puede ver la sala', async () => {
    const res = await request(app).get(`/api/clases-en-vivo/${claseId}/sala`).set('Authorization', `Bearer ${tokenOtroProfesor}`);
    expect(res.status).toBe(403);
  });

  // --- Editar (solo mientras "programada") -------------------------------

  test('el admin puede editar título/horario/profesores mientras la clase sigue programada', async () => {
    const res = await request(app)
      .put(`/api/admin/clases-en-vivo/${claseId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'Clase de repaso (actualizada)', profesor_ids: [profesor.id, otroProfesor.id] });
    expect(res.status).toBe(200);
    expect(res.body.clase.titulo).toBe('Clase de repaso (actualizada)');
    expect(res.body.profesores.map((p) => p.id).sort()).toEqual([profesor.id, otroProfesor.id].sort());

    // Editar no manda mail (a propósito, ver comentario en el controller) —
    // seguimos con la misma cantidad de mails "programada" que antes.
    const mails = await db('mail_log').where({ tipo: 'clase_en_vivo_programada' });
    expect(mails.length).toBe(2);

    // Dejamos otra vez solo al profesor original asignado, para no romper
    // los tests de "profesor no asignado" que siguen más abajo.
    await request(app)
      .put(`/api/admin/clases-en-vivo/${claseId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ profesor_ids: [profesor.id] });
  });

  // --- Iniciar la transmisión (profesor asignado) -------------------------

  test('un alumno no puede iniciar la transmisión', async () => {
    const res = await request(app).put(`/api/clases-en-vivo/${claseId}/iniciar`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('un profesor no asignado no puede iniciar la transmisión', async () => {
    const res = await request(app).put(`/api/clases-en-vivo/${claseId}/iniciar`).set('Authorization', `Bearer ${tokenOtroProfesor}`);
    expect(res.status).toBe(403);
  });

  test('el profesor asignado inicia la transmisión: programada → en_vivo', async () => {
    const res = await request(app).put(`/api/clases-en-vivo/${claseId}/iniciar`).set('Authorization', `Bearer ${tokenProfesor}`);
    expect(res.status).toBe(200);
    expect(res.body.clase.estado).toBe('en_vivo');
    expect(res.body.clase.started_at).toBeTruthy();
  });

  test('no se puede iniciar una clase que ya está en vivo', async () => {
    const res = await request(app).put(`/api/clases-en-vivo/${claseId}/iniciar`).set('Authorization', `Bearer ${tokenProfesor}`);
    expect(res.status).toBe(409);
  });

  test('ahora el admin ya no puede cancelarla (dejó de estar "programada")', async () => {
    const res = await request(app).put(`/api/admin/clases-en-vivo/${claseId}/cancelar`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(409);
  });

  test('ahora el alumno inscripto SÍ puede ver la sala', async () => {
    const res = await request(app).get(`/api/clases-en-vivo/${claseId}/sala`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.room_id).toBeTruthy();
  });

  // --- Chat en vivo por socket --------------------------------------------

  let mensajeId;

  test('un usuario sin acceso a la clase no puede unirse a su sala de chat', async () => {
    const socketAjeno = ioClient(`http://localhost:${port}`, { auth: { token: tokenOtroAlumno }, reconnection: false });
    await esperarEvento(socketAjeno, 'connect');
    const respuesta = await new Promise((resolve) => socketAjeno.emit('claseEnVivo:unirse', claseId, resolve));
    expect(respuesta.ok).toBe(false);
    socketAjeno.close();
  });

  test('el profesor y el alumno se unen a la sala y chatean en vivo', async () => {
    const socketProf = ioClient(`http://localhost:${port}`, { auth: { token: tokenProfesor }, reconnection: false });
    const socketAlumno = ioClient(`http://localhost:${port}`, { auth: { token: tokenAlumno }, reconnection: false });
    await Promise.all([esperarEvento(socketProf, 'connect'), esperarEvento(socketAlumno, 'connect')]);

    const joinProf = await new Promise((resolve) => socketProf.emit('claseEnVivo:unirse', claseId, resolve));
    expect(joinProf.ok).toBe(true);
    const joinAlumno = await new Promise((resolve) => socketAlumno.emit('claseEnVivo:unirse', claseId, resolve));
    expect(joinAlumno.ok).toBe(true);

    const llegaAlAlumno = esperarEvento(socketAlumno, 'claseEnVivo:mensaje-nuevo');
    const respuesta = await new Promise((resolve) => {
      socketProf.emit('claseEnVivo:mensaje', { liveClassId: claseId, texto: 'Hola a todos, empezamos!' }, resolve);
    });
    expect(respuesta.ok).toBe(true);
    mensajeId = respuesta.mensaje.id;

    const evento = await llegaAlAlumno;
    expect(evento.liveClassId).toBe(claseId);
    expect(evento.mensaje.cuerpo).toBe('Hola a todos, empezamos!');
    expect(evento.mensaje.remitente_nombre).toBe('Profe');

    socketProf.close();
    socketAlumno.close();
  });

  test('el historial por REST refleja el mensaje mandado por socket', async () => {
    const res = await request(app).get(`/api/clases-en-vivo/${claseId}/mensajes`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.mensajes.some((m) => m.id === mensajeId)).toBe(true);
  });

  test('un usuario sin acceso no puede mandar mensajes a la clase', async () => {
    const socketAjeno = ioClient(`http://localhost:${port}`, { auth: { token: tokenOtroAlumno }, reconnection: false });
    await esperarEvento(socketAjeno, 'connect');
    const respuesta = await new Promise((resolve) => {
      socketAjeno.emit('claseEnVivo:mensaje', { liveClassId: claseId, texto: 'no debería poder' }, resolve);
    });
    expect(respuesta.ok).toBe(false);
    socketAjeno.close();
  });

  // --- Finalizar -----------------------------------------------------------

  test('un profesor no asignado no puede finalizar la clase', async () => {
    const res = await request(app).put(`/api/clases-en-vivo/${claseId}/finalizar`).set('Authorization', `Bearer ${tokenOtroProfesor}`);
    expect(res.status).toBe(403);
  });

  test('el profesor asignado finaliza la clase: en_vivo → finalizada', async () => {
    const res = await request(app).put(`/api/clases-en-vivo/${claseId}/finalizar`).set('Authorization', `Bearer ${tokenProfesor}`);
    expect(res.status).toBe(200);
    expect(res.body.clase.estado).toBe('finalizada');
    expect(res.body.clase.ended_at).toBeTruthy();
  });

  test('una vez finalizada, el alumno ya no puede entrar a la sala (pero sí ver el historial del chat)', async () => {
    const sala = await request(app).get(`/api/clases-en-vivo/${claseId}/sala`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(sala.status).toBe(409);

    const mensajes = await request(app).get(`/api/clases-en-vivo/${claseId}/mensajes`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(mensajes.status).toBe(200);
    expect(mensajes.body.mensajes.length).toBeGreaterThanOrEqual(1);
  });

  test('una clase finalizada ya no se puede editar', async () => {
    const res = await request(app)
      .put(`/api/admin/clases-en-vivo/${claseId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'no debería aplicarse' });
    expect(res.status).toBe(409);
  });

  // --- Cancelar (clase aparte, para no interferir con la ya finalizada) ---

  test('el admin cancela una clase programada y se avisa por mail; ya no se puede volver a cancelar', async () => {
    const crear = await request(app)
      .post('/api/admin/clases-en-vivo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ course_id: cursoId, titulo: 'Clase a cancelar', scheduled_at: fechaFutura(5), profesor_ids: [profesor.id] });
    expect(crear.status).toBe(201);
    const idACancelar = crear.body.clase.id;

    const cancelar = await request(app).put(`/api/admin/clases-en-vivo/${idACancelar}/cancelar`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(cancelar.status).toBe(200);
    expect(cancelar.body.clase.estado).toBe('cancelada');

    const mails = await db('mail_log').where({ tipo: 'clase_en_vivo_cancelada' });
    expect(mails.map((m) => m.destinatario).sort()).toEqual([alumno.email, profesor.email].sort());

    const segundaVez = await request(app).put(`/api/admin/clases-en-vivo/${idACancelar}/cancelar`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(segundaVez.status).toBe(409);
  });

  test('el admin puede filtrar el listado por estado', async () => {
    const res = await request(app).get('/api/admin/clases-en-vivo?estado=cancelada').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.clases.every((c) => c.estado === 'cancelada')).toBe(true);
    expect(res.body.clases.length).toBeGreaterThanOrEqual(1);
  });
});
