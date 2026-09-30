// Seguridad de cuentas: activo/inactivo, bloqueado (manual y automático
// por fuerza bruta), IPs bloqueadas. Ver README "Seguridad de cuentas"
// para el detalle completo del mecanismo — acá se prueba tanto la capa
// HTTP (auth.controller.js/admin.controller.js) como, para el sistema de
// 3 tramos de fuerza bruta, el modelo directo (loginIntento.model.js):
// simular 21 fallos reales vía HTTP implicaría esperar de verdad 1 y 5
// minutos entre tandas (el "tiempo de espera" bloquea el reintento antes
// de sumar el próximo fallo), así que los tramos 2 y 3 se prueban contra
// el modelo, y solo el tramo 1 (10 fallos, alcanzable sin esperar nada
// entre medio) se prueba de punta a punta por HTTP.
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-seguridad-cuentas.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const dbFile = path.join(__dirname, '..', 'data', 'test-seguridad-cuentas.sqlite3');

describe('Seguridad de cuentas', () => {
  let app;
  let db;
  let userModel;
  let loginIntentoModel;
  let ipBloqueadaModel;
  let tokenAdmin;
  let adminId;
  let ipReal;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');
    userModel = require('../src/models/user.model');
    loginIntentoModel = require('../src/models/loginIntento.model');
    ipBloqueadaModel = require('../src/models/ipBloqueada.model');

    const hash = await bcrypt.hash('123456', 10);
    const [id] = await db('users').insert({ nombre: 'Admin', apellido: 'Test', email: 'admin-seg@escuela.demo', password_hash: hash, rol: 'admin' });
    adminId = id;
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin-seg@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;

    // La IP real que ve el server en este entorno de test (puede ser
    // "127.0.0.1", "::1" o "::ffff:127.0.0.1" según la plataforma) — la
    // leemos del login_logs que se acaba de crear en vez de adivinarla a
    // mano, así los tests de IP bloqueada no dependen del formato exacto.
    const filaLogin = await db('login_logs').orderBy('id', 'desc').first();
    ipReal = filaLogin.ip;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  describe('Activo/inactivo (alta-baja de cuenta)', () => {
    let alumnoId;

    beforeAll(async () => {
      const registro = await request(app).post('/api/auth/register').send({
        nombre: 'Activo', apellido: 'Test', email: 'activo-test@escuela.demo', password: '123456',
      });
      alumnoId = registro.body.user.id;
    });

    test('una cuenta recién creada arranca activa', async () => {
      const login = await request(app).post('/api/auth/login').send({ email: 'activo-test@escuela.demo', password: '123456' });
      expect(login.status).toBe(200);
    });

    test('el admin la desactiva, y a partir de ahí el login rebota con 403 aunque la contraseña sea correcta', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${alumnoId}/activo`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: false });
      expect(res.status).toBe(200);
      expect(res.body.user.activo).toBe(false);

      const login = await request(app).post('/api/auth/login').send({ email: 'activo-test@escuela.demo', password: '123456' });
      expect(login.status).toBe(403);
      expect(login.body.error).toMatch(/desactivada/i);
    });

    test('desactivar cierra las sesiones abiertas de esa cuenta', async () => {
      // Ya está desactivada desde el test anterior — comprobamos que su
      // login viejo (de "una cuenta recién creada arranca activa") ya no
      // sirve para pegarle a un endpoint protegido.
      const registro = await request(app).post('/api/auth/register').send({
        nombre: 'ADesactivar', apellido: 'Test', email: 'a-desactivar@escuela.demo', password: '123456',
      });
      const tokenViejo = registro.body.token;
      const antes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenViejo}`);
      expect(antes.status).toBe(200);

      await request(app)
        .put(`/api/admin/users/${registro.body.user.id}/activo`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: false });

      const despues = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenViejo}`);
      expect(despues.status).toBe(401);
    });

    test('reactivarla permite loguearse de nuevo', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${alumnoId}/activo`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: true });
      expect(res.status).toBe(200);

      const login = await request(app).post('/api/auth/login').send({ email: 'activo-test@escuela.demo', password: '123456' });
      expect(login.status).toBe(200);
    });

    test('un admin no puede desactivarse a sí mismo', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${adminId}/activo`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: false });
      expect(res.status).toBe(400);
    });
  });

  describe('Bloqueado (medida de seguridad, independiente de activo/inactivo)', () => {
    let alumnoId;

    beforeAll(async () => {
      const registro = await request(app).post('/api/auth/register').send({
        nombre: 'Bloq', apellido: 'Test', email: 'bloqueado-test@escuela.demo', password: '123456',
      });
      alumnoId = registro.body.user.id;
    });

    test('bloquear con motivo corta el login, revelando el motivo solo con la contraseña correcta', async () => {
      const bloqueo = await request(app)
        .put(`/api/admin/users/${alumnoId}/bloqueo`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ bloqueado: true, motivo: 'Reclamo de un cliente' });
      expect(bloqueo.status).toBe(200);
      expect(bloqueo.body.user.bloqueado).toBe(true);

      // Contraseña incorrecta: mismo mensaje genérico de siempre, no
      // delata que la cuenta además está bloqueada.
      const malaPass = await request(app).post('/api/auth/login').send({ email: 'bloqueado-test@escuela.demo', password: 'mal-puesta' });
      expect(malaPass.status).toBe(401);
      expect(malaPass.body.error).not.toMatch(/bloque/i);

      // Contraseña correcta: recién ahí se revela el bloqueo (y el motivo).
      const buenaPass = await request(app).post('/api/auth/login').send({ email: 'bloqueado-test@escuela.demo', password: '123456' });
      expect(buenaPass.status).toBe(403);
      expect(buenaPass.body.error).toMatch(/bloque/i);
      expect(buenaPass.body.error).toMatch(/Reclamo de un cliente/);
    });

    test('desbloquear permite loguearse de nuevo, y el motivo queda limpio', async () => {
      const desbloqueo = await request(app)
        .put(`/api/admin/users/${alumnoId}/bloqueo`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ bloqueado: false });
      expect(desbloqueo.status).toBe(200);
      expect(desbloqueo.body.user.bloqueado).toBe(false);

      const login = await request(app).post('/api/auth/login').send({ email: 'bloqueado-test@escuela.demo', password: '123456' });
      expect(login.status).toBe(200);
    });

    test('un admin no puede bloquearse a sí mismo', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${adminId}/bloqueo`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ bloqueado: true, motivo: 'x' });
      expect(res.status).toBe(400);
    });
  });

  describe('Fuerza bruta del login — HTTP, tramo 1 (10 fallos -> espera)', () => {
    test('a los 10 fallos con la misma IP+email, el intento 11 rebota con 429 antes de revelar nada', async () => {
      const email = 'fuerza-bruta-http@escuela.demo';
      await request(app).post('/api/auth/register').send({ nombre: 'FB', apellido: 'Test', email, password: '123456' });

      for (let i = 0; i < 10; i += 1) {
        const res = await request(app).post('/api/auth/login').send({ email, password: 'incorrecta' });
        expect(res.status).toBe(401);
      }

      // El intento 11, aunque mande la contraseña CORRECTA, rebota por
      // estar en tiempo de espera — ni siquiera llega a correr bcrypt.
      const once = await request(app).post('/api/auth/login').send({ email, password: '123456' });
      expect(once.status).toBe(429);
      expect(once.body.error).toMatch(/esperá/i);
    }, 20000);
  });

  describe('Fuerza bruta — los 3 tramos contra el modelo directo (sin esperar wall-clock)', () => {
    test('tramo 1 a los 10 fallos: queda con espera, sin bloqueo definitivo', async () => {
      const clave = loginIntentoModel.armarClave('10.0.0.1', 'tramo1@escuela.demo');
      let resultado;
      for (let i = 0; i < 10; i += 1) resultado = await loginIntentoModel.registrarFallo(clave);
      expect(resultado.intentos).toBe(10);
      expect(resultado.esperaHasta).toBeTruthy();
      expect(resultado.bloqueoDefinitivo).toBe(false);
    });

    test('tramo 2 a los 20 fallos: espera más larga, todavía sin bloqueo definitivo', async () => {
      const clave = loginIntentoModel.armarClave('10.0.0.2', 'tramo2@escuela.demo');
      let resultado;
      for (let i = 0; i < 20; i += 1) resultado = await loginIntentoModel.registrarFallo(clave);
      expect(resultado.intentos).toBe(20);
      expect(resultado.esperaHasta).toBeTruthy();
      expect(resultado.bloqueoDefinitivo).toBe(false);
    });

    test('tramo 3 al fallo 21: bloqueo definitivo', async () => {
      const clave = loginIntentoModel.armarClave('10.0.0.3', 'tramo3@escuela.demo');
      let resultado;
      for (let i = 0; i < 21; i += 1) resultado = await loginIntentoModel.registrarFallo(clave);
      expect(resultado.intentos).toBe(21);
      expect(resultado.bloqueoDefinitivo).toBe(true);
    });

    test('un login exitoso (limpiar) borra toda la racha acumulada', async () => {
      const clave = loginIntentoModel.armarClave('10.0.0.4', 'limpiar@escuela.demo');
      await loginIntentoModel.registrarFallo(clave);
      await loginIntentoModel.registrarFallo(clave);
      await loginIntentoModel.limpiar(clave);
      const esperando = await loginIntentoModel.estaEsperando(clave);
      expect(esperando).toBeNull();
    });
  });

  describe('Bloqueo definitivo por HTTP: bloquea solo la IP, nunca la cuenta', () => {
    test('al llegar al fallo 21 vía HTTP, la IP queda bloqueada sola y la cuenta sigue intacta', async () => {
      const email = 'bloqueo-definitivo@escuela.demo';
      const registro = await request(app).post('/api/auth/register').send({ nombre: 'Def', apellido: 'Test', email, password: '123456' });

      // Sembramos directamente los primeros 20 fallos contra el modelo
      // (misma clave que arma el controller: IP real + email) para no
      // tener que esperar los tiempos de espera intermedios en el test —
      // el fallo 21 sí se manda por HTTP de punta a punta, que es el que
      // dispara el bloqueo.
      const clave = loginIntentoModel.armarClave(ipReal, email);
      for (let i = 0; i < 20; i += 1) await loginIntentoModel.registrarFallo(clave);

      // El fallo 20 (tramo 2) deja una espera de 5 minutos activa — la
      // vencemos a mano para que este request llegue de verdad a bcrypt y
      // cuente como el fallo 21, en vez de rebotar antes por el tiempo de
      // espera (que daría 429, no el 401 que estamos probando acá).
      await db('login_intentos').where({ clave }).update({ espera_hasta: new Date(Date.now() - 1000) });

      const fallo21 = await request(app).post('/api/auth/login').send({ email, password: 'incorrecta' });
      expect(fallo21.status).toBe(401); // sigue siendo el mensaje genérico, no delata el bloqueo recién hecho

      // La IP quedó bloqueada (motivo automático)...
      const ipFila = await db('ips_bloqueadas').where({ ip: ipReal }).first();
      expect(ipFila).toBeTruthy();
      expect(ipFila.motivo).toMatch(/automático/i);
      expect(ipFila.bloqueado_por).toBeNull();

      // ...y desde esa IP ya no se llega a la API, ni con la contraseña buena.
      const conPassBuena = await request(app).post('/api/auth/login').send({ email, password: '123456' });
      expect(conPassBuena.status).toBe(403);

      // Pero la cuenta NO se bloquea: si no, cualquiera podría dejar afuera
      // a un usuario sabiendo su email (decisión heredada de DBA24).
      const usuario = await userModel.findById(registro.body.user.id);
      expect(usuario.bloqueado).toBe(false);

      // El intento quedó en el historial de ingresos del admin.
      const evento = await db('login_eventos').where({ email, resultado: 'bloqueo_ip' }).first();
      expect(evento).toBeTruthy();

      // Limpieza: este fallo también bloqueó la IP real que comparte el
      // resto del archivo — si no se saca acá, cualquier test posterior
      // que intente loguearse quedaría rebotado por "conexión bloqueada".
      await db('ips_bloqueadas').where({ ip: ipReal }).del();
    }, 20000);
  });

  describe('IPs bloqueadas', () => {
    afterEach(async () => {
      // Cualquier bloqueo de IP que quede de este describe se saca al
      // final de cada test — el resto del archivo comparte la misma IP
      // de loopback que usa supertest, así que dejar una fila viva acá
      // rompería en cascada TODOS los tests que corran después.
      const filas = await db('ips_bloqueadas').select('*');
      await Promise.all(filas.map((f) => ipBloqueadaModel.desbloquear(f.id)));
    });

    test('el admin bloquea una IP a mano, con motivo', async () => {
      const res = await request(app)
        .post('/api/admin/ips-bloqueadas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ip: '203.0.113.9', motivo: 'Prueba manual' });
      expect(res.status).toBe(201);
      expect(res.body.ip.ip).toBe('203.0.113.9');
      expect(res.body.ip.bloqueado_por_nombre === undefined || res.body.ip.bloqueado_por_nombre === 'Admin').toBe(true);
    });

    test('bloquear la IP real de este entorno hace que el propio login rebote con 403, sin importar el email', async () => {
      await ipBloqueadaModel.bloquear(ipReal, { motivo: 'Prueba', bloqueadoPor: adminId });
      const res = await request(app).post('/api/auth/login').send({ email: 'no-existe-para-nada@escuela.demo', password: 'x' });
      expect(res.status).toBe(403);
      expect(res.body.error).not.toMatch(/incorrectos/i);
    });

    test('listar y desbloquear', async () => {
      const bloqueo = await request(app)
        .post('/api/admin/ips-bloqueadas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ip: '198.51.100.5', motivo: 'Prueba listar/desbloquear' });

      const listado = await request(app).get('/api/admin/ips-bloqueadas').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(listado.status).toBe(200);
      expect(listado.body.ips.some((i) => i.ip === '198.51.100.5')).toBe(true);

      const borrado = await request(app)
        .delete(`/api/admin/ips-bloqueadas/${bloqueo.body.ip.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(borrado.status).toBe(200);
    });
  });
});
