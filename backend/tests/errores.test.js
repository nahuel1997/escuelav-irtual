process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-errores.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-errores.sqlite3');
// PNG de 1x1 para las capturas.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// Registro de errores agrupados (servidor + navegador), errores de mails y
// "Reportar error" con capturas privadas.
describe('Errores y reportes de error', () => {
  let app;
  let db;
  let erroresApp;
  let tokenAdmin;
  let tokenAlumno;
  let tokenOtro;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');
    erroresApp = require('../src/services/erroresApp.service');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'Test', email: 'admin-err@escuela.demo', password_hash: hash, rol: 'admin' });
    tokenAdmin = (await request(app).post('/api/auth/login').send({ email: 'admin-err@escuela.demo', password: '123456' })).body.token;
    tokenAlumno = (await request(app).post('/api/auth/register').send({ nombre: 'Alu', apellido: 'Uno', email: 'alu-err@escuela.demo', password: '123456' })).body.token;
    tokenOtro = (await request(app).post('/api/auth/register').send({ nombre: 'Otro', apellido: 'Dos', email: 'otro-err@escuela.demo', password: '123456' })).body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  describe('Registro agrupado', () => {
    test('la huella ignora números: dos errores iguales con ids distintos son uno solo', () => {
      const { huellaDe } = erroresApp._internos;
      const a = huellaDe({ origen: 'servidor', mensaje: 'Curso 12 no existe', url: '/api/courses/12' });
      const b = huellaDe({ origen: 'servidor', mensaje: 'Curso 40 no existe', url: '/api/courses/40' });
      expect(a).toBe(b);
    });

    test('un error repetido queda como una fila con "veces"', async () => {
      for (let i = 0; i < 3; i += 1) erroresApp.registrar({ origen: 'servidor', mensaje: `Falla ${i} de prueba`, url: '/api/x' });
      await erroresApp.escribirAhora();
      erroresApp.registrar({ origen: 'servidor', mensaje: 'Falla 99 de prueba', url: '/api/x' });
      await erroresApp.escribirAhora();
      const filas = await db('errores_app').where('mensaje', 'like', 'Falla % de prueba');
      expect(filas).toHaveLength(1);
      expect(filas[0].veces).toBe(4);
    });

    test('el navegador reporta sus errores de JS (logueado) y quedan con el usuario', async () => {
      const sinSesion = await request(app).post('/api/app/errores').send({ mensaje: 'x' });
      expect(sinSesion.status).toBe(401);

      const res = await request(app).post('/api/app/errores').set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ mensaje: 'TypeError: cannot read properties of undefined', pagina: '/mis-cursos', archivo: 'app.js', linea: 10 });
      expect(res.status).toBe(200);

      const lista = await request(app).get('/api/admin/errores/app?origen=navegador').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(lista.status).toBe(200);
      const e = lista.body.errores.find((x) => x.mensaje.startsWith('TypeError'));
      expect(e.usuario_nombre).toBe('Alu');
      expect(e.rol).toBe('alumno');

      const detalle = await request(app).get(`/api/admin/errores/app/${e.id}`).set('Authorization', `Bearer ${tokenAdmin}`);
      expect(detalle.body.error.detalle.linea).toBe(10);

      await request(app).delete(`/api/admin/errores/app/${e.id}`).set('Authorization', `Bearer ${tokenAdmin}`);
      const despues = await request(app).get('/api/admin/errores/app?origen=navegador').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(despues.body.errores.some((x) => x.id === e.id)).toBe(false);
    });

    test('un alumno no ve el registro', async () => {
      const res = await request(app).get('/api/admin/errores/app').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(res.status).toBe(403);
    });

    test('los mails fallidos aparecen en "Errores de mails"', async () => {
      await db('mail_log').insert({ destinatario: 'x@y.z', remitente: 'a', asunto: 'Hola', cuerpo: '-', tipo: 'bienvenida', estado: 'fallido', error_detalle: 'SMTP caído' });
      const res = await request(app).get('/api/admin/errores/mails').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.body.errores.some((e) => e.error_detalle === 'SMTP caído')).toBe(true);
    });
  });

  describe('Reportar error', () => {
    let reporteId;
    let adjuntoId;

    test('valida título y descripción', async () => {
      const res = await request(app).post('/api/app/reportes-error').set('Authorization', `Bearer ${tokenAlumno}`).field('titulo', '').field('descripcion', '');
      expect(res.status).toBe(400);
    });

    test('rechaza capturas que no son imágenes', async () => {
      const res = await request(app).post('/api/app/reportes-error').set('Authorization', `Bearer ${tokenAlumno}`)
        .field('titulo', 'x').field('descripcion', 'y')
        .attach('capturas', Buffer.from('hola'), { filename: 'a.txt', contentType: 'text/plain' });
      expect(res.status).toBe(400);
    });

    test('el alumno reporta con una captura y lo ve en "mis reportes"', async () => {
      const res = await request(app).post('/api/app/reportes-error').set('Authorization', `Bearer ${tokenAlumno}`)
        .field('titulo', 'No carga el video').field('descripcion', 'Se queda en negro').field('pagina', '/classroom/1')
        .attach('capturas', PNG, { filename: 'captura.png', contentType: 'image/png' });
      expect(res.status).toBe(201);
      reporteId = res.body.id;

      const mios = await request(app).get('/api/app/reportes-error').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(mios.body.reportes).toHaveLength(1);

      const detalle = await request(app).get(`/api/app/reportes-error/${reporteId}`).set('Authorization', `Bearer ${tokenAlumno}`);
      expect(detalle.body.reporte.adjuntos).toHaveLength(1);
      adjuntoId = detalle.body.reporte.adjuntos[0].id;
    });

    test('la captura no es pública: la baja el autor o un admin, nadie más', async () => {
      const autor = await request(app).get(`/api/app/reportes-error/adjuntos/${adjuntoId}`).set('Authorization', `Bearer ${tokenAlumno}`);
      expect(autor.status).toBe(200);
      expect(autor.headers['content-type']).toMatch(/image\/png/);

      const otro = await request(app).get(`/api/app/reportes-error/adjuntos/${adjuntoId}`).set('Authorization', `Bearer ${tokenOtro}`);
      expect(otro.status).toBe(404);
      const otroDetalle = await request(app).get(`/api/app/reportes-error/${reporteId}`).set('Authorization', `Bearer ${tokenOtro}`);
      expect(otroDetalle.status).toBe(404);

      const admin = await request(app).get(`/api/admin/reportes-error/adjuntos/${adjuntoId}`).set('Authorization', `Bearer ${tokenAdmin}`);
      expect(admin.status).toBe(200);
    });

    test('el admin ve el contador de nuevos y cambia el estado con respuesta', async () => {
      const resumen = await request(app).get('/api/admin/reportes-error/resumen').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(resumen.body.nuevos).toBe(1);

      const invalido = await request(app).put(`/api/admin/reportes-error/${reporteId}/estado`).set('Authorization', `Bearer ${tokenAdmin}`).send({ estado: 'cualquiera' });
      expect(invalido.status).toBe(400);

      const ok = await request(app).put(`/api/admin/reportes-error/${reporteId}/estado`).set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'resuelto', respuesta: 'Arreglado, gracias' });
      expect(ok.status).toBe(200);
      expect(ok.body.reporte.estado).toBe('resuelto');

      const mios = await request(app).get('/api/app/reportes-error').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(mios.body.reportes[0].respuesta).toBe('Arreglado, gracias');
    });
  });

  afterAll(() => {
    // Las capturas de prueba no quedan en disco (en test todo va a data/privado-test).
    const storage = require('../src/services/storage.service');
    fs.rmSync(path.join(storage.PRIVADO_ROOT, 'reportes-error'), { recursive: true, force: true });
  });
});
