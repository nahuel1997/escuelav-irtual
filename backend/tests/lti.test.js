process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-lti.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-lti.sqlite3');

// ---------------------------------------------------------------------------
// "Plataforma" LMS falsa, corriendo de verdad en un puerto local: expone
// /jwks (sus claves públicas, para que nuestro Tool valide el id_token que
// firmamos acá abajo), /token (client_credentials — valida que el
// client_assertion que le mandamos esté firmado con NUESTRA clave, la que
// publicamos en /api/lti/jwks) y /lineitem/scores (donde esperamos que
// llegue el passback de la nota). Con esto probamos el protocolo real de
// punta a punta, no solo "el código compila" — sin depender de tener un
// Moodle/Canvas real para correr los tests.
// ---------------------------------------------------------------------------
function crearPlataformaFalsa() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const kid = 'plataforma-kid-1';
  const jwk = { ...crypto.createPublicKey(publicKey).export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };

  const scoresRecibidos = [];
  let toolJwksUrl = null; // se completa después de levantar nuestra app

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyRaw = Buffer.concat(chunks).toString('utf8');

    if (req.url === '/jwks' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }

    if (req.url === '/token' && req.method === 'POST') {
      const params = new URLSearchParams(bodyRaw);
      const assertion = params.get('client_assertion');
      try {
        // Verificamos la firma del pedido contra el JWKS que publica
        // nuestra propia app (/api/lti/jwks) — cerrando el círculo: la
        // plataforma confía en nosotros mirando la clave que NOSOTROS
        // publicamos, tal cual pasaría con una plataforma real.
        const decoded = jwt.decode(assertion, { complete: true });
        const jwksRes = await fetch(toolJwksUrl);
        const toolJwks = await jwksRes.json();
        const toolJwk = toolJwks.keys.find((k) => k.kid === decoded.header.kid);
        if (!toolJwk) throw new Error('kid no encontrado en el JWKS del tool');
        const keyObj = crypto.createPublicKey({ key: toolJwk, format: 'jwk' });
        jwt.verify(assertion, keyObj, { algorithms: ['RS256'] });
      } catch (err) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `client_assertion inválido: ${err.message}` }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: 'fake-access-token-de-la-plataforma', token_type: 'Bearer', expires_in: 3600 }));
      return;
    }

    if (req.url === '/lineitem/scores' && req.method === 'POST') {
      scoresRecibidos.push({ headers: req.headers, body: JSON.parse(bodyRaw) });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const puerto = server.address().port;
      const base = `http://127.0.0.1:${puerto}`;
      resolve({
        server,
        base,
        privateKey,
        kid,
        scoresRecibidos,
        setToolJwksUrl: (url) => { toolJwksUrl = url; },
        firmarIdToken(claims) {
          return jwt.sign(claims, privateKey, { algorithm: 'RS256', keyid: kid, noTimestamp: false });
        },
      });
    });
  });
}

describe('Integración LMS real (LTI 1.3)', () => {
  let app;
  let db;
  let tokenAdmin;
  let cursoId;
  let plataformaFalsa;
  let plataformaId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');

    plataformaFalsa = await crearPlataformaFalsa();
    // Nuestra propia app corre "en memoria" vía supertest (no en un
    // puerto real) — pero el mock de plataforma SÍ necesita poder
    // pegarle por HTTP de verdad a nuestro /api/lti/jwks (lo llama desde
    // su propio handler /token). Por eso levantamos la app en un puerto
    // real además de usarla con supertest.
    const appServer = app.listen(0);
    const appPort = appServer.address().port;
    plataformaFalsa.setToolJwksUrl(`http://127.0.0.1:${appPort}/api/lti/jwks`);

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'LTI', email: 'admin-lti@escuela.demo', password_hash: hash, rol: 'admin' });
    const login = await request(app).post('/api/auth/login').send({ email: 'admin-lti@escuela.demo', password: '123456' });
    tokenAdmin = login.body.token;

    const [profesorId] = await db('users').insert({ nombre: 'Profe', apellido: 'LTI', email: 'profe-lti@escuela.demo', password_hash: hash, rol: 'profesor' });
    const [cursoRow] = await db('courses').insert({ titulo: 'Curso conectado por LTI', descripcion: 'x', precio: 0, profesor_id: profesorId }).returning('id');
    cursoId = typeof cursoRow === 'object' ? cursoRow.id : cursoRow;

    const crearPlataforma = await request(app)
      .post('/api/admin/lti/plataformas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'LMS de prueba',
        issuer: 'https://lms-de-prueba.test',
        client_id: 'tool-client-id-123',
        deployment_id: 'deployment-1',
        auth_login_url: `${plataformaFalsa.base}/auth`,
        auth_token_url: `${plataformaFalsa.base}/token`,
        jwks_url: `${plataformaFalsa.base}/jwks`,
        curso_id: cursoId,
      });
    expect(crearPlataforma.status).toBe(201);
    plataformaId = crearPlataforma.body.plataforma.id;

    global.__appServer = appServer;
  });

  afterAll(async () => {
    await new Promise((r) => plataformaFalsa.server.close(r));
    await new Promise((r) => global.__appServer.close(r));
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('GET /api/lti/jwks devuelve nuestra clave pública en formato JWK', async () => {
    const res = await request(app).get('/api/lti/jwks');
    expect(res.status).toBe(200);
    expect(res.body.keys).toHaveLength(1);
    expect(res.body.keys[0].kty).toBe('RSA');
    expect(res.body.keys[0].kid).toBeTruthy();
  });

  test('GET /api/admin/lti/info devuelve las 3 URLs para registrar el Tool en el LMS', async () => {
    const res = await request(app).get('/api/admin/lti/info').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.openidLoginUrl).toMatch(/\/api\/lti\/login$/);
    expect(res.body.launchUrl).toMatch(/\/api\/lti\/launch$/);
    expect(res.body.jwksUrl).toMatch(/\/api\/lti\/jwks$/);
  });

  test('login con un issuer no registrado da 400', async () => {
    const res = await request(app).get('/api/lti/login').query({ iss: 'https://no-existe.test', login_hint: 'x' });
    expect(res.status).toBe(400);
  });

  let state;
  let nonce;

  test('GET /api/lti/login redirige a la plataforma con state y nonce', async () => {
    const res = await request(app).get('/api/lti/login').query({
      iss: 'https://lms-de-prueba.test',
      login_hint: 'alumno-lti-1',
      client_id: 'tool-client-id-123',
      target_link_uri: 'https://lms-de-prueba.test/curso/1',
    });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe(`${plataformaFalsa.base}/auth`);
    state = location.searchParams.get('state');
    nonce = location.searchParams.get('nonce');
    expect(state).toBeTruthy();
    expect(nonce).toBeTruthy();
    expect(location.searchParams.get('client_id')).toBe('tool-client-id-123');
  });

  function claimsBase(overrides = {}) {
    const ahora = Math.floor(Date.now() / 1000);
    return {
      iss: 'https://lms-de-prueba.test',
      aud: 'tool-client-id-123',
      sub: 'lti-user-sub-1',
      email: 'alumno-lti@escuela.demo',
      given_name: 'Alumno',
      family_name: 'LTI',
      iat: ahora,
      exp: ahora + 300,
      nonce,
      'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
      'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
      'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'deployment-1',
      'https://purl.imsglobal.org/spec/lti/claim/roles': ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
      'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': { lineitem: `${plataformaFalsa.base}/lineitem`, scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'] },
      ...overrides,
    };
  }

  let redirectToFrontend;

  test('POST /api/lti/launch con un id_token válido crea el usuario, la inscripción y redirige al frontend', async () => {
    const idToken = plataformaFalsa.firmarIdToken(claimsBase());
    const res = await request(app).post('/api/lti/launch').type('form').send({ id_token: idToken, state });

    expect(res.status).toBe(302);
    redirectToFrontend = res.headers.location;
    expect(redirectToFrontend).toMatch(/\/lti\/entrando\?code=/);

    const usuario = await db('users').where({ email: 'alumno-lti@escuela.demo' }).first();
    expect(usuario).toBeTruthy();
    expect(usuario.rol).toBe('alumno');

    const link = await db('lti_user_links').where({ platform_id: plataformaId, lti_sub: 'lti-user-sub-1' }).first();
    expect(link.user_id).toBe(usuario.id);

    const enrollment = await db('enrollments').where({ user_id: usuario.id, course_id: cursoId }).first();
    expect(enrollment).toBeTruthy();
    expect(enrollment.payment_method).toBe('lti');

    const enrollmentLink = await db('lti_enrollment_links').where({ enrollment_id: enrollment.id }).first();
    expect(enrollmentLink.lineitem_url).toBe(`${plataformaFalsa.base}/lineitem`);
  });

  test('el state ya se usó: reenviar el mismo launch da 400 (protección de un solo uso)', async () => {
    const idToken = plataformaFalsa.firmarIdToken(claimsBase());
    const res = await request(app).post('/api/lti/launch').type('form').send({ id_token: idToken, state });
    expect(res.status).toBe(400);
  });

  test('POST /api/lti/exchange cambia el código por una sesión real y la vuelve a usar da error', async () => {
    const code = new URL(redirectToFrontend, 'http://x').searchParams.get('code');
    const res = await request(app).post('/api/lti/exchange').send({ code });
    expect(res.status).toBe(200);
    expect(res.body.redirectTo).toBe(`/classroom/${cursoId}`);
    expect(res.body.user.email).toBe('alumno-lti@escuela.demo');
    expect(res.body.token).toBeTruthy();

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.rol).toBe('alumno');

    const reintento = await request(app).post('/api/lti/exchange').send({ code });
    expect(reintento.status).toBe(400);
  });

  test('un id_token con nonce equivocado se rechaza (401)', async () => {
    const loginRes = await request(app).get('/api/lti/login').query({ iss: 'https://lms-de-prueba.test', login_hint: 'x', client_id: 'tool-client-id-123' });
    const otroState = new URL(loginRes.headers.location).searchParams.get('state');
    const idToken = plataformaFalsa.firmarIdToken(claimsBase({ nonce: 'nonce-incorrecto' }));
    const res = await request(app).post('/api/lti/launch').type('form').send({ id_token: idToken, state: otroState });
    expect(res.status).toBe(401);
  });

  test('un id_token firmado por OTRA clave (no la de la plataforma registrada) se rechaza', async () => {
    const loginRes = await request(app).get('/api/lti/login').query({ iss: 'https://lms-de-prueba.test', login_hint: 'x', client_id: 'tool-client-id-123' });
    const otroState = new URL(loginRes.headers.location).searchParams.get('state');
    const otroNonce = new URL(loginRes.headers.location).searchParams.get('nonce');

    const { privateKey: clavePirata } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    const idTokenFalso = jwt.sign(claimsBase({ nonce: otroNonce }), clavePirata, { algorithm: 'RS256', keyid: plataformaFalsa.kid });

    const res = await request(app).post('/api/lti/launch').type('form').send({ id_token: idTokenFalso, state: otroState });
    expect(res.status).toBe(401);
  });

  test('completar el curso manda el passback de la nota a la plataforma (AGS de punta a punta)', async () => {
    const usuario = await db('users').where({ email: 'alumno-lti@escuela.demo' }).first();
    const loginProfesor = await request(app).post('/api/auth/login').send({ email: 'profe-lti@escuela.demo', password: '123456' });

    const res = await request(app)
      .put(`/api/classroom/courses/${cursoId}/students/${usuario.id}/complete`)
      .set('Authorization', `Bearer ${loginProfesor.body.token}`);
    expect(res.status).toBe(200);

    // El passback se dispara sin await (fire-and-forget) — le damos un
    // instante a la plataforma falsa para recibirlo.
    await new Promise((r) => setTimeout(r, 300));

    expect(plataformaFalsa.scoresRecibidos).toHaveLength(1);
    const recibido = plataformaFalsa.scoresRecibidos[0];
    expect(recibido.headers.authorization).toBe('Bearer fake-access-token-de-la-plataforma');
    expect(recibido.body.userId).toBe('lti-user-sub-1');
    expect(recibido.body.scoreGiven).toBe(1);
    expect(recibido.body.scoreMaximum).toBe(1);
    expect(recibido.body.activityProgress).toBe('Completed');
    expect(recibido.body.gradingProgress).toBe('FullyGraded');
  });

  test('CRUD de plataformas: listar, editar, activar/desactivar, borrar', async () => {
    const listar = await request(app).get('/api/admin/lti/plataformas').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(listar.body.plataformas.map((p) => p.id)).toContain(plataformaId);

    const desactivar = await request(app).put(`/api/admin/lti/plataformas/${plataformaId}/activo`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(desactivar.body.plataforma.activo).toBe(false);

    // Con la plataforma desactivada, un login nuevo tiene que rechazarse.
    const loginDesactivada = await request(app).get('/api/lti/login').query({ iss: 'https://lms-de-prueba.test', login_hint: 'x', client_id: 'tool-client-id-123' });
    expect(loginDesactivada.status).toBe(400);

    const reactivar = await request(app).put(`/api/admin/lti/plataformas/${plataformaId}/activo`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(reactivar.body.plataforma.activo).toBe(true);

    const borrar = await request(app).delete(`/api/admin/lti/plataformas/${plataformaId}`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(borrar.status).toBe(200);
  });

  test('un no-admin no puede administrar plataformas LTI', async () => {
    const loginProfesor = await request(app).post('/api/auth/login').send({ email: 'profe-lti@escuela.demo', password: '123456' });
    const res = await request(app).get('/api/admin/lti/plataformas').set('Authorization', `Bearer ${loginProfesor.body.token}`);
    expect(res.status).toBe(403);
  });
});
