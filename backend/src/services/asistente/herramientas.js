// Herramientas del asistente IA del panel — TODAS de solo lectura: el
// asistente consulta datos para responder, nunca crea, edita ni borra nada
// (para eso está el panel). Cada herramienta tiene su esquema estricto
// (strict: true) y su implementación; la salida se recorta para no mandar
// tablas enormes al modelo.
const db = require('../../config/db');
const reportes = require('../reportes.service');
const presencia = require('../presencia.service');
const trafico = require('../../models/trafico.model');
const { haceDias } = require('../../utils/sqlFecha');

const MAX_SALIDA = 20000;

function objeto(properties, required = Object.keys(properties)) {
  return { type: 'object', properties, required, additionalProperties: false };
}

const cadenaONull = { type: ['string', 'null'] };
const enteroONull = { type: ['integer', 'null'] };

const DEFINICIONES = [
  {
    name: 'resumen_general',
    description: 'Números generales de la escuela en este momento: usuarios por rol, cursos, inscripciones, ventas de los últimos 30 días, tickets abiertos, errores de las últimas 24 h, reportes de error nuevos y gente en línea. Usala primero para preguntas generales del estilo "¿cómo venimos?".',
    input_schema: objeto({}),
  },
  {
    name: 'buscar_usuarios',
    description: 'Busca alumnos, profesores, admins o agentes de soporte por nombre, apellido o email (hasta 10 resultados). Devuelve id, nombre, email, rol y si la cuenta está activa o bloqueada.',
    input_schema: objeto({ texto: { type: 'string', description: 'Parte del nombre, apellido o email' } }),
  },
  {
    name: 'detalle_usuario',
    description: 'Ficha de un usuario por id: datos de la cuenta, cursos en los que está inscripto con su avance, últimas sesiones y sus tickets de soporte.',
    input_schema: objeto({ id: { type: 'integer' } }),
  },
  {
    name: 'listar_cursos',
    description: 'Todos los cursos con estado, precio, profesor y cantidad de alumnos inscriptos.',
    input_schema: objeto({}),
  },
  {
    name: 'reporte',
    description: 'Genera un reporte: "ventas" (órdenes aprobadas, totales por moneda, cursos más vendidos), "inscripciones" (por curso), "progreso" (avance de los alumnos, opcionalmente de un curso), "profesores" (actividad y calificaciones) o "encuestas" (satisfacción de alumnos). Fechas en formato AAAA-MM-DD; si no se pasan, toma los últimos 30 días.',
    input_schema: objeto({
      tipo: { type: 'string', enum: ['ventas', 'inscripciones', 'progreso', 'profesores', 'encuestas'] },
      desde: cadenaONull,
      hasta: cadenaONull,
      curso_id: enteroONull,
    }),
  },
  {
    name: 'tickets',
    description: 'Tickets de soporte (hasta 30), filtrables por estado: abierto, en_curso, esperando_usuario, resuelto, cerrado. Incluye asunto, usuario, prioridad y a quién está asignado.',
    input_schema: objeto({ estado: { type: ['string', 'null'], enum: ['abierto', 'en_curso', 'esperando_usuario', 'resuelto', 'cerrado', null] } }),
  },
  {
    name: 'errores_recientes',
    description: 'Los errores de la app más recientes (servidor y navegador, agrupados con cuántas veces pasó cada uno) y los reportes de error de usuarios que todavía no se atendieron.',
    input_schema: objeto({}),
  },
  {
    name: 'trafico',
    description: 'Tráfico del sitio de los últimos N días (1 a 90): páginas vistas, personas distintas, páginas más vistas, por rol y dispositivo, y quién está en línea ahora.',
    // Sin minimum/maximum en el esquema estricto: el rango se valida en la implementación.
    input_schema: objeto({ dias: { type: 'integer', description: 'Cantidad de días, de 1 a 90' } }),
  },
];

const n = (r) => Number(r && (r.c ?? r.count) || 0);

const IMPLEMENTACIONES = {
  async resumen_general() {
    const porRol = await db('users').where({ es_prueba: false }).select('rol').count({ c: '*' }).groupBy('rol');
    const [cursos, insc, ventas, tickets, errores, reportesNuevos] = await Promise.all([
      db('courses').count({ c: '*' }).first(),
      db('enrollments').count({ c: '*' }).first(),
      db('payment_orders').where('status', 'aprobado').where('created_at', '>=', haceDias(30)).select('moneda').sum({ total: 'total' }).count({ c: '*' }).groupBy('moneda'),
      db('tickets').whereNotIn('estado', ['resuelto', 'cerrado']).count({ c: '*' }).first(),
      db('errores_app').where('ultima_vez', '>=', haceDias(1)).count({ c: '*' }).first(),
      db('reportes_error').where('estado', 'nuevo').count({ c: '*' }).first(),
    ]);
    return {
      usuariosPorRol: Object.fromEntries(porRol.map((r) => [r.rol, n(r)])),
      cursos: n(cursos),
      inscripciones: n(insc),
      ventasUltimos30Dias: ventas.map((v) => ({ moneda: v.moneda, ordenes: n(v), total: Number(v.total) })),
      ticketsActivos: n(tickets),
      erroresDistintos24h: n(errores),
      reportesDeErrorSinAtender: n(reportesNuevos),
      enLineaAhora: presencia.online().length,
    };
  },

  async buscar_usuarios({ texto }) {
    const like = `%${String(texto).toLowerCase().slice(0, 100)}%`;
    const filas = await db('users').where({ es_prueba: false })
      .where((w) => w.whereRaw('lower(nombre) like ?', [like]).orWhereRaw('lower(apellido) like ?', [like]).orWhereRaw('lower(email) like ?', [like]))
      .select('id', 'nombre', 'apellido', 'email', 'rol', 'activo', 'bloqueado', 'created_at').limit(10);
    return filas.map((u) => ({ ...u, activo: Boolean(u.activo), bloqueado: Boolean(u.bloqueado) }));
  },

  async detalle_usuario({ id }) {
    const u = await db('users').where({ id }).select('id', 'nombre', 'apellido', 'email', 'rol', 'activo', 'bloqueado', 'bloqueado_motivo', 'email_verificado', 'created_at').first();
    if (!u) return { error: 'No existe un usuario con ese id' };
    const [progreso, sesiones, tickets] = await Promise.all([
      u.rol === 'alumno' ? reportes.progreso({ userId: u.id }) : Promise.resolve({ cursos: [] }),
      db('login_logs').where({ user_id: u.id }).select('login_at', 'logout_at', 'pais', 'provincia').orderBy('id', 'desc').limit(5),
      db('tickets').where({ user_id: u.id }).select('id', 'asunto', 'estado', 'created_at').orderBy('id', 'desc').limit(10),
    ]);
    return {
      usuario: { ...u, activo: Boolean(u.activo), bloqueado: Boolean(u.bloqueado), email_verificado: Boolean(u.email_verificado) },
      cursos: progreso.cursos.filter((c) => c.alumnos.length).map((c) => ({ curso: c.titulo, avance: `${c.alumnos[0].porcentaje}%`, terminado: c.alumnos[0].completado })),
      ultimasSesiones: sesiones,
      tickets,
    };
  },

  async listar_cursos() {
    const cursos = await db('courses as c').leftJoin('users as p', 'p.id', 'c.profesor_id')
      .select('c.id', 'c.titulo', 'c.estado', 'c.precio', 'c.categoria', 'p.nombre as profesor_nombre', 'p.apellido as profesor_apellido');
    const insc = await db('enrollments').select('course_id').count({ c: '*' }).groupBy('course_id');
    const mapa = Object.fromEntries(insc.map((i) => [i.course_id, n(i)]));
    return cursos.map((c) => ({ id: c.id, titulo: c.titulo, estado: c.estado, precio: Number(c.precio), categoria: c.categoria, profesor: c.profesor_nombre ? `${c.profesor_nombre} ${c.profesor_apellido}` : null, alumnos: mapa[c.id] || 0 }));
  },

  async reporte({ tipo, desde, hasta, curso_id: cursoId }) {
    const datos = await reportes.generar(tipo, { desde: desde || undefined, hasta: hasta || undefined, courseId: cursoId || undefined });
    // Las órdenes una por una no hacen falta para responder: con los totales alcanza.
    if (tipo === 'ventas') return { ...datos, ordenes: datos.ordenes.slice(0, 20) };
    return datos;
  },

  async tickets({ estado }) {
    const q = db('tickets as t').join('users as u', 'u.id', 't.user_id').leftJoin('users as a', 'a.id', 't.asignado_a')
      .select('t.id', 't.asunto', 't.estado', 't.prioridad', 't.categoria', 't.created_at', 't.updated_at', 'u.nombre', 'u.apellido', 'u.rol', 'a.nombre as asignado')
      .orderBy('t.updated_at', 'desc').limit(30);
    if (estado) q.where('t.estado', estado);
    return q;
  },

  async errores_recientes() {
    const [errores, reportesNuevos] = await Promise.all([
      db('errores_app').select('origen', 'mensaje', 'url', 'veces', 'ultima_vez').orderBy('ultima_vez', 'desc').limit(15),
      db('reportes_error').where('estado', 'nuevo').select('id', 'titulo', 'descripcion', 'rol', 'created_at').orderBy('id', 'desc').limit(10),
    ]);
    return { errores, reportesDeUsuariosSinAtender: reportesNuevos };
  },

  async trafico({ dias }) {
    const d = Math.min(90, Math.max(1, Number(dias) || 7));
    const hasta = new Date();
    const resumen = await trafico.resumen({ desde: new Date(hasta.getTime() - d * 86400000), hasta });
    return { ...resumen, enLineaAhora: presencia.online().map((p) => ({ nombre: p.nombre, rol: p.rol })) };
  },
};

// Ejecuta una herramienta y devuelve el texto para el tool_result. Nunca
// tira: un error se devuelve como resultado con is_error.
async function ejecutar(nombre, entrada) {
  const fn = IMPLEMENTACIONES[nombre];
  if (!fn) return { contenido: `Herramienta desconocida: ${nombre}`, error: true };
  try {
    const salida = JSON.stringify(await fn(entrada || {}));
    return { contenido: salida.length > MAX_SALIDA ? `${salida.slice(0, MAX_SALIDA)}… (recortado)` : salida, error: false };
  } catch (err) {
    console.error(`[asistente] falló la herramienta ${nombre}:`, err);
    return { contenido: `No se pudo consultar: ${err.publicMessage || 'error interno'}`, error: true };
  }
}

module.exports = {
  DEFINICIONES: DEFINICIONES.map((d) => ({ ...d, strict: true })),
  ejecutar,
};
