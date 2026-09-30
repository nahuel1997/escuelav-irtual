process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-reportes.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-reportes.sqlite3');

// Reportes (datos + PDF + reenvío por mail con tope), encuestas de
// satisfacción, calificaciones internas y el asistente IA (con un cliente
// de la API simulado: nunca se llama a Anthropic en los tests).
describe('Reportes, encuestas, calificaciones y asistente', () => {
  let app;
  let db;
  let procesos;
  let tokenAdmin;
  let tokenAlumno;
  let tokenProfe;
  let alumnoId;
  let profeId;
  let cursoId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    app = require('../src/app');
    procesos = require('../src/services/procesos');
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);
    await db('users').insert({ nombre: 'Admin', apellido: 'T', email: 'admin-rep@escuela.demo', password_hash: hash, rol: 'admin' });
    [profeId] = await db('users').insert({ nombre: 'Profe', apellido: 'Uno', email: 'profe-rep@escuela.demo', password_hash: hash, rol: 'profesor' });
    const login = (email) => request(app).post('/api/auth/login').send({ email, password: '123456' }).then((r) => r.body.token);
    tokenAdmin = await login('admin-rep@escuela.demo');
    tokenProfe = await login('profe-rep@escuela.demo');
    const reg = await request(app).post('/api/auth/register').send({ nombre: 'Alu', apellido: 'Uno', email: 'alu-rep@escuela.demo', password: '123456' });
    tokenAlumno = reg.body.token;
    alumnoId = reg.body.user.id;

    [cursoId] = await db('courses').insert({ titulo: 'Excel', descripcion: 'd', precio: 1000, estado: 'subido', profesor_id: profeId });
    const [unidad] = await db('course_units').insert({ course_id: cursoId, titulo: 'U1', orden: 1 });
    const [c1] = await db('course_chapters').insert({ unit_id: unidad, titulo: 'C1', video_url: 'x', orden: 1 });
    await db('course_chapters').insert({ unit_id: unidad, titulo: 'C2', video_url: 'x', orden: 2 });
    await db('enrollments').insert({ user_id: alumnoId, course_id: cursoId });
    await db('chapter_progress').insert({ user_id: alumnoId, chapter_id: c1, completado: true, porcentaje_visto: 100 });
    await db('payment_orders').insert({ user_id: alumnoId, provider: 'mercadopago', status: 'aprobado', items: JSON.stringify([{ course_id: cursoId, titulo: 'Excel', precio: 1000 }]), total: 1000, moneda: 'ARS' });
  });

  afterAll(async () => {
    require('../src/services/asistente').setCliente(null);
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    fs.rmSync(require('../src/services/storage.service').PRIVADO_ROOT, { recursive: true, force: true });
  });

  const comoAdmin = (r) => r.set('Authorization', `Bearer ${tokenAdmin}`);

  describe('Reportes', () => {
    test('ventas, inscripciones, progreso y profesores', async () => {
      const ventas = await comoAdmin(request(app).get('/api/admin/reportes/ventas'));
      expect(ventas.body.totalOrdenes).toBe(1);
      expect(ventas.body.porMoneda.ARS).toBe(1000);
      expect(ventas.body.cursosMasVendidos[0].titulo).toBe('Excel');

      const insc = await comoAdmin(request(app).get('/api/admin/reportes/inscripciones'));
      expect(insc.body.cursos[0].alumnosTotales).toBe(1);

      const prog = await comoAdmin(request(app).get(`/api/admin/reportes/progreso?courseId=${cursoId}`));
      expect(prog.body.cursos[0].alumnos[0].porcentaje).toBe(50);

      const prof = await comoAdmin(request(app).get('/api/admin/reportes/profesores'));
      expect(prof.body.profesores[0].alumnos).toBe(1);

      expect((await comoAdmin(request(app).get('/api/admin/reportes/cualquiera'))).status).toBe(400);
      expect((await request(app).get('/api/admin/reportes/ventas').set('Authorization', `Bearer ${tokenAlumno}`)).status).toBe(403);
    });

    test('el PDF del reporte sale por procesos y se puede mandar por mail', async () => {
      const r = await comoAdmin(request(app).post('/api/procesos')).send({ tipo: 'reporte_admin', parametros: { reporte: 'ventas', destinatario: 'contador@ejemplo.com', mensaje: '<b>Hola</b>' } });
      expect(r.status).toBe(201);
      await procesos.procesarPendientes();
      const p = await comoAdmin(request(app).get(`/api/procesos/${r.body.proceso.id}`));
      expect(p.body.proceso.estado).toBe('terminado');
      expect(p.body.proceso.resultado.enviadoA).toBe('contador@ejemplo.com');
      const mail = await db('mail_log').where({ tipo: 'reenvio_pdf' }).first();
      expect(mail.asunto).toMatch(/^Escuela Online — /);
      expect(mail.cuerpo).toContain('&lt;b&gt;Hola&lt;/b&gt;');
    });

    test('un alumno no puede pedir el reporte de admin, pero sí su propio progreso', async () => {
      expect((await request(app).post('/api/procesos').set('Authorization', `Bearer ${tokenAlumno}`).send({ tipo: 'reporte_admin', parametros: { reporte: 'ventas' } })).status).toBe(403);
      const r = await request(app).post('/api/procesos').set('Authorization', `Bearer ${tokenAlumno}`).send({ tipo: 'mi_progreso' });
      expect(r.status).toBe(201);
      await procesos.procesarPendientes();
      expect((await db('procesos').where({ id: r.body.proceso.id }).first()).estado).toBe('terminado');
    });

    test('reenvío por mail: valida el destino y corta a los 15 por hora', async () => {
      expect((await request(app).post('/api/procesos').set('Authorization', `Bearer ${tokenProfe}`).send({ tipo: 'mi_progreso', parametros: { destinatario: 'no-es-mail' } })).status).toBe(400);
      await db('envios_pdf').insert(Array.from({ length: 15 }, () => ({ user_id: profeId, destinatario: 'x@y.com' })));
      const r = await request(app).post('/api/procesos').set('Authorization', `Bearer ${tokenProfe}`).send({ tipo: 'mi_progreso', parametros: { destinatario: 'x@y.com' } });
      expect(r.status).toBe(429);
    });
  });

  describe('Encuestas', () => {
    test('el alumno califica un curso inscripto una sola vez, validado', async () => {
      const pend = await request(app).get('/api/encuestas').set('Authorization', `Bearer ${tokenAlumno}`);
      expect(pend.body.cursos[0].respondida).toBe(false);
      const preguntas = pend.body.preguntas;
      const escala = preguntas.filter((p) => p.tipo === 'escala');
      const siNo = preguntas.find((p) => p.tipo === 'si_no');
      const texto = preguntas.find((p) => p.tipo === 'texto');

      const mala = await request(app).post(`/api/encuestas/${cursoId}`).set('Authorization', `Bearer ${tokenAlumno}`).send({ respuestas: [{ preguntaId: escala[0].id, valor: 9 }] });
      expect(mala.status).toBe(400);

      const respuestas = [...escala.map((p) => ({ preguntaId: p.id, valor: 4 })), { preguntaId: siNo.id, valor: true }, { preguntaId: texto.id, texto: 'Más ejercicios' }];
      expect((await request(app).post(`/api/encuestas/${cursoId}`).set('Authorization', `Bearer ${tokenAlumno}`).send({ respuestas })).status).toBe(201);
      expect((await request(app).post(`/api/encuestas/${cursoId}`).set('Authorization', `Bearer ${tokenAlumno}`).send({ respuestas })).status).toBe(409);

      const res = await comoAdmin(request(app).get('/api/admin/encuestas/resultados'));
      expect(res.body.respondieron).toBe(1);
      expect(res.body.preguntas.find((p) => p.tipo === 'escala').promedio).toBe(4);
      expect(res.body.preguntas.find((p) => p.tipo === 'texto').comentarios[0].texto).toBe('Más ejercicios');
    });

    test('no se califica un curso ajeno; una pregunta respondida no se borra ni cambia de tipo', async () => {
      const [otro] = await db('courses').insert({ titulo: 'Otro', descripcion: 'd', precio: 0, estado: 'subido' });
      expect((await request(app).post(`/api/encuestas/${otro}`).set('Authorization', `Bearer ${tokenAlumno}`).send({ respuestas: [] })).status).toBe(403);
      const p = (await db('encuesta_preguntas').where({ tipo: 'escala' }).first());
      expect((await comoAdmin(request(app).delete(`/api/admin/encuestas/preguntas/${p.id}`))).status).toBe(409);
      expect((await comoAdmin(request(app).put(`/api/admin/encuestas/preguntas/${p.id}`)).send({ tipo: 'texto' })).status).toBe(409);
      expect((await comoAdmin(request(app).put(`/api/admin/encuestas/preguntas/${p.id}`)).send({ activa: false })).status).toBe(200);
    });
  });

  describe('Calificaciones internas', () => {
    test('el admin califica y adjunta; se refleja en el resumen', async () => {
      expect((await comoAdmin(request(app).post(`/api/admin/calificaciones/${profeId}`)).send({ puntaje: 7, criterio: 'General' })).status).toBe(400);
      expect((await comoAdmin(request(app).post(`/api/admin/calificaciones/${profeId}`)).send({ puntaje: 5, criterio: 'Puntualidad', comentario: 'Siempre a horario' })).status).toBe(201);
      const adj = await comoAdmin(request(app).post(`/api/admin/calificaciones/${profeId}/adjuntos`)).attach('adjuntos', Buffer.from('%PDF-1.4'), { filename: 'evaluacion.pdf', contentType: 'application/pdf' });
      expect(adj.status).toBe(201);
      const det = await comoAdmin(request(app).get(`/api/admin/calificaciones/${profeId}`));
      expect(det.body.promedios.Puntualidad).toBe(5);
      expect(det.body.adjuntos).toHaveLength(1);
      expect((await comoAdmin(request(app).get(`/api/admin/calificaciones/${profeId}/adjuntos/${det.body.adjuntos[0].id}`))).status).toBe(200);
      const resumen = await comoAdmin(request(app).get('/api/admin/calificaciones'));
      expect(resumen.body.profesores[0].calificacionInterna).toBe(5);
      expect(resumen.body.profesores[0].encuestaAlumnos).toBe(4);
      // No es un profesor: 404.
      expect((await comoAdmin(request(app).get(`/api/admin/calificaciones/${alumnoId}`))).status).toBe(404);
    });
  });

  describe('Asistente IA', () => {
    const asistente = require('../src/services/asistente');

    test('sin ANTHROPIC_API_KEY avisa que no está configurado', async () => {
      const clave = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      asistente.setCliente(null);
      const r = await comoAdmin(request(app).post('/api/admin/asistente')).send({ mensaje: 'hola' });
      expect(r.status).toBe(503);
      if (clave) process.env.ANTHROPIC_API_KEY = clave;
    });

    test('usa las herramientas, guarda el historial completo sin editarlo y muestra solo los textos', async () => {
      const pedidos = [];
      asistente.setCliente({
        beta: {
          messages: {
            create: async (params) => {
              pedidos.push(JSON.parse(JSON.stringify(params)));
              if (pedidos.length === 1) {
                return { stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 }, content: [
                  { type: 'thinking', thinking: '', signature: 'firma' },
                  { type: 'tool_use', id: 'tu_1', name: 'resumen_general', input: {} },
                  { type: 'tool_use', id: 'tu_2', name: 'buscar_usuarios', input: { texto: 'alu' } },
                ] };
              }
              return { stop_reason: 'end_turn', usage: { input_tokens: 20, output_tokens: 8 }, content: [{ type: 'text', text: 'Hay 1 alumno.' }] };
            },
          },
        },
      });
      const r = await comoAdmin(request(app).post('/api/admin/asistente')).send({ mensaje: '¿Cuántos alumnos hay?' });
      expect(r.status).toBe(200);
      expect(r.body.respuesta).toBe('Hay 1 alumno.');
      expect(r.body.herramientas).toEqual(['resumen_general', 'buscar_usuarios']);

      // El pedido: modelo, fallbacks por defecto, herramientas estrictas.
      expect(pedidos[0].model).toBe('claude-opus-5-5');
      expect(pedidos[0].fallbacks).toBe('default');
      expect(pedidos[0].betas).toContain('server-side-fallback-2026-07-01');
      expect(pedidos[0].tools.every((t) => t.strict === true)).toBe(true);
      // Segunda vuelta: el turno del asistente sin tocar + UN solo mensaje con los dos resultados.
      const ultimo = pedidos[1].messages.at(-1);
      expect(ultimo.content.map((c) => c.tool_use_id)).toEqual(['tu_1', 'tu_2']);
      expect(JSON.parse(ultimo.content[0].content).usuariosPorRol.alumno).toBe(1);
      expect(pedidos[1].messages.at(-2).content[0]).toEqual({ type: 'thinking', thinking: '', signature: 'firma' });

      const conv = await comoAdmin(request(app).get(`/api/admin/asistente/${r.body.conversacionId}`));
      expect(conv.body.conversacion.mensajes).toEqual([{ rol: 'admin', texto: '¿Cuántos alumnos hay?' }, { rol: 'asistente', texto: 'Hay 1 alumno.' }]);

      // Seguir la conversación agrega al final (append-only).
      await comoAdmin(request(app).post('/api/admin/asistente')).send({ conversacionId: r.body.conversacionId, mensaje: '¿Y profesores?' });
      expect(pedidos[2].messages.slice(0, pedidos[1].messages.length + 1)).toEqual([...pedidos[1].messages, { role: 'assistant', content: [{ type: 'text', text: 'Hay 1 alumno.' }] }]);
    });

    test('un rechazo del modelo se informa sin romper', async () => {
      asistente.setCliente({ beta: { messages: { create: async () => ({ stop_reason: 'refusal', usage: {}, content: [] }) } } });
      const r = await comoAdmin(request(app).post('/api/admin/asistente')).send({ mensaje: 'algo' });
      expect(r.status).toBe(200);
      expect(r.body.aviso).toMatch(/no quiso/);
    });
  });
});
