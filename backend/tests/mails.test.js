process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-mails.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-mails.sqlite3');

describe('Backoffice de mails: plantillas, configuración y listas', () => {
  let app;
  let db;
  let tokenAdmin;
  let tokenAlumno;
  let alumnoId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    // Este seed es idempotente (onConflict().merge()/ignore()) y no toca
    // usuarios/cursos — solo carga las plantillas y la configuración por
    // defecto, que es justo lo que necesita este archivo (ver comentario
    // en el propio seed).
    await require('../src/db/seeds/002_email_templates').seed(db);

    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'Mails', email: 'admin-mails@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin-mails@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;

    const registro = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Mails', email: 'alumno-mails@escuela.demo', password: '123456',
    });
    tokenAlumno = registro.body.token;
    alumnoId = registro.body.user.id;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  // --- Permisos ---

  test('un alumno no puede ver las plantillas de mail', async () => {
    const res = await request(app).get('/api/admin/mails/plantillas').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  // --- Plantillas ---

  test('el admin ve las 12 plantillas seedeadas', async () => {
    const res = await request(app).get('/api/admin/mails/plantillas').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    // 10 originales + clase_en_vivo_programada + clase_en_vivo_cancelada
    // (ver seeds/002_email_templates.js).
    expect(res.body.plantillas.length).toBe(12);
    expect(res.body.plantillas.some((p) => p.clave === 'bienvenida')).toBe(true);
  });

  test('el admin edita el asunto de una plantilla', async () => {
    const res = await request(app)
      .put('/api/admin/mails/plantillas/bienvenida')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ asunto: 'Asunto editado de prueba' });
    expect(res.status).toBe(200);
    expect(res.body.plantilla.asunto).toBe('Asunto editado de prueba');
  });

  test('editar una plantilla inexistente devuelve 404', async () => {
    const res = await request(app)
      .put('/api/admin/mails/plantillas/no-existe')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ asunto: 'x' });
    expect(res.status).toBe(404);
  });

  test('el admin manda un mail de prueba de una plantilla', async () => {
    const res = await request(app)
      .post('/api/admin/mails/plantillas/bienvenida/probar')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  }, 20000);

  test('el envío de prueba queda en el registro', async () => {
    const res = await request(app).get('/api/admin/mails/registro').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.envios.some((e) => e.tipo === 'bienvenida')).toBe(true);
  });

  // --- Configuración ---

  test('el admin ve la configuración por defecto', async () => {
    const res = await request(app).get('/api/admin/mails/configuracion').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.settings.some((s) => s.clave === 'dias_inactividad_te_extranamos')).toBe(true);
  });

  test('el admin cambia el umbral de inactividad', async () => {
    const res = await request(app)
      .put('/api/admin/mails/configuracion/dias_inactividad_te_extranamos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: '45' });
    expect(res.status).toBe(200);
    expect(res.body.setting.valor).toBe('45');
  });

  test('cambiar una configuración inexistente devuelve 404', async () => {
    const res = await request(app)
      .put('/api/admin/mails/configuracion/no-existe')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: '1' });
    expect(res.status).toBe(404);
  });

  test('modo prueba de mails: con destinatario cargado, TODO mail se redirige ahí (y queda registrado a quién era)', async () => {
    await request(app)
      .put('/api/admin/mails/configuracion/mail_modo_prueba_destinatario')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: 'nahuel.sasia@gmail.com' })
      .expect(200);

    const envio = await request(app)
      .post('/api/admin/mails/plantillas/bienvenida/probar')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ destinatario: 'alumno-cualquiera@escuela.demo' });
    expect(envio.status).toBe(200);
    expect(envio.body.redirigidoA).toBe('nahuel.sasia@gmail.com');

    const registro = await request(app).get('/api/admin/mails/registro').set('Authorization', `Bearer ${tokenAdmin}`);
    const fila = registro.body.envios.find((e) => e.redirigido_desde === 'alumno-cualquiera@escuela.demo');
    expect(fila).toBeDefined();
    expect(fila.destinatario).toBe('nahuel.sasia@gmail.com');

    // Se puede volver a apagar guardando vacío (antes el endpoint lo
    // rechazaba por completo — ver nota en mails.controller.js).
    const apagar = await request(app)
      .put('/api/admin/mails/configuracion/mail_modo_prueba_destinatario')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: '' });
    expect(apagar.status).toBe(200);
    expect(apagar.body.setting.valor).toBe('');

    const envioNormal = await request(app)
      .post('/api/admin/mails/plantillas/bienvenida/probar')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ destinatario: 'otro-alumno@escuela.demo' });
    expect(envioNormal.body.redirigidoA).toBeNull();
  }, 20000);

  // --- Listas de mailing ---

  let listaId;

  test('el admin crea una lista de mailing', async () => {
    const res = await request(app)
      .post('/api/admin/mails/listas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Oferta de prueba', descripcion: 'Lista para test' });
    expect(res.status).toBe(201);
    listaId = res.body.lista.id;
  });

  test('agrega un miembro puntual a la lista', async () => {
    const res = await request(app)
      .post(`/api/admin/mails/listas/${listaId}/miembros`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ user_id: alumnoId });
    expect(res.status).toBe(201);
    expect(res.body.miembros.some((m) => m.id === alumnoId)).toBe(true);
  });

  test('"seleccionar todos" agrega a los alumnos/profesores restantes', async () => {
    const res = await request(app)
      .post(`/api/admin/mails/listas/${listaId}/miembros/todos`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(201);
    expect(res.body.miembros.length).toBeGreaterThanOrEqual(1);
  });

  test('manda el mail de oferta/aviso a la lista', async () => {
    const res = await request(app)
      .post(`/api/admin/mails/listas/${listaId}/enviar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'Oferta de prueba', mensaje: 'Mensaje de prueba' });
    expect(res.status).toBe(200);
    expect(res.body.enviados).toBeGreaterThanOrEqual(1);
  }, 20000);

  test('"quitar todos" vacía la lista', async () => {
    const res = await request(app)
      .delete(`/api/admin/mails/listas/${listaId}/miembros/todos`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.miembros).toEqual([]);
  });

  test('el admin borra la lista', async () => {
    const res = await request(app).delete(`/api/admin/mails/listas/${listaId}`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
  });
});
