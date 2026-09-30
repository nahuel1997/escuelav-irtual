process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-operacion.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-operacion.sqlite3');

// Operación del backoffice: configuración (mantenimiento, páginas de
// error...), estado de la app, tráfico, versiones, procesos en segundo
// plano, tareas programadas y listas blancas de Backups/Actualizaciones.
describe('Operación del backoffice', () => {
  let app;
  let db;
  let procesos;
  let tokenAdmin;
  let tokenAdmin2;
  let admin2Id;
  let tokenAlumno;
  let tokenProfesor;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');
    procesos = require('../src/services/procesos');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'Uno', email: 'admin1-op@escuela.demo', password_hash: hash, rol: 'admin' });
    [admin2Id] = await db('users').insert({ nombre: 'Admin', apellido: 'Dos', email: 'admin2-op@escuela.demo', password_hash: hash, rol: 'admin' });
    await db('users').insert({ nombre: 'Profe', apellido: 'T', email: 'profe-op@escuela.demo', password_hash: hash, rol: 'profesor' });
    const login = (email) => request(app).post('/api/auth/login').send({ email, password: '123456' }).then((r) => r.body.token);
    tokenAdmin = await login('admin1-op@escuela.demo');
    tokenAdmin2 = await login('admin2-op@escuela.demo');
    tokenProfesor = await login('profe-op@escuela.demo');
    tokenAlumno = (await request(app).post('/api/auth/register').send({ nombre: 'Alu', apellido: 'T', email: 'alu-op@escuela.demo', password: '123456' })).body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    const storage = require('../src/services/storage.service');
    fs.rmSync(storage.PRIVADO_ROOT, { recursive: true, force: true });
  });

  const comoAdmin = (r) => r.set('Authorization', `Bearer ${tokenAdmin}`);

  describe('Configuración y modo mantenimiento', () => {
    test('el estado público trae los valores por defecto sin login', async () => {
      const res = await request(app).get('/api/estado-publico');
      expect(res.status).toBe(200);
      expect(res.body.mantenimiento.alumno).toBe(false);
      expect(res.body.paginas_error.titulo404).toBeTruthy();
      expect(res.body.logo_mail).toBeUndefined(); // no es pública
    });

    test('sección desconocida da 404; un alumno no configura nada', async () => {
      expect((await comoAdmin(request(app).put('/api/admin/configuracion/cualquiera')).send({})).status).toBe(404);
      expect((await request(app).put('/api/admin/configuracion/mantenimiento').set('Authorization', `Bearer ${tokenAlumno}`).send({})).status).toBe(403);
    });

    test('mantenimiento para alumnos: el alumno recibe 503 con el mensaje; profesor y admin siguen', async () => {
      const r = await comoAdmin(request(app).put('/api/admin/configuracion/mantenimiento')).send({ alumno: true, mensaje: 'Volvemos a las 18 hs' });
      expect(r.status).toBe(200);

      const alumno = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(alumno.status).toBe(503);
      expect(alumno.body.codigo).toBe('MANTENIMIENTO');
      expect(alumno.body.error).toBe('Volvemos a las 18 hs');

      // /api/auth sigue andando (ver quién soy / cerrar sesión).
      expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenAlumno}`)).status).toBe(200);
      expect((await request(app).get('/api/users/profile').set('Authorization', `Bearer ${tokenProfesor}`)).status).toBe(200);
      expect((await comoAdmin(request(app).get('/api/admin/dashboard'))).status).toBe(200);

      // Un mantenimiento con "hasta" vencido se considera terminado solo.
      await comoAdmin(request(app).put('/api/admin/configuracion/mantenimiento')).send({ alumno: true, hasta: new Date(Date.now() - 60000).toISOString() });
      expect((await request(app).get('/api/users/profile').set('Authorization', `Bearer ${tokenAlumno}`)).status).toBe(200);

      await comoAdmin(request(app).put('/api/admin/configuracion/mantenimiento')).send({ alumno: false });
    });

    test('feriados: se validan, deduplican y ordenan', async () => {
      const r = await comoAdmin(request(app).put('/api/admin/configuracion/feriados')).send({
        dias: [{ fecha: '2026-12-25', nombre: 'Navidad' }, { fecha: 'mal', nombre: 'x' }, { fecha: '2026-07-09', nombre: 'Independencia' }, { fecha: '2026-12-25', nombre: 'Navidad bis' }],
      });
      expect(r.body.valor.dias.map((d) => d.fecha)).toEqual(['2026-07-09', '2026-12-25']);
    });

    test('logo de mail: solo imágenes subidas o https', async () => {
      const mal = await comoAdmin(request(app).put('/api/admin/configuracion/logo_mail')).send({ logoUrl: 'javascript:alert(1)' });
      expect(mal.status).toBe(400);
    });
  });

  describe('Estado de la app y tráfico', () => {
    test('el estado trae servidor, proceso, event loop y última hora', async () => {
      const res = await comoAdmin(request(app).get('/api/admin/estado-app'));
      expect(res.status).toBe(200);
      expect(res.body.actual.servidor.node).toBe(process.version);
      expect(res.body.actual.ultimaHora.requests).toBeGreaterThan(0);
      expect(Array.isArray(res.body.serie)).toBe(true);
    });

    test('la foto horaria se guarda en la serie', async () => {
      await require('../src/services/metricas.service').registrarMetrica();
      const res = await comoAdmin(request(app).get('/api/admin/estado-app'));
      expect(res.body.serie.length).toBe(1);
    });

    test('test de velocidad mide cada paso', async () => {
      const res = await comoAdmin(request(app).post('/api/admin/estado-app/test-velocidad'));
      expect(res.status).toBe(200);
      expect(res.body.pasos.length).toBeGreaterThanOrEqual(5);
      expect(res.body.pasos.every((p) => p.ok)).toBe(true);
    }, 20000);

    test('los PDFs de estado y tráfico salen', async () => {
      const a = await comoAdmin(request(app).get('/api/admin/estado-app/pdf'));
      expect(a.status).toBe(200);
      expect(a.headers['content-type']).toMatch(/pdf/);
      const b = await comoAdmin(request(app).get('/api/admin/trafico/pdf'));
      expect(b.status).toBe(200);
    });

    test('las vistas se registran (con y sin sesión), sin ids ni backoffice', async () => {
      await request(app).post('/api/app/vista').send({ pagina: '/tienda/15', visitante: 'abc12345-anon' });
      await request(app).post('/api/app/vista').set('Authorization', `Bearer ${tokenAlumno}`).send({ pagina: '/mis-cursos' });
      await request(app).post('/api/app/vista').send({ pagina: '/admin-panel/usuarios' });
      expect((await request(app).post('/api/app/vista').send({ pagina: 'javascript:alert(1)' })).status).toBe(400);

      const res = await comoAdmin(request(app).get('/api/admin/trafico'));
      expect(res.body.resumen.totalVistas).toBe(2);
      expect(res.body.resumen.paginas.map((p) => p.pagina)).toEqual(expect.arrayContaining(['/tienda/:id', '/mis-cursos']));
      expect(res.body.resumen.porRol.alumno).toBe(1);
      expect(res.body.online.some((u) => u.rol === 'alumno')).toBe(true);
    });
  });

  describe('Versiones', () => {
    test('alta con validación, sin duplicados, y visible como novedades', async () => {
      expect((await comoAdmin(request(app).post('/api/admin/versiones')).send({ version: '1.0', titulo: 'x', fecha: '2026-09-30', cambios: '' })).status).toBe(400);
      const ok = await comoAdmin(request(app).post('/api/admin/versiones')).send({ version: '1.5.0', titulo: 'Backoffice nuevo', fecha: '2026-09-30', cambios: 'Tickets\nErrores\n\n' });
      expect(ok.status).toBe(201);
      expect(ok.body.version.cambios).toBe('Tickets\nErrores');
      expect((await comoAdmin(request(app).post('/api/admin/versiones')).send({ version: '1.5.0', titulo: 'y', fecha: '2026-09-30', cambios: 'a' })).status).toBe(409);

      const nov = await request(app).get('/api/app/novedades').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(nov.body.versiones[0].version).toBe('1.5.0');
    });
  });

  describe('Procesos en segundo plano', () => {
    let procesoId;

    test('tipo desconocido da 400', async () => {
      const res = await request(app).post('/api/procesos').set('Authorization', `Bearer ${tokenAlumno}`).send({ tipo: 'no-existe' });
      expect(res.status).toBe(400);
    });

    test('se encola con número P-000000, corre y deja el archivo para descargar', async () => {
      const res = await request(app).post('/api/procesos').set('Authorization', `Bearer ${tokenAlumno}`).send({ tipo: 'pdf_versiones' });
      expect(res.status).toBe(201);
      expect(res.body.proceso.numero).toMatch(/^P-\d{6}$/);
      expect(res.body.proceso.estado).toBe('pendiente');
      procesoId = res.body.proceso.id;

      await procesos.procesarPendientes();

      const ver = await request(app).get(`/api/procesos/${procesoId}`).set('Authorization', `Bearer ${tokenAlumno}`);
      expect(ver.body.proceso.estado).toBe('terminado');
      expect(ver.body.proceso.tieneArchivo).toBe(true);

      const archivo = await request(app).get(`/api/procesos/${procesoId}/archivo`).set('Authorization', `Bearer ${tokenAlumno}`);
      expect(archivo.status).toBe(200);
      expect(archivo.headers['content-type']).toMatch(/pdf/);
    });

    test('otro usuario no ve el proceso ajeno; el admin ve todos', async () => {
      expect((await request(app).get(`/api/procesos/${procesoId}`).set('Authorization', `Bearer ${tokenProfesor}`)).status).toBe(404);
      const todos = await comoAdmin(request(app).get('/api/admin/procesos'));
      expect(todos.body.procesos.some((p) => p.id === procesoId)).toBe(true);
    });

    test('se cancela solo si no arrancó; reintentar lo vuelve a la cola', async () => {
      const res = await request(app).post('/api/procesos').set('Authorization', `Bearer ${tokenAlumno}`).send({ tipo: 'pdf_versiones' });
      const id = res.body.proceso.id;
      expect((await request(app).post(`/api/procesos/${id}/cancelar`).set('Authorization', `Bearer ${tokenAlumno}`)).status).toBe(200);
      expect((await request(app).post(`/api/procesos/${id}/cancelar`).set('Authorization', `Bearer ${tokenAlumno}`)).status).toBe(409);
      expect((await comoAdmin(request(app).post(`/api/admin/procesos/${id}/reintentar`))).status).toBe(200);
      await procesos.procesarPendientes();
      expect((await db('procesos').where({ id }).first()).estado).toBe('terminado');
    });
  });

  describe('Tareas programadas', () => {
    test('se listan con su horario por defecto y se validan los cambios', async () => {
      const lista = await comoAdmin(request(app).get('/api/admin/jobs'));
      expect(lista.body.jobs.find((j) => j.clave === 'inactividad').cron).toBe('0 9 * * *');

      const mal = await comoAdmin(request(app).put('/api/admin/jobs/inactividad')).send({ cron: 'todos los dias' });
      expect(mal.status).toBe(400);

      const ok = await comoAdmin(request(app).put('/api/admin/jobs/inactividad')).send({ cron: '0 10 * * *', activo: false });
      const job = ok.body.jobs.find((j) => j.clave === 'inactividad');
      expect(job.cron).toBe('0 10 * * *');
      expect(job.activo).toBe(false);
    });

    test('"ejecutar ahora" corre la tarea y guarda el resultado', async () => {
      const res = await comoAdmin(request(app).post('/api/admin/jobs/limpieza/ejecutar'));
      expect(res.body.ok).toBe(true);
      const lista = await comoAdmin(request(app).get('/api/admin/jobs'));
      expect(lista.body.jobs.find((j) => j.clave === 'limpieza').ultimoResultado).toMatch(/procesado/);
    });
  });

  describe('Listas blancas de Backups y Actualizaciones', () => {
    test('con la lista vacía entra cualquier admin; un no-admin nunca', async () => {
      expect((await comoAdmin(request(app).get('/api/admin/backups'))).body.listaVacia).toBe(true);
      expect((await request(app).get('/api/admin/backups').set('Authorization', `Bearer ${tokenProfesor}`)).status).toBe(403);
    });

    test('al cargar a alguien, los demás admins quedan afuera — y cada lista es independiente', async () => {
      const yo = await db('users').where({ email: 'admin1-op@escuela.demo' }).first();
      const alta = await comoAdmin(request(app).post('/api/admin/listas/backups/admins')).send({ userId: yo.id });
      expect(alta.status).toBe(201);

      expect((await request(app).get('/api/admin/backups').set('Authorization', `Bearer ${tokenAdmin2}`)).status).toBe(403);
      expect((await request(app).get('/api/admin/backups/db').set('Authorization', `Bearer ${tokenAdmin2}`)).status).toBe(403);
      // Actualizaciones sigue con su lista vacía.
      expect((await request(app).post('/api/admin/actualizaciones/diagnostico/versiones').set('Authorization', `Bearer ${tokenAdmin2}`)).status).toBe(200);
    });

    test('no se puede agregar a un no-admin, ni quitarse siendo el último', async () => {
      const profe = await db('users').where({ email: 'profe-op@escuela.demo' }).first();
      expect((await comoAdmin(request(app).post('/api/admin/listas/backups/admins')).send({ userId: profe.id })).status).toBe(400);
      const lista = await comoAdmin(request(app).get('/api/admin/backups'));
      const yo = lista.body.admins[0];
      expect((await comoAdmin(request(app).delete(`/api/admin/listas/backups/admins/${yo.id}`))).status).toBe(400);
      await comoAdmin(request(app).post('/api/admin/listas/backups/admins')).send({ userId: admin2Id });
    });

    test('el backup de la base (SQLite) se descarga', async () => {
      const res = await comoAdmin(request(app).get('/api/admin/backups/db')).buffer(true).parse((r, cb) => {
        const partes = [];
        r.on('data', (c) => partes.push(c));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      });
      expect(res.status).toBe(200);
      expect(res.body.slice(0, 15).toString()).toBe('SQLite format 3');
    });
  });
});
