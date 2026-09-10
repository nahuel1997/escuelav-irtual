process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-chat.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const http = require('http');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');

const dbFile = path.join(__dirname, '..', 'data', 'test-chat.sqlite3');

// El registro público solo da de alta alumnos (ver auth.controller.js), así
// que profesor/soporte/admin se cargan directo en la base para el test —
// mismo criterio que ya usan cart.test.js/mails.test.js para el profesor.
function firmarToken(user) {
  return jwt.sign({ id: user.id, email: user.email, rol: user.rol, nombre: user.nombre }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function esperarEvento(socket, evento) {
  return new Promise((resolve) => socket.once(evento, resolve));
}

describe('Chat de soporte', () => {
  let app;
  let db;
  let httpServer;
  let io;
  let port;
  let tokenAlumno;
  let alumno;
  let tokenSoporte;
  let soporte;
  let tokenAdmin;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();

    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    const [soporteId] = await db('users').insert({
      nombre: 'Sole', apellido: 'Soporte', email: 'soporte-chat@escuela.demo', password_hash: hash, rol: 'soporte',
    });
    const [adminId] = await db('users').insert({
      nombre: 'Ada', apellido: 'Admin', email: 'admin-chat@escuela.demo', password_hash: hash, rol: 'admin',
    });
    soporte = { id: soporteId, email: 'soporte-chat@escuela.demo', nombre: 'Sole', rol: 'soporte' };
    tokenSoporte = firmarToken(soporte);
    tokenAdmin = firmarToken({ id: adminId, email: 'admin-chat@escuela.demo', nombre: 'Ada', rol: 'admin' });

    const registro = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Chat', email: 'alumno-chat@escuela.demo', password: '123456',
    });
    tokenAlumno = registro.body.token;
    alumno = registro.body.user;

    // Servidor HTTP real (no supertest) para poder conectar sockets de
    // verdad — supertest no levanta un puerto TCP, y acá hace falta uno.
    httpServer = http.createServer(app);
    io = require('../src/realtime/chatSocket').attachChatSocket(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;
  });

  afterAll(async () => {
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('un usuario sin conversación previa arranca con historial vacío', async () => {
    const res = await request(app).get('/api/chat/mi-conversacion').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.conversacion).toBeNull();
    expect(res.body.mensajes).toEqual([]);
  });

  test('un rol sin acceso no puede ver la lista de soporte', async () => {
    const res = await request(app).get('/api/soporte/conversaciones').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('un rol sin acceso no puede ver el registro del admin', async () => {
    const res = await request(app).get('/api/admin/chats').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  let conversationId;

  test('flujo en vivo: el alumno escribe, el socket rechaza sin token', async () => {
    const socketSinToken = ioClient(`http://localhost:${port}`, { auth: {}, reconnection: false });
    const error = await esperarEvento(socketSinToken, 'connect_error');
    expect(error.message).toMatch(/no autenticado/i);
    socketSinToken.close();
  });

  test('flujo en vivo: el alumno manda un mensaje y soporte lo recibe al instante', async () => {
    const socketAlumno = ioClient(`http://localhost:${port}`, { auth: { token: tokenAlumno }, reconnection: false });
    const socketSoporte = ioClient(`http://localhost:${port}`, { auth: { token: tokenSoporte }, reconnection: false });

    await Promise.all([esperarEvento(socketAlumno, 'connect'), esperarEvento(socketSoporte, 'connect')]);

    const llegaASoporte = esperarEvento(socketSoporte, 'chat:mensaje-nuevo');
    const respuesta = await new Promise((resolve) => {
      socketAlumno.emit('chat:mensaje', { texto: 'Hola, tengo un problema para pagar un curso' }, resolve);
    });

    expect(respuesta.ok).toBe(true);
    conversationId = respuesta.conversationId;

    const eventoSoporte = await llegaASoporte;
    expect(eventoSoporte.conversationId).toBe(conversationId);
    expect(eventoSoporte.mensaje.cuerpo).toBe('Hola, tengo un problema para pagar un curso');
    expect(eventoSoporte.mensaje.remitente_tipo).toBe('usuario');

    socketAlumno.close();
    socketSoporte.close();
  });

  test('flujo en vivo: soporte responde y el alumno lo recibe al instante', async () => {
    const socketAlumno = ioClient(`http://localhost:${port}`, { auth: { token: tokenAlumno }, reconnection: false });
    const socketSoporte = ioClient(`http://localhost:${port}`, { auth: { token: tokenSoporte }, reconnection: false });
    await Promise.all([esperarEvento(socketAlumno, 'connect'), esperarEvento(socketSoporte, 'connect')]);

    socketAlumno.emit('chat:unirse', conversationId);
    socketSoporte.emit('chat:unirse', conversationId);

    const llegaAlAlumno = esperarEvento(socketAlumno, 'chat:mensaje-nuevo');
    const respuesta = await new Promise((resolve) => {
      socketSoporte.emit('chat:mensaje', { conversationId, texto: 'Hola! Contame qué error te aparece' }, resolve);
    });
    expect(respuesta.ok).toBe(true);

    const eventoAlumno = await llegaAlAlumno;
    expect(eventoAlumno.mensaje.remitente_tipo).toBe('soporte');
    expect(eventoAlumno.mensaje.cuerpo).toBe('Hola! Contame qué error te aparece');

    socketAlumno.close();
    socketSoporte.close();
  });

  test('un alumno no puede mandar mensajes a nombre de otra conversación ajena', async () => {
    // Creamos un segundo alumno con su propia conversación y probamos que
    // el primero no puede colarse mandando el conversationId ajeno: el
    // socket lo ignora y le abre/usa la suya propia en cambio.
    const registro2 = await request(app).post('/api/auth/register').send({
      nombre: 'Otro', apellido: 'Alumno', email: 'otro-alumno-chat@escuela.demo', password: '123456',
    });
    const tokenOtro = registro2.body.token;

    const socketOtro = ioClient(`http://localhost:${port}`, { auth: { token: tokenOtro }, reconnection: false });
    await esperarEvento(socketOtro, 'connect');

    const respuesta = await new Promise((resolve) => {
      socketOtro.emit('chat:mensaje', { conversationId, texto: 'Intento colarme en otro chat' }, resolve);
    });
    expect(respuesta.ok).toBe(true);
    expect(respuesta.conversationId).not.toBe(conversationId); // le abrió una conversación propia, no usó la ajena

    socketOtro.close();
  });

  test('el historial por REST refleja los mensajes intercambiados', async () => {
    const res = await request(app).get('/api/chat/mi-conversacion').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.conversacion.id).toBe(conversationId);
    expect(res.body.mensajes.length).toBe(2);
    expect(res.body.mensajes[0].remitente_tipo).toBe('usuario');
    expect(res.body.mensajes[1].remitente_tipo).toBe('soporte');
  });

  test('soporte ve la conversación en su lista, con quién la atendió', async () => {
    const res = await request(app).get('/api/soporte/conversaciones?estado=abierto').set('Authorization', `Bearer ${tokenSoporte}`);
    expect(res.status).toBe(200);
    const conv = res.body.conversaciones.find((c) => c.id === conversationId);
    expect(conv).toBeTruthy();
    expect(conv.usuario_email).toBe('alumno-chat@escuela.demo');
    expect(conv.atendido_por_id).toBe(soporte.id);
    expect(Number(conv.cantidad_mensajes)).toBe(2);
  });

  test('un alumno no puede cerrar una conversación (solo soporte)', async () => {
    const socketAlumno = ioClient(`http://localhost:${port}`, { auth: { token: tokenAlumno }, reconnection: false });
    await esperarEvento(socketAlumno, 'connect');
    const respuesta = await new Promise((resolve) => {
      socketAlumno.emit('chat:cerrar', conversationId, resolve);
    });
    expect(respuesta.ok).toBe(false);
    socketAlumno.close();
  });

  test('flujo en vivo: soporte cierra el chat y el alumno se entera al instante', async () => {
    const socketAlumno = ioClient(`http://localhost:${port}`, { auth: { token: tokenAlumno }, reconnection: false });
    const socketSoporte = ioClient(`http://localhost:${port}`, { auth: { token: tokenSoporte }, reconnection: false });
    await Promise.all([esperarEvento(socketAlumno, 'connect'), esperarEvento(socketSoporte, 'connect')]);

    const llegaCierre = esperarEvento(socketAlumno, 'chat:cerrado');
    const respuesta = await new Promise((resolve) => {
      socketSoporte.emit('chat:cerrar', conversationId, resolve);
    });
    expect(respuesta.ok).toBe(true);
    const evento = await llegaCierre;
    expect(evento.conversationId).toBe(conversationId);

    socketAlumno.close();
    socketSoporte.close();
  });

  test('un chat cerrado ya no acepta mensajes de soporte', async () => {
    const socketSoporte = ioClient(`http://localhost:${port}`, { auth: { token: tokenSoporte }, reconnection: false });
    await esperarEvento(socketSoporte, 'connect');
    const respuesta = await new Promise((resolve) => {
      socketSoporte.emit('chat:mensaje', { conversationId, texto: 'esto no debería mandarse' }, resolve);
    });
    expect(respuesta.ok).toBe(false);
    socketSoporte.close();
  });

  test('el admin ve el registro de chats, incluido el que ya se cerró', async () => {
    const res = await request(app).get('/api/admin/chats?estado=cerrado').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.conversaciones.some((c) => c.id === conversationId)).toBe(true);

    const detalle = await request(app).get(`/api/admin/chats/${conversationId}/mensajes`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.mensajes.length).toBe(2);
  });

  test('si el alumno vuelve a escribir después de que se cerró, le abre una conversación nueva', async () => {
    const socketAlumno = ioClient(`http://localhost:${port}`, { auth: { token: tokenAlumno }, reconnection: false });
    await esperarEvento(socketAlumno, 'connect');
    const respuesta = await new Promise((resolve) => {
      socketAlumno.emit('chat:mensaje', { texto: 'Sigo con el mismo problema' }, resolve);
    });
    expect(respuesta.ok).toBe(true);
    expect(respuesta.conversationId).not.toBe(conversationId);
    socketAlumno.close();
  });
});
