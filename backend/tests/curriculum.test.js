process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-curriculum.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, '..', 'data', 'test-curriculum.sqlite3');

describe('Curriculum del curso (unidades, capítulos, progreso, comentarios)', () => {
  let app;
  let db;
  let tokenProfesor;
  let tokenOtroProfesor;
  let tokenAlumno;
  let tokenAlumnoSinInscripcion;
  let cursoId;
  let unitId;
  let chapterId;
  let chapter2Id;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    await db('achievements').insert({ codigo: 'curso_completado', titulo: 'Curso completado', descripcion: '', icono: '🎓' });

    app = require('../src/app');

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const hash = await bcrypt.hash('123456', 10);

    const [profesorId] = await db('users').insert({
      nombre: 'Profe', apellido: 'Curriculum', email: 'profe-curriculum@escuela.demo', password_hash: hash, rol: 'profesor',
    });
    tokenProfesor = jwt.sign({ id: profesorId, email: 'profe-curriculum@escuela.demo', rol: 'profesor', nombre: 'Profe' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const [otroProfesorId] = await db('users').insert({
      nombre: 'Otro', apellido: 'Profe', email: 'otro-profe-curriculum@escuela.demo', password_hash: hash, rol: 'profesor',
    });
    tokenOtroProfesor = jwt.sign({ id: otroProfesorId, email: 'otro-profe-curriculum@escuela.demo', rol: 'profesor', nombre: 'Otro' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    [cursoId] = await db('courses').insert({ titulo: 'Curso con temario', descripcion: 'x', precio: 1000, profesor_id: profesorId });

    const alumno = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'Curriculum', email: 'alumno-curriculum@escuela.demo', password: '123456',
    });
    tokenAlumno = alumno.body.token;
    await db('enrollments').insert({ user_id: alumno.body.user.id, course_id: cursoId });

    const alumnoSinInscripcion = await request(app).post('/api/auth/register').send({
      nombre: 'Alumno', apellido: 'SinCurso', email: 'alumno-sincurso@escuela.demo', password: '123456',
    });
    tokenAlumnoSinInscripcion = alumnoSinInscripcion.body.token;
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('un profesor que no es dueño del curso no puede crear unidades', async () => {
    const res = await request(app)
      .post(`/api/classroom/courses/${cursoId}/units`)
      .set('Authorization', `Bearer ${tokenOtroProfesor}`)
      .send({ titulo: 'Unidad trucha' });
    expect(res.status).toBe(403);
  });

  test('el profesor dueño crea una unidad', async () => {
    const res = await request(app)
      .post(`/api/classroom/courses/${cursoId}/units`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ titulo: 'Unidad 1', introduccion: 'Intro', contenido: 'Qué vas a ver' });
    expect(res.status).toBe(201);
    expect(res.body.unit.titulo).toBe('Unidad 1');
    unitId = res.body.unit.id;
  });

  test('el profesor dueño crea dos capítulos en orden', async () => {
    const r1 = await request(app)
      .post(`/api/classroom/units/${unitId}/chapters`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ titulo: 'Capítulo 1', video_url: 'https://www.youtube.com/watch?v=abc123' });
    expect(r1.status).toBe(201);
    chapterId = r1.body.chapter.id;

    const r2 = await request(app)
      .post(`/api/classroom/units/${unitId}/chapters`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ titulo: 'Capítulo 2', video_url: 'https://vimeo.com/12345' });
    expect(r2.status).toBe(201);
    chapter2Id = r2.body.chapter.id;
    expect(r2.body.chapter.orden).toBe(1);
  });

  test('un alumno no inscripto no puede ver el curriculum', async () => {
    const res = await request(app)
      .get(`/api/classroom/courses/${cursoId}/curriculum`)
      .set('Authorization', `Bearer ${tokenAlumnoSinInscripcion}`);
    expect(res.status).toBe(403);
  });

  test('el alumno inscripto ve el curriculum, todo desbloqueado por defecto (modo libre)', async () => {
    const res = await request(app)
      .get(`/api/classroom/courses/${cursoId}/curriculum`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
    expect(res.body.modo_avance).toBe('libre');
    const capitulos = res.body.unidades[0].capitulos;
    expect(capitulos.every((c) => c.desbloqueado)).toBe(true);
  });

  test('el profesor cambia el curso a modo continuo', async () => {
    const res = await request(app)
      .put(`/api/classroom/courses/${cursoId}/settings`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ modo_avance: 'continuo' });
    expect(res.status).toBe(200);
    expect(res.body.course.modo_avance).toBe('continuo');
  });

  test('en modo continuo, el alumno no puede ver el detalle del segundo capítulo todavía', async () => {
    const res = await request(app)
      .get(`/api/classroom/chapters/${chapter2Id}`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(403);
  });

  test('el profesor SÍ puede previsualizar el segundo capítulo aunque esté bloqueado para el alumno', async () => {
    const res = await request(app)
      .get(`/api/classroom/chapters/${chapter2Id}`)
      .set('Authorization', `Bearer ${tokenProfesor}`);
    expect(res.status).toBe(200);
  });

  test('no se puede marcar como visto sin haber reportado progreso', async () => {
    const res = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/complete`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(400);
  });

  test('reportar 50% de progreso no alcanza para marcar como visto', async () => {
    const progreso = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/progress`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ segundos_actuales: 50, duracion_segundos: 100 });
    expect(progreso.status).toBe(200);
    expect(progreso.body.porcentaje_visto).toBe(50);

    const completar = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/complete`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(completar.status).toBe(400);
    expect(completar.body.error).toMatch(/80%/);
  });

  test('adelantar y volver atrás no baja el progreso ya ganado (se guarda el máximo)', async () => {
    await request(app)
      .post(`/api/classroom/chapters/${chapterId}/progress`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ segundos_actuales: 90, duracion_segundos: 100 });

    const res = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/progress`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ segundos_actuales: 20, duracion_segundos: 100 });
    expect(res.body.porcentaje_visto).toBe(90);
  });

  test('con 90% visto, ya se puede marcar el capítulo como visto, y eso desbloquea el siguiente', async () => {
    const completar = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/complete`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(completar.status).toBe(200);

    const detalle = await request(app)
      .get(`/api/classroom/chapters/${chapter2Id}`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.desbloqueado).toBe(true);
    expect(detalle.body.anterior_id).toBe(chapterId);
  });

  test('el profesor desactiva la exigencia del 80% y ahora el alumno puede marcar el segundo capítulo como visto sin haberlo mirado', async () => {
    await request(app)
      .put(`/api/classroom/courses/${cursoId}/settings`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ exigir_80_porciento: false });

    const res = await request(app)
      .post(`/api/classroom/chapters/${chapter2Id}/complete`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.status).toBe(200);
  });

  test('al completar todos los capítulos del curso se otorga el logro de curso completado', async () => {
    const logros = await request(app)
      .get('/api/achievements/mine')
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(logros.body.achievements.some((a) => a.codigo === 'curso_completado')).toBe(true);
  });

  test('comentarios: el alumno comenta, el profesor lo ve, y el alumno lo puede borrar (es el autor)', async () => {
    const crear = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/comments`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ texto: '¿Alguien más se trabó en el minuto 3?' });
    expect(crear.status).toBe(201);
    const commentId = crear.body.comment.id;

    const listar = await request(app)
      .get(`/api/classroom/chapters/${chapterId}/comments`)
      .set('Authorization', `Bearer ${tokenProfesor}`);
    expect(listar.status).toBe(200);
    expect(listar.body.comments.length).toBe(1);

    const borrar = await request(app)
      .delete(`/api/classroom/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(borrar.status).toBe(200);
  });

  test('comentarios: el profesor responde y puede ocultar un comentario sin borrarlo (el alumno deja de verlo, pero la respuesta le queda)', async () => {
    const crear = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/comments`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ texto: 'Otra duda del alumno' });
    expect(crear.status).toBe(201);
    const preguntaId = crear.body.comment.id;

    // Un alumno no puede ocultar comentarios (ni el suyo propio) — para eso
    // ya existe borrar.
    const ocultarSinPermiso = await request(app)
      .put(`/api/classroom/comments/${preguntaId}/visibility`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ oculto: true });
    expect(ocultarSinPermiso.status).toBe(403);

    const responder = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/comments`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ texto: 'Respuesta del profesor', parent_comment_id: preguntaId });
    expect(responder.status).toBe(201);
    expect(responder.body.comment.parent_comment_id).toBe(preguntaId);

    const ocultar = await request(app)
      .put(`/api/classroom/comments/${preguntaId}/visibility`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ oculto: true });
    expect(ocultar.status).toBe(200);
    expect(ocultar.body.comment.oculto).toBeTruthy();

    const listaAlumno = await request(app)
      .get(`/api/classroom/chapters/${chapterId}/comments`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(listaAlumno.body.comments.find((c) => c.id === preguntaId)).toBeUndefined();
    expect(listaAlumno.body.comments.some((c) => c.texto === 'Respuesta del profesor')).toBe(true);

    const listaProfesor = await request(app)
      .get(`/api/classroom/chapters/${chapterId}/comments`)
      .set('Authorization', `Bearer ${tokenProfesor}`);
    const preguntaParaProfesor = listaProfesor.body.comments.find((c) => c.id === preguntaId);
    expect(preguntaParaProfesor.oculto).toBeTruthy();

    const mostrar = await request(app)
      .put(`/api/classroom/comments/${preguntaId}/visibility`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .send({ oculto: false });
    expect(mostrar.status).toBe(200);

    const listaAlumno2 = await request(app)
      .get(`/api/classroom/chapters/${chapterId}/comments`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(listaAlumno2.body.comments.find((c) => c.id === preguntaId)).toBeDefined();
  });

  test('archivos de utilidad: sin ninguno subido, la lista viene vacía', async () => {
    const res = await request(app)
      .get(`/api/classroom/chapters/${chapterId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(res.body.archivos).toEqual([]);
  });

  test('el profesor sube un archivo de utilidad y el alumno lo ve en el detalle del capítulo', async () => {
    const subir = await request(app)
      .post(`/api/classroom/chapters/${chapterId}/files`)
      .set('Authorization', `Bearer ${tokenProfesor}`)
      .attach('archivo', Buffer.from('contenido de prueba'), 'apunte.txt');
    expect(subir.status).toBe(201);
    expect(subir.body.file.archivo_nombre_original).toBe('apunte.txt');

    const detalle = await request(app)
      .get(`/api/classroom/chapters/${chapterId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(detalle.body.archivos.length).toBe(1);
  });

  test('borrar la unidad borra en cascada sus capítulos', async () => {
    const res = await request(app)
      .delete(`/api/classroom/units/${unitId}`)
      .set('Authorization', `Bearer ${tokenProfesor}`);
    expect(res.status).toBe(200);

    const detalle = await request(app)
      .get(`/api/classroom/chapters/${chapterId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`);
    expect(detalle.status).toBe(404);
  });
});
