process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-ai.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-ai.sqlite3');

// Mockeamos fetch global (mismo criterio que paymentsService.test.js con
// PayPal): estos tests nunca pegan de verdad a OpenAI/Anthropic/Google,
// siempre simulan la respuesta según a qué URL se le pegó.
function mockFetchSegunProveedor({ ok = true } = {}) {
  global.fetch = jest.fn((url) => {
    if (String(url).includes('api.openai.com')) {
      return Promise.resolve({
        ok,
        status: ok ? 200 : 401,
        json: async () => (ok ? { choices: [{ message: { content: 'Respuesta simulada de ChatGPT' } }] } : { error: 'invalid key' }),
      });
    }
    if (String(url).includes('api.anthropic.com')) {
      return Promise.resolve({
        ok,
        status: ok ? 200 : 401,
        json: async () => (ok ? { content: [{ text: 'Respuesta simulada de Claude' }] } : { error: 'invalid key' }),
      });
    }
    if (String(url).includes('generativelanguage.googleapis.com')) {
      return Promise.resolve({
        ok,
        status: ok ? 200 : 401,
        json: async () => (ok ? { candidates: [{ content: { parts: [{ text: 'Respuesta simulada de Gemini' }] } }] } : { error: 'invalid key' }),
      });
    }
    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

describe('Integraciones IA', () => {
  let app;
  let db;
  let tokenAlumno;
  let tokenAlumno2;
  let tokenProfesor;
  let tokenAdmin;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    await require('../src/db/seeds/004_ai_integration_templates').seed(db);
    app = require('../src/app');

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'IA', email: 'alumno-ia@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;

    const alumno2 = await request(app).post('/api/auth/register').send({
      nombre: 'Otro', apellido: 'Alumno', email: 'alumno-ia-2@escuela.demo', password: '123456',
    });
    tokenAlumno2 = alumno2.body.token;

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Profe', apellido: 'IA', email: 'profe-ia@escuela.demo', password_hash: hash, rol: 'profesor' });
    const loginProfesor = await request(app).post('/api/auth/login').send({ email: 'profe-ia@escuela.demo', password: '123456' });
    tokenProfesor = loginProfesor.body.token;

    await db('users').insert({ nombre: 'Admin', apellido: 'IA', email: 'admin-ia@escuela.demo', password_hash: hash, rol: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin-ia@escuela.demo', password: '123456' });
    tokenAdmin = loginAdmin.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  beforeEach(() => {
    mockFetchSegunProveedor({ ok: true });
  });

  test('sin token, todo /api/ai/* da 401', async () => {
    const res = await request(app).get('/api/ai/proveedores');
    expect(res.status).toBe(401);
  });

  test('es solo para alumnos: profesor y admin dan 403', async () => {
    const resProfesor = await request(app).get('/api/ai/proveedores').set('Authorization', `Bearer ${tokenProfesor}`);
    expect(resProfesor.status).toBe(403);
    const resAdmin = await request(app).get('/api/ai/proveedores').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resAdmin.status).toBe(403);
  });

  test('GET /ai/proveedores devuelve las 3 IAs con su instructivo y sin vincular todavía', async () => {
    const res = await request(app).get('/api/ai/proveedores').set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.proveedores.map((p) => p.clave)).toEqual(expect.arrayContaining(['chatgpt', 'claude', 'gemini']));
    const chatgpt = res.body.proveedores.find((p) => p.clave === 'chatgpt');
    expect(chatgpt.vinculado).toBe(false);
    expect(chatgpt.apiKeyPreview).toBeNull();
    expect(chatgpt.instructivoHtml).toMatch(/platform\.openai\.com/);
  });

  describe('Vinculaciones', () => {
    test('vincular sin API key da 400', async () => {
      const res = await request(app).post('/api/ai/vinculaciones/chatgpt').set('Authorization', `Bearer ${tokenAlumno}`).send({});
      expect(res.status).toBe(400);
    });

    test('vincular una IA que no existe da 404', async () => {
      const res = await request(app).post('/api/ai/vinculaciones/no-existe').set('Authorization', `Bearer ${tokenAlumno}`).send({ apiKey: 'x' });
      expect(res.status).toBe(404);
    });

    test('vincular guarda la key cifrada y devuelve solo un preview (nunca la key completa)', async () => {
      const res = await request(app)
        .post('/api/ai/vinculaciones/chatgpt')
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ apiKey: 'sk-secreta-1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.link).toEqual(expect.objectContaining({ proveedor: 'chatgpt', activo: true, apiKeyPreview: '••••7890' }));
      expect(JSON.stringify(res.body)).not.toMatch(/sk-secreta-1234567890/);

      const fila = await db('ai_links').where({ proveedor: 'chatgpt' }).first();
      expect(fila.api_key_encriptada).not.toMatch(/sk-secreta-1234567890/);

      const proveedores = await request(app).get('/api/ai/proveedores').set('Authorization', `Bearer ${tokenAlumno}`);
      const chatgpt = proveedores.body.proveedores.find((p) => p.clave === 'chatgpt');
      expect(chatgpt.vinculado).toBe(true);
      expect(chatgpt.apiKeyPreview).toBe('••••7890');
    });

    test('vincular de nuevo pisa la key anterior, no duplica la fila', async () => {
      await request(app).post('/api/ai/vinculaciones/chatgpt').set('Authorization', `Bearer ${tokenAlumno}`).send({ apiKey: 'sk-nueva-key-9999' });
      const filas = await db('ai_links').where({ user_id: (await db('users').where({ email: 'alumno-ia@escuela.demo' }).first()).id, proveedor: 'chatgpt' });
      expect(filas).toHaveLength(1);
      expect(filas[0].api_key_preview).toBe('••••9999');
    });

    test('desvincular apaga el link sin borrar el historial', async () => {
      const res = await request(app).delete('/api/ai/vinculaciones/chatgpt').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(res.status).toBe(200);
      const proveedores = await request(app).get('/api/ai/proveedores').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(proveedores.body.proveedores.find((p) => p.clave === 'chatgpt').vinculado).toBe(false);
      // re-vincular para los tests siguientes
      await request(app).post('/api/ai/vinculaciones/chatgpt').set('Authorization', `Bearer ${tokenAlumno}`).send({ apiKey: 'sk-otra-vez-1111' });
    });
  });

  describe('Conversaciones y mensajes (chat real, con fetch mockeado)', () => {
    test('crear conversación de una IA no vinculada da 409', async () => {
      const res = await request(app).post('/api/ai/conversaciones').set('Authorization', `Bearer ${tokenAlumno}`).send({ proveedor: 'gemini' });
      expect(res.status).toBe(409);
    });

    test('flujo completo: vincular, crear conversación, mandar mensaje y recibir respuesta real (mockeada)', async () => {
      await request(app).post('/api/ai/vinculaciones/claude').set('Authorization', `Bearer ${tokenAlumno}`).send({ apiKey: 'sk-ant-test-key' });

      const crear = await request(app).post('/api/ai/conversaciones').set('Authorization', `Bearer ${tokenAlumno}`).send({ proveedor: 'claude', titulo: 'Dudas de historia' });
      expect(crear.status).toBe(201);
      expect(crear.body.conversacion.titulo).toBe('Dudas de historia');
      const conversacionId = crear.body.conversacion.id;

      const mensaje1 = await request(app)
        .post(`/api/ai/conversaciones/${conversacionId}/mensajes`)
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ contenido: '¿Quién fue San Martín?' });

      expect(mensaje1.status).toBe(201);
      expect(mensaje1.body.mensajeUsuario.contenido).toBe('¿Quién fue San Martín?');
      expect(mensaje1.body.mensajeAsistente.rol).toBe('assistant');
      expect(mensaje1.body.mensajeAsistente.contenido).toBe('Respuesta simulada de Claude');

      // El fetch mockeado le pegó a Anthropic con el mensaje del alumno
      // en el body.
      const ultimaLlamada = global.fetch.mock.calls.at(-1);
      expect(ultimaLlamada[0]).toBe('https://api.anthropic.com/v1/messages');
      const bodyMandado = JSON.parse(ultimaLlamada[1].body);
      expect(bodyMandado.messages).toEqual([{ role: 'user', content: '¿Quién fue San Martín?' }]);

      const mensajes = await request(app).get(`/api/ai/conversaciones/${conversacionId}/mensajes`).set('Authorization', `Bearer ${tokenAlumno}`);
      expect(mensajes.body.mensajes).toHaveLength(2);
    });

    test('el segundo mensaje de la conversación manda el historial completo como contexto', async () => {
      const conversaciones = await request(app).get('/api/ai/conversaciones?proveedor=claude').set('Authorization', `Bearer ${tokenAlumno}`);
      const conversacionId = conversaciones.body.conversaciones[0].id;

      await request(app)
        .post(`/api/ai/conversaciones/${conversacionId}/mensajes`)
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ contenido: '¿Y qué batallas ganó?' });

      const ultimaLlamada = global.fetch.mock.calls.at(-1);
      const bodyMandado = JSON.parse(ultimaLlamada[1].body);
      expect(bodyMandado.messages).toHaveLength(3); // pregunta 1 + respuesta 1 + pregunta 2
      expect(bodyMandado.messages[2]).toEqual({ role: 'user', content: '¿Y qué batallas ganó?' });
    });

    test('si la IA falla (API key inválida), el mensaje del alumno igual queda guardado', async () => {
      mockFetchSegunProveedor({ ok: false });

      const crear = await request(app).post('/api/ai/conversaciones').set('Authorization', `Bearer ${tokenAlumno}`).send({ proveedor: 'chatgpt' });
      const conversacionId = crear.body.conversacion.id;

      const res = await request(app)
        .post(`/api/ai/conversaciones/${conversacionId}/mensajes`)
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ contenido: 'Hola' });

      expect(res.status).toBe(422);

      const mensajes = await request(app).get(`/api/ai/conversaciones/${conversacionId}/mensajes`).set('Authorization', `Bearer ${tokenAlumno}`);
      expect(mensajes.body.mensajes).toHaveLength(1);
      expect(mensajes.body.mensajes[0].contenido).toBe('Hola');
    });

    test('un alumno no puede ver ni mandar mensajes en la conversación de otro alumno', async () => {
      await request(app).post('/api/ai/vinculaciones/gemini').set('Authorization', `Bearer ${tokenAlumno2}`).send({ apiKey: 'ai-key-alumno-2' });
      const crear = await request(app).post('/api/ai/conversaciones').set('Authorization', `Bearer ${tokenAlumno2}`).send({ proveedor: 'gemini' });
      const conversacionId = crear.body.conversacion.id;

      const verAjena = await request(app).get(`/api/ai/conversaciones/${conversacionId}/mensajes`).set('Authorization', `Bearer ${tokenAlumno}`);
      expect(verAjena.status).toBe(404);

      const mandarAjena = await request(app)
        .post(`/api/ai/conversaciones/${conversacionId}/mensajes`)
        .set('Authorization', `Bearer ${tokenAlumno}`)
        .send({ contenido: 'intento colado' });
      expect(mandarAjena.status).toBe(404);
    });
  });

  describe('Registros: solo se ven los chats de IAs vinculadas hoy', () => {
    test('desvincular una IA oculta sus conversaciones de "Registros" sin borrarlas', async () => {
      const antes = await request(app).get('/api/ai/conversaciones?proveedor=claude').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(antes.body.conversaciones.length).toBeGreaterThan(0);

      await request(app).delete('/api/ai/vinculaciones/claude').set('Authorization', `Bearer ${tokenAlumno}`);

      const despues = await request(app).get('/api/ai/conversaciones?proveedor=claude').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(despues.body.conversaciones).toEqual([]);

      const registroCompleto = await request(app).get('/api/ai/conversaciones').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(registroCompleto.body.conversaciones.some((c) => c.proveedor === 'claude')).toBe(false);

      // Volver a vincular restaura la visibilidad (los datos no se
      // perdieron, ver aiLink.model.js::desvincular).
      await request(app).post('/api/ai/vinculaciones/claude').set('Authorization', `Bearer ${tokenAlumno}`).send({ apiKey: 'sk-ant-de-nuevo' });
      const restaurado = await request(app).get('/api/ai/conversaciones?proveedor=claude').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(restaurado.body.conversaciones.length).toBeGreaterThan(0);
    });
  });

  describe('Admin — instructivos de Integraciones IA', () => {
    test('sin ser admin da 403', async () => {
      const res = await request(app).get('/api/admin/ai-templates').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(res.status).toBe(403);
    });

    test('listar devuelve las 3 plantillas seedeadas', async () => {
      const res = await request(app).get('/api/admin/ai-templates').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(200);
      expect(res.body.plantillas.map((p) => p.clave)).toEqual(expect.arrayContaining(['chatgpt', 'claude', 'gemini']));
    });

    test('editar con nombre vacío da 400', async () => {
      const res = await request(app).put('/api/admin/ai-templates/chatgpt').set('Authorization', `Bearer ${tokenAdmin}`).send({ nombre: '  ' });
      expect(res.status).toBe(400);
    });

    test('editar el instructivo lo persiste, y se refleja en lo que ve el alumno', async () => {
      const res = await request(app)
        .put('/api/admin/ai-templates/chatgpt')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ instructivo_html: '<p>Instructivo editado por el admin</p>' });
      expect(res.status).toBe(200);
      expect(res.body.plantilla.instructivo_html).toBe('<p>Instructivo editado por el admin</p>');

      const proveedores = await request(app).get('/api/ai/proveedores').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(proveedores.body.proveedores.find((p) => p.clave === 'chatgpt').instructivoHtml).toBe('<p>Instructivo editado por el admin</p>');
    });

    test('desactivar un instructivo hace que el alumno no lo vea (aunque la IA se siga pudiendo vincular)', async () => {
      await request(app).put('/api/admin/ai-templates/gemini').set('Authorization', `Bearer ${tokenAdmin}`).send({ activo: false });
      const proveedores = await request(app).get('/api/ai/proveedores').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(proveedores.body.proveedores.find((p) => p.clave === 'gemini').instructivoHtml).toBe('');
    });
  });
});
