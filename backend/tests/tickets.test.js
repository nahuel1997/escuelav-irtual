process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-tickets.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-tickets.sqlite3');

// Tickets de soporte: usuario, gestión del equipo (admin/soporte) y la
// aprobación pública por link.
describe('Tickets de soporte', () => {
  let app;
  let db;
  let tokenAdmin;
  let tokenSoporte;
  let tokenAlumno;
  let tokenOtro;
  let soporteId;
  let ticketId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'T', email: 'admin-tk@escuela.demo', password_hash: hash, rol: 'admin' });
    [soporteId] = await db('users').insert({ nombre: 'Sopo', apellido: 'T', email: 'sop-tk@escuela.demo', password_hash: hash, rol: 'soporte' });
    const login = (email) => request(app).post('/api/auth/login').send({ email, password: '123456' }).then((r) => r.body.token);
    tokenAdmin = await login('admin-tk@escuela.demo');
    tokenSoporte = await login('sop-tk@escuela.demo');
    tokenAlumno = (await request(app).post('/api/auth/register').send({ nombre: 'Alu', apellido: 'T', email: 'alu-tk@escuela.demo', password: '123456' })).body.token;
    tokenOtro = (await request(app).post('/api/auth/register').send({ nombre: 'Otro', apellido: 'T', email: 'otro-tk@escuela.demo', password: '123456' })).body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    const storage = require('../src/services/storage.service');
    fs.rmSync(path.join(storage.PRIVADO_ROOT, 'tickets'), { recursive: true, force: true });
  });

  test('el alumno abre un ticket con adjunto y recibe su número', async () => {
    const vacio = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenAlumno}`).field('asunto', '').field('mensaje', '');
    expect(vacio.status).toBe(400);

    const res = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenAlumno}`)
      .field('asunto', 'No puedo descargar el certificado').field('mensaje', 'Me da error').field('categoria', 'Cursos')
      .attach('adjuntos', Buffer.from('%PDF-1.4 prueba'), { filename: 'detalle.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.ticket.numero).toMatch(/^T-\d{6}$/);
    ticketId = res.body.ticket.id;
  });

  test('otro alumno no ve el ticket ni sus adjuntos', async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${tokenOtro}`);
    expect(res.status).toBe(404);
    const lista = await request(app).get('/api/tickets').set('Authorization', `Bearer ${tokenOtro}`);
    expect(lista.body.tickets).toHaveLength(0);
  });

  test('un alumno no entra a la gestión', async () => {
    const res = await request(app).get('/api/tickets/gestion').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('el equipo lo ve en la bandeja y el tablero; soporte también gestiona', async () => {
    const bandeja = await request(app).get('/api/tickets/gestion?estado=abierto').set('Authorization', `Bearer ${tokenSoporte}`);
    expect(bandeja.status).toBe(200);
    expect(bandeja.body.tickets.map((t) => t.id)).toContain(ticketId);

    const tablero = await request(app).get('/api/tickets/gestion/tablero').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(tablero.body.porEstado.abierto).toBe(1);
    expect(tablero.body.sinAsignar).toBe(1);
  });

  test('asignar, cambiar prioridad y etiquetar deja rastro en el hilo', async () => {
    const etiqueta = await request(app).post('/api/tickets/gestion/etiquetas').set('Authorization', `Bearer ${tokenAdmin}`).send({ nombre: 'Certificados', color: '#aa3300' });
    expect(etiqueta.status).toBe(201);
    const dup = await request(app).post('/api/tickets/gestion/etiquetas').set('Authorization', `Bearer ${tokenAdmin}`).send({ nombre: 'certificados' });
    expect(dup.status).toBe(409);

    const aAlumno = await request(app).put(`/api/tickets/gestion/${ticketId}`).set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ asignado_a: (await db('users').where({ email: 'alu-tk@escuela.demo' }).first()).id });
    expect(aAlumno.status).toBe(400);

    const res = await request(app).put(`/api/tickets/gestion/${ticketId}`).set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ asignado_a: soporteId, prioridad: 'alta', etiquetas: [etiqueta.body.etiqueta.id] });
    expect(res.status).toBe(200);
    expect(res.body.ticket.prioridad).toBe('alta');
    expect(res.body.ticket.etiquetas[0].nombre).toBe('Certificados');
    expect(res.body.ticket.mensajes.some((m) => m.sistema && /Asignado a Sopo/.test(m.mensaje))).toBe(true);

    const mios = await request(app).get('/api/tickets/gestion?asignado=yo').set('Authorization', `Bearer ${tokenSoporte}`);
    expect(mios.body.tickets).toHaveLength(1);
  });

  test('las notas internas no las ve el alumno; la respuesta pública sí y pasa a "esperando usuario"', async () => {
    await request(app).post(`/api/tickets/${ticketId}/mensajes`).set('Authorization', `Bearer ${tokenSoporte}`).field('mensaje', 'Nota: revisar el generador').field('interno', 'true');
    await request(app).post(`/api/tickets/${ticketId}/mensajes`).set('Authorization', `Bearer ${tokenSoporte}`).field('mensaje', '¿Desde qué navegador?');

    const alumno = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(alumno.body.ticket.mensajes.some((m) => m.mensaje.includes('revisar el generador'))).toBe(false);
    expect(alumno.body.ticket.mensajes.some((m) => m.mensaje.includes('navegador'))).toBe(true);
    expect(alumno.body.ticket.estado).toBe('esperando_usuario');

    // El alumno manda "interno" a mano: se ignora (no es del equipo).
    await request(app).post(`/api/tickets/${ticketId}/mensajes`).set('Authorization', `Bearer ${tokenAlumno}`).field('mensaje', 'Chrome').field('interno', 'true');
    const despues = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(despues.body.ticket.mensajes.some((m) => m.mensaje === 'Chrome')).toBe(true);
    expect(despues.body.ticket.estado).toBe('abierto');

    const mail = await db('mail_log').where({ tipo: 'ticket_respuesta' }).first();
    expect(mail).toBeTruthy();
  });

  test('el adjunto lo bajan el dueño y el equipo, nadie más', async () => {
    const t = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${tokenAlumno}`);
    const adj = t.body.ticket.mensajes[0].adjuntos[0];
    expect((await request(app).get(`/api/tickets/adjuntos/${adj.id}`).set('Authorization', `Bearer ${tokenAlumno}`)).status).toBe(200);
    expect((await request(app).get(`/api/tickets/adjuntos/${adj.id}`).set('Authorization', `Bearer ${tokenSoporte}`)).status).toBe(200);
    expect((await request(app).get(`/api/tickets/adjuntos/${adj.id}`).set('Authorization', `Bearer ${tokenOtro}`)).status).toBe(404);
  });

  test('aprobación por link: se ve sin login, se responde una sola vez', async () => {
    const pedido = await request(app).post(`/api/tickets/gestion/${ticketId}/aprobaciones`).set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ detalle: 'Reemitir el certificado con el nombre corregido' });
    expect(pedido.status).toBe(201);
    const { token } = pedido.body;

    const invalido = await request(app).get('/api/aprobacion/no-existe');
    expect(invalido.status).toBe(404);

    const ver = await request(app).get(`/api/aprobacion/${token}`);
    expect(ver.status).toBe(200);
    expect(ver.body.aprobacion.detalle).toMatch(/Reemitir/);
    expect(ver.body.aprobacion.estado).toBe('pendiente');

    const mala = await request(app).post(`/api/aprobacion/${token}`).send({ decision: 'quizas' });
    expect(mala.status).toBe(400);

    const ok = await request(app).post(`/api/aprobacion/${token}`).send({ decision: 'aprobado', comentario: 'Dale' });
    expect(ok.status).toBe(200);
    const otraVez = await request(app).post(`/api/aprobacion/${token}`).send({ decision: 'rechazado' });
    expect(otraVez.status).toBe(409);

    const t = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(t.body.ticket.aprobaciones[0].estado).toBe('aprobado');
    expect(t.body.ticket.mensajes.some((m) => m.mensaje.startsWith('Aprobó'))).toBe(true);
  });

  test('una aprobación vencida no se puede responder', async () => {
    const pedido = await request(app).post(`/api/tickets/gestion/${ticketId}/aprobaciones`).set('Authorization', `Bearer ${tokenAdmin}`).send({ detalle: 'Otra cosa' });
    await db('ticket_aprobaciones').where({ estado: 'pendiente' }).update({ expira_en: new Date(Date.now() - 1000) });
    const res = await request(app).post(`/api/aprobacion/${pedido.body.token}`).send({ decision: 'aprobado' });
    expect(res.status).toBe(410);
  });

  test('el dueño cierra su ticket y ya no se puede responder', async () => {
    const cerrar = await request(app).post(`/api/tickets/${ticketId}/cerrar`).set('Authorization', `Bearer ${tokenAlumno}`);
    expect(cerrar.status).toBe(200);
    const res = await request(app).post(`/api/tickets/${ticketId}/mensajes`).set('Authorization', `Bearer ${tokenAlumno}`).field('mensaje', 'hola');
    expect(res.status).toBe(409);
  });
});
