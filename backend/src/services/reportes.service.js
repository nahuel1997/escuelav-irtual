// =============================================================================
// reportes.service.js — Reportes del panel (el equivalente escolar de los
// reportes de horas/contratos de DBA24): ventas, inscripciones, progreso de
// alumnos, actividad de profesores y encuestas. Cada uno devuelve datos
// para ver en pantalla y sabe armarse como PDF (ver armarPdf).
//
// Las cuentas de prueba del Tester (users.es_prueba) quedan afuera.
// Las agregaciones se hacen en JS para que anden igual en SQLite y Postgres.
// =============================================================================
const db = require('../config/db');
const { paraSql, aDate } = require('../utils/sqlFecha');
const { generarPdf } = require('../utils/pdfReporte');
const { AppError } = require('../middlewares/error.middleware');

const TIPOS = {
  ventas: 'Ventas',
  inscripciones: 'Inscripciones por curso',
  progreso: 'Progreso de alumnos',
  profesores: 'Actividad de profesores',
  encuestas: 'Encuestas de satisfacción',
};

function rango({ desde, hasta } = {}) {
  const h = hasta ? new Date(`${hasta}T23:59:59`) : new Date();
  const d = desde ? new Date(`${desde}T00:00:00`) : new Date(h.getTime() - 29 * 86400000);
  if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime()) || d > h) throw new AppError('Rango de fechas inválido', 400);
  return { desde: d, hasta: h };
}

const dinero = (n) => Math.round(Number(n || 0) * 100) / 100;

async function ventas(filtros) {
  const r = rango(filtros);
  const ordenes = await db('payment_orders as o')
    .join('users as u', 'u.id', 'o.user_id')
    .where('u.es_prueba', false)
    .where('o.status', 'aprobado')
    .where('o.created_at', '>=', paraSql(r.desde))
    .where('o.created_at', '<=', paraSql(r.hasta))
    .select('o.id', 'o.provider', 'o.total', 'o.moneda', 'o.items', 'o.created_at', 'o.paid_at', 'u.nombre', 'u.apellido', 'u.email')
    .orderBy('o.id', 'desc');
  const porMoneda = {};
  const porProveedor = {};
  const porDia = {};
  const porCurso = {};
  for (const o of ordenes) {
    porMoneda[o.moneda] = dinero((porMoneda[o.moneda] || 0) + Number(o.total));
    porProveedor[o.provider] = (porProveedor[o.provider] || 0) + 1;
    const dia = aDate(o.paid_at || o.created_at).toISOString().slice(0, 10);
    porDia[dia] = (porDia[dia] || 0) + 1;
    let items = [];
    try { items = JSON.parse(o.items); } catch (_e) { items = []; }
    items.forEach((it) => { porCurso[it.titulo] = (porCurso[it.titulo] || 0) + 1; });
  }
  // Inscripciones sin pasarela (checkout simulado / gratuitas) en el rango.
  const sinPasarela = await db('enrollments as e').join('users as u', 'u.id', 'e.user_id')
    .where('u.es_prueba', false).whereNull('e.payment_order_id')
    .where('e.purchased_at', '>=', paraSql(r.desde)).where('e.purchased_at', '<=', paraSql(r.hasta))
    .count({ c: '*' }).first();
  return {
    ...r,
    ordenes: ordenes.map((o) => ({ ...o, items: undefined })),
    totalOrdenes: ordenes.length,
    porMoneda,
    porProveedor,
    porDia: Object.entries(porDia).sort().map(([dia, cantidad]) => ({ dia, cantidad })),
    cursosMasVendidos: Object.entries(porCurso).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([titulo, cantidad]) => ({ titulo, cantidad })),
    inscripcionesSinPasarela: Number(sinPasarela.c),
  };
}

async function inscripciones(filtros) {
  const r = rango(filtros);
  const cursos = await db('courses as c').leftJoin('users as p', 'p.id', 'c.profesor_id')
    .select('c.id', 'c.titulo', 'c.precio', 'c.estado', 'p.nombre as profesor_nombre', 'p.apellido as profesor_apellido');
  const insc = await db('enrollments as e').join('users as u', 'u.id', 'e.user_id').where('u.es_prueba', false)
    .select('e.course_id', 'e.purchased_at', 'e.completado_at');
  const desdeMs = r.desde.getTime();
  const hastaMs = r.hasta.getTime();
  const filas = cursos.map((c) => {
    const propias = insc.filter((e) => e.course_id === c.id);
    const enRango = propias.filter((e) => { const t = aDate(e.purchased_at).getTime(); return t >= desdeMs && t <= hastaMs; });
    return {
      id: c.id,
      titulo: c.titulo,
      profesor: c.profesor_nombre ? `${c.profesor_nombre} ${c.profesor_apellido}` : '—',
      estado: c.estado,
      precio: dinero(c.precio),
      alumnosTotales: propias.length,
      nuevasEnRango: enRango.length,
      completados: propias.filter((e) => e.completado_at).length,
      ingresoEstimadoRango: dinero(enRango.length * Number(c.precio || 0)),
    };
  }).sort((a, b) => b.nuevasEnRango - a.nuevasEnRango || b.alumnosTotales - a.alumnosTotales);
  return {
    ...r,
    cursos: filas,
    totalNuevas: filas.reduce((s, f) => s + f.nuevasEnRango, 0),
    totalAlumnos: filas.reduce((s, f) => s + f.alumnosTotales, 0),
  };
}

// Progreso de cada alumno en cada curso (capítulos completados / total).
// Con courseId: un curso; con profesorId: sus cursos; con userId: un alumno.
async function progreso({ courseId, profesorId, userId } = {}) {
  const cursosQ = db('courses').select('id', 'titulo', 'profesor_id');
  if (courseId) cursosQ.where('id', courseId);
  if (profesorId) cursosQ.where('profesor_id', profesorId);
  const cursos = await cursosQ;
  const ids = cursos.map((c) => c.id);
  if (!ids.length) return { cursos: [] };

  const capitulos = await db('course_chapters as ch').join('course_units as un', 'un.id', 'ch.unit_id').whereIn('un.course_id', ids).select('ch.id', 'un.course_id');
  const totalPorCurso = {};
  const cursoDeCapitulo = {};
  capitulos.forEach((ch) => { totalPorCurso[ch.course_id] = (totalPorCurso[ch.course_id] || 0) + 1; cursoDeCapitulo[ch.id] = ch.course_id; });

  const inscQ = db('enrollments as e').join('users as u', 'u.id', 'e.user_id').whereIn('e.course_id', ids).where('u.es_prueba', false)
    .select('e.user_id', 'e.course_id', 'e.purchased_at', 'e.completado_at', 'u.nombre', 'u.apellido', 'u.email');
  if (userId) inscQ.where('e.user_id', userId);
  const insc = await inscQ;

  const progresos = capitulos.length
    ? await db('chapter_progress').whereIn('chapter_id', capitulos.map((c) => c.id)).where('completado', true).whereIn('user_id', [...new Set(insc.map((i) => i.user_id))].concat([-1])).select('user_id', 'chapter_id')
    : [];
  const completados = {};
  progresos.forEach((p) => {
    const k = `${p.user_id}|${cursoDeCapitulo[p.chapter_id]}`;
    completados[k] = (completados[k] || 0) + 1;
  });

  return {
    cursos: cursos.map((c) => {
      const total = totalPorCurso[c.id] || 0;
      const alumnos = insc.filter((i) => i.course_id === c.id).map((i) => {
        const hechos = completados[`${i.user_id}|${c.id}`] || 0;
        return {
          userId: i.user_id,
          alumno: `${i.nombre} ${i.apellido}`,
          email: i.email,
          inscripto: i.purchased_at,
          capitulosCompletados: hechos,
          capitulosTotales: total,
          porcentaje: total ? Math.round((hechos / total) * 100) : 0,
          completado: Boolean(i.completado_at),
        };
      }).sort((a, b) => b.porcentaje - a.porcentaje);
      return {
        id: c.id,
        titulo: c.titulo,
        capitulos: total,
        alumnos,
        promedio: alumnos.length ? Math.round(alumnos.reduce((s, a) => s + a.porcentaje, 0) / alumnos.length) : 0,
      };
    }),
  };
}

async function profesores(filtros) {
  const r = rango(filtros);
  const lista = await db('users').where({ rol: 'profesor', es_prueba: false }).select('id', 'nombre', 'apellido', 'email', 'activo');
  const cursos = await db('courses').select('id', 'profesor_id');
  const insc = await db('enrollments').select('course_id');
  const clases = await db('live_classes').where('estado', 'finalizada')
    .where('scheduled_at', '>=', paraSql(r.desde)).where('scheduled_at', '<=', paraSql(r.hasta)).select('course_id');
  const turnos = await db('calendar_events').where('estado', 'aceptada')
    .where('starts_at', '>=', paraSql(r.desde)).where('starts_at', '<=', paraSql(r.hasta)).select('profesor_id').catch(() => []);
  const calif = await db('profesor_calificaciones').select('profesor_id', 'puntaje').catch(() => []);
  const encuesta = await db('encuesta_respuestas as r').join('encuesta_preguntas as p', 'p.id', 'r.pregunta_id').join('courses as c', 'c.id', 'r.course_id')
    .where('p.tipo', 'escala').whereNotNull('r.valor').select('c.profesor_id', 'r.valor').catch(() => []);

  const prom = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + Number(x), 0) / xs.length) * 10) / 10 : null);
  return {
    ...r,
    profesores: lista.map((p) => {
      const suyos = cursos.filter((c) => c.profesor_id === p.id).map((c) => c.id);
      return {
        id: p.id,
        profesor: `${p.nombre} ${p.apellido}`,
        email: p.email,
        activo: Boolean(p.activo),
        cursos: suyos.length,
        alumnos: insc.filter((e) => suyos.includes(e.course_id)).length,
        clasesDadas: clases.filter((c) => suyos.includes(c.course_id)).length,
        turnosAtendidos: turnos.filter((t) => t.profesor_id === p.id).length,
        calificacionInterna: prom(calif.filter((c) => c.profesor_id === p.id).map((c) => c.puntaje)),
        encuestaAlumnos: prom(encuesta.filter((e) => e.profesor_id === p.id).map((e) => e.valor)),
      };
    }),
  };
}

async function encuestas({ courseId } = {}) {
  const preguntas = await db('encuesta_preguntas').orderBy('orden').orderBy('id');
  const q = db('encuesta_respuestas as r').join('courses as c', 'c.id', 'r.course_id').join('users as u', 'u.id', 'r.user_id')
    .where('u.es_prueba', false).select('r.*', 'c.titulo as curso');
  if (courseId) q.where('r.course_id', courseId);
  const respuestas = await q;
  const personas = new Set(respuestas.map((x) => `${x.user_id}|${x.course_id}`));
  return {
    respondieron: personas.size,
    preguntas: preguntas.map((p) => {
      const propias = respuestas.filter((x) => x.pregunta_id === p.id);
      const base = { id: p.id, texto: p.texto, tipo: p.tipo, activa: Boolean(p.activa), respuestas: propias.length };
      if (p.tipo === 'escala') {
        const valores = propias.map((x) => Number(x.valor)).filter((v) => v >= 1 && v <= 5);
        const distribucion = [1, 2, 3, 4, 5].map((v) => valores.filter((x) => x === v).length);
        return { ...base, promedio: valores.length ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10 : null, distribucion };
      }
      if (p.tipo === 'si_no') {
        return { ...base, si: propias.filter((x) => Number(x.valor) === 1).length, no: propias.filter((x) => Number(x.valor) === 0).length };
      }
      return { ...base, comentarios: propias.filter((x) => x.texto).slice(-50).reverse().map((x) => ({ texto: x.texto, curso: x.curso, fecha: x.created_at })) };
    }),
  };
}

async function generar(tipo, filtros = {}) {
  if (tipo === 'ventas') return ventas(filtros);
  if (tipo === 'inscripciones') return inscripciones(filtros);
  if (tipo === 'progreso') return progreso(filtros);
  if (tipo === 'profesores') return profesores(filtros);
  if (tipo === 'encuestas') return encuestas(filtros);
  throw new AppError('Reporte desconocido', 400);
}

function periodo(d) {
  return d.desde ? `Del ${d.desde.toLocaleDateString('es-AR')} al ${d.hasta.toLocaleDateString('es-AR')}` : '';
}

async function armarPdf(tipo, datos) {
  const titulo = TIPOS[tipo];
  const bloques = [];
  if (tipo === 'ventas') {
    bloques.push({ tipo: 'pares', filas: [['Órdenes aprobadas', datos.totalOrdenes], ...Object.entries(datos.porMoneda).map(([m, t]) => [`Total ${m}`, t.toLocaleString('es-AR')]), ['Inscripciones sin pasarela', datos.inscripcionesSinPasarela]] });
    bloques.push({ tipo: 'titulo', texto: 'Cursos más vendidos' });
    bloques.push({ tipo: 'tabla', columnas: [{ titulo: 'Curso', ancho: 4 }, { titulo: 'Ventas' }], filas: datos.cursosMasVendidos.map((c) => [c.titulo, c.cantidad]) });
    bloques.push({ tipo: 'titulo', texto: 'Órdenes' });
    bloques.push({ tipo: 'tabla', columnas: [{ titulo: '#' }, { titulo: 'Fecha', ancho: 1.5 }, { titulo: 'Alumno', ancho: 2.5 }, { titulo: 'Medio' }, { titulo: 'Total', ancho: 1.3 }], filas: datos.ordenes.map((o) => [o.id, aDate(o.created_at).toLocaleDateString('es-AR'), `${o.nombre} ${o.apellido}`, o.provider, `${o.moneda} ${Number(o.total).toLocaleString('es-AR')}`]) });
  } else if (tipo === 'inscripciones') {
    bloques.push({ tipo: 'pares', filas: [['Inscripciones nuevas en el período', datos.totalNuevas], ['Alumnos inscriptos (total)', datos.totalAlumnos]] });
    bloques.push({ tipo: 'tabla', columnas: [{ titulo: 'Curso', ancho: 3 }, { titulo: 'Profesor', ancho: 2 }, { titulo: 'Nuevas' }, { titulo: 'Total' }, { titulo: 'Terminaron' }, { titulo: 'Ingreso est.', ancho: 1.3 }], filas: datos.cursos.map((c) => [c.titulo, c.profesor, c.nuevasEnRango, c.alumnosTotales, c.completados, c.ingresoEstimadoRango.toLocaleString('es-AR')]) });
  } else if (tipo === 'progreso') {
    datos.cursos.forEach((c) => {
      bloques.push({ tipo: 'titulo', texto: `${c.titulo} — ${c.alumnos.length} alumno(s), promedio ${c.promedio}%` });
      bloques.push({ tipo: 'tabla', columnas: [{ titulo: 'Alumno', ancho: 2.5 }, { titulo: 'Email', ancho: 2.5 }, { titulo: 'Capítulos' }, { titulo: 'Avance' }, { titulo: 'Terminó' }], filas: c.alumnos.map((a) => [a.alumno, a.email, `${a.capitulosCompletados}/${a.capitulosTotales}`, `${a.porcentaje}%`, a.completado ? 'Sí' : 'No']) });
    });
    if (!datos.cursos.length) bloques.push({ tipo: 'parrafo', texto: 'Sin cursos.' });
  } else if (tipo === 'profesores') {
    bloques.push({ tipo: 'tabla', columnas: [{ titulo: 'Profesor', ancho: 2.5 }, { titulo: 'Cursos' }, { titulo: 'Alumnos' }, { titulo: 'Clases' }, { titulo: 'Turnos' }, { titulo: 'Calif. interna' }, { titulo: 'Encuesta' }], filas: datos.profesores.map((p) => [p.profesor, p.cursos, p.alumnos, p.clasesDadas, p.turnosAtendidos, p.calificacionInterna ?? '—', p.encuestaAlumnos ?? '—']) });
  } else if (tipo === 'encuestas') {
    bloques.push({ tipo: 'pares', filas: [['Encuestas respondidas', datos.respondieron]] });
    datos.preguntas.forEach((p) => {
      bloques.push({ tipo: 'titulo', texto: p.texto });
      if (p.tipo === 'escala') bloques.push({ tipo: 'pares', filas: [['Promedio (1 a 5)', p.promedio ?? '—'], ['Respuestas', p.respuestas], ['Distribución 1→5', p.distribucion.join(' · ')]] });
      else if (p.tipo === 'si_no') bloques.push({ tipo: 'pares', filas: [['Sí', p.si], ['No', p.no]] });
      else bloques.push({ tipo: 'lista', items: p.comentarios.length ? p.comentarios.map((c) => `${c.texto} (${c.curso})`) : ['Sin comentarios.'] });
    });
  }
  return generarPdf({ titulo, subtitulo: periodo(datos), bloques });
}

module.exports = { TIPOS, generar, armarPdf, progreso };
