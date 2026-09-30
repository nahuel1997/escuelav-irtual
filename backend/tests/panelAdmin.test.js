process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-panel.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-panel.sqlite3');

// Herramientas del panel: menú configurable, habilitación de pantallas,
// feriados en los turnos, Tester, manual por rol y encabezado de mails.
describe('Herramientas del panel de admin', () => {
  let app;
  let db;
  let tokenAdmin;
  let tokenAlumno;
  let alumnoId;
  let profesorId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'T', email: 'admin-panel@escuela.demo', password_hash: hash, rol: 'admin' });
    [profesorId] = await db('users').insert({ nombre: 'Profe', apellido: 'T', email: 'profe-panel@escuela.demo', password_hash: hash, rol: 'profesor' });
    tokenAdmin = (await request(app).post('/api/auth/login').send({ email: 'admin-panel@escuela.demo', password: '123456' })).body.token;
    const reg = await request(app).post('/api/auth/register').send({ nombre: 'Alu', apellido: 'T', email: 'alu-panel@escuela.demo', password: '123456' });
    tokenAlumno = reg.body.token;
    alumnoId = reg.body.user.id;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  const comoAdmin = (r) => r.set('Authorization', `Bearer ${tokenAdmin}`);

  test('menú: se guarda validado y se puede volver al de fábrica', async () => {
    const mal = await comoAdmin(request(app).put('/api/admin/menu')).send({ secciones: [{ nombre: 'X', items: [{ ruta: 'https://malo.com', titulo: 'x' }] }] });
    expect(mal.status).toBe(400);
    const ok = await comoAdmin(request(app).put('/api/admin/menu')).send({ secciones: [{ nombre: 'Principal', items: [{ ruta: '/admin-panel/usuarios', titulo: 'Gente', visible: true }, { ruta: '/admin-panel/lti', titulo: 'LTI', visible: false }] }] });
    expect(ok.status).toBe(200);
    expect((await comoAdmin(request(app).get('/api/admin/menu'))).body.menu.secciones[0].items[1].visible).toBe(false);
    await comoAdmin(request(app).delete('/api/admin/menu'));
    expect((await comoAdmin(request(app).get('/api/admin/menu'))).body.menu).toBeNull();
  });

  test('pantalla en reparación: la API de esa sección responde 503 al alumno, las demás siguen', async () => {
    await comoAdmin(request(app).put('/api/admin/pantallas')).send({ calendario: { estado: 'reparacion', mensaje: 'Arreglando turnos' } });
    const r = await request(app).get('/api/calendar/mis-turnos').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(r.status).toBe(503);
    expect(r.body.codigo).toBe('PANTALLA_REPARACION');
    expect(r.body.error).toBe('Arreglando turnos');
    expect((await request(app).get('/api/alertas/mias').set('Authorization', `Bearer ${tokenAlumno}`)).status).toBe(200);

    const publico = await request(app).get('/api/estado-publico');
    expect(publico.body.pantallas.calendario.estado).toBe('reparacion');
    await comoAdmin(request(app).put('/api/admin/pantallas')).send({});
  });

  test('bloquear una pantalla a un usuario puntual', async () => {
    const mal = await comoAdmin(request(app).post('/api/admin/pantallas/bloqueos')).send({ userId: alumnoId, pantalla: 'inexistente' });
    expect(mal.status).toBe(400);
    const ok = await comoAdmin(request(app).post('/api/admin/pantallas/bloqueos')).send({ userId: alumnoId, pantalla: 'alertas', motivo: 'Uso indebido' });
    expect(ok.status).toBe(201);
    const r = await request(app).get('/api/alertas/mias').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(r.status).toBe(403);
    expect(r.body.codigo).toBe('PANTALLA_BLOQUEADA');
    const mios = await request(app).get('/api/app/mis-bloqueos').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(mios.body.bloqueos[0].pantalla).toBe('alertas');
    await comoAdmin(request(app).delete(`/api/admin/pantallas/bloqueos/${ok.body.bloqueos[0].id}`));
    expect((await request(app).get('/api/alertas/mias').set('Authorization', `Bearer ${tokenAlumno}`)).status).toBe(200);
  });

  test('feriados: no se puede pedir un turno ese día', async () => {
    const manana = new Date(Date.now() + 2 * 86400000);
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(manana);
    await comoAdmin(request(app).put('/api/admin/configuracion/feriados')).send({ dias: [{ fecha: dia, nombre: 'Feriado de prueba' }] });
    const inicio = new Date(`${dia}T15:00:00-03:00`);
    const res = await request(app).post('/api/calendar/turnos').set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ profesor_id: profesorId, motivo: 'Consulta', starts_at: inicio.toISOString(), ends_at: new Date(inicio.getTime() + 3600000).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/feriado/i);
  });

  test('tester: abre una cuenta de prueba con sesión real y al cerrar queda desactivada', async () => {
    const mal = await comoAdmin(request(app).post('/api/admin/tester/sesiones')).send({ rol: 'admin' });
    expect(mal.status).toBe(400);
    const res = await comoAdmin(request(app).post('/api/admin/tester/sesiones')).send({ rol: 'alumno' });
    expect(res.status).toBe(201);
    expect(res.body.user.es_prueba).toBeTruthy();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.user.rol).toBe('alumno');

    await comoAdmin(request(app).post('/api/admin/tester/observaciones')).send({ sesionId: res.body.sesionId, pantalla: '/tienda', tipo: 'bug', texto: 'El botón no responde' });
    const lista = await comoAdmin(request(app).get('/api/admin/tester'));
    expect(lista.body.observaciones[0].texto).toBe('El botón no responde');
    const pdf = await comoAdmin(request(app).get('/api/admin/tester/observaciones/pdf'));
    expect(pdf.headers['content-type']).toMatch(/pdf/);

    await comoAdmin(request(app).post(`/api/admin/tester/sesiones/${res.body.sesionId}/cerrar`));
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(401);
    expect((await db('users').where({ id: res.body.user.id }).first()).activo).toBeFalsy();
  });

  test('manual por rol: cada uno ve el suyo; el admin edita', async () => {
    const alumno = await request(app).get('/api/app/manual').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(alumno.body.secciones.length).toBeGreaterThan(0);
    expect(alumno.body.secciones.every((s) => s.rol === 'alumno')).toBe(true);
    expect((await comoAdmin(request(app).post('/api/admin/manual')).send({ rol: 'x', titulo: 'a', contenido: 'b' })).status).toBe(400);
    expect((await comoAdmin(request(app).post('/api/admin/manual')).send({ rol: 'alumno', titulo: 'Nuevo', contenido: 'Texto', orden: 99 })).status).toBe(201);
    const despues = await request(app).get('/api/app/manual').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(despues.body.secciones.at(-1).titulo).toBe('Nuevo');
  });

  test('encabezado de mails: usa el texto configurado', async () => {
    await comoAdmin(request(app).put('/api/admin/configuracion/logo_mail')).send({ texto: 'Academia <Prueba>', colorFondo: '#112233' });
    const mail = require('../src/services/mail.service');
    const html = await mail.encabezadoMail();
    expect(html).toContain('Academia &lt;Prueba&gt;');
    expect(html).toContain('#112233');
  });
});
