// Habilitación de pantallas (portado de pantallasController de DBA24):
// cada pantalla de alumnos/profesores puede estar "activa", "en
// reparación" (se ve un cartel en vez de la sección) u "oculta" (no aparece
// en el menú). Además, una pantalla puntual se puede bloquear para un
// usuario puntual.
//
// El frontend lo usa para el menú y el cartel; el backend lo hace cumplir
// en requireAuth, mapeando cada pantalla a los prefijos de la API que usa.
// "Reportar error" y "Mis consultas" no se pueden apagar: tienen que andar
// justamente cuando otra sección está rota.
const db = require('../config/db');
const configService = require('./config.service');

const PANTALLAS = {
  tienda: { nombre: 'Tienda y carrito', rutas: ['/tienda', '/carrito'], api: ['/api/cart'] },
  mis_cursos: { nombre: 'Mis cursos y aula', rutas: ['/mis-cursos', '/classroom'], api: ['/api/classroom'] },
  calendario: { nombre: 'Calendario de turnos', rutas: ['/calendario'], api: ['/api/calendar'] },
  clases_en_vivo: { nombre: 'Clases en vivo', rutas: ['/clases-en-vivo'], api: ['/api/clases-en-vivo'] },
  logros: { nombre: 'Logros', rutas: ['/logros'], api: ['/api/achievements'] },
  cv: { nombre: 'Creador de CV', rutas: ['/cv'], api: ['/api/cv'] },
  integraciones_ia: { nombre: 'Integraciones IA y GPTs', rutas: ['/integraciones-ia', '/gpts'], api: ['/api/ai'] },
  agentes: { nombre: 'Sandbox de agentes', rutas: ['/agentes'], api: ['/api/agentes'] },
  alertas: { nombre: 'Alertas', rutas: ['/alertas'], api: ['/api/alertas'] },
  novedades: { nombre: 'Novedades', rutas: ['/novedades'], api: [] },
  encuestas: { nombre: 'Encuestas', rutas: ['/encuestas'], api: ['/api/encuestas'] },
};
const ESTADOS = ['activa', 'reparacion', 'oculta'];

async function estados() {
  const guardado = await configService.getJson('config.pantallas', {});
  const salida = {};
  for (const [clave, p] of Object.entries(PANTALLAS)) {
    const g = (guardado && guardado[clave]) || {};
    salida[clave] = {
      nombre: p.nombre,
      rutas: p.rutas,
      estado: ESTADOS.includes(g.estado) ? g.estado : 'activa',
      mensaje: g.mensaje || '',
    };
  }
  return salida;
}

async function guardarEstados(body) {
  const limpio = {};
  for (const clave of Object.keys(PANTALLAS)) {
    const v = (body && body[clave]) || {};
    limpio[clave] = {
      estado: ESTADOS.includes(v.estado) ? v.estado : 'activa',
      mensaje: String(v.mensaje || '').trim().slice(0, 300),
    };
  }
  await configService.set('config.pantallas', limpio);
  return estados();
}

function pantallaDeApi(baseUrl) {
  return Object.keys(PANTALLAS).find((k) => PANTALLAS[k].api.some((p) => baseUrl === p || baseUrl.startsWith(`${p}/`))) || null;
}

function bloqueosDe(userId) {
  return db('pantallas_bloqueos').where({ user_id: userId }).select('pantalla', 'motivo');
}

// Para requireAuth: ¿esta request cae en una pantalla apagada o bloqueada
// para este usuario? Admin y soporte nunca quedan afuera.
async function restriccion(user, baseUrl) {
  if (!user || ['admin', 'soporte'].includes(user.rol)) return null;
  const clave = pantallaDeApi(baseUrl);
  if (!clave) return null;
  const e = (await estados())[clave];
  if (e.estado !== 'activa') {
    return { codigo: 'PANTALLA_REPARACION', status: 503, mensaje: e.mensaje || `"${e.nombre}" está en reparación. Volvé en un rato.` };
  }
  const bloqueo = await db('pantallas_bloqueos').where({ user_id: user.id, pantalla: clave }).first();
  if (bloqueo) {
    return { codigo: 'PANTALLA_BLOQUEADA', status: 403, mensaje: bloqueo.motivo ? `No tenés acceso a "${e.nombre}": ${bloqueo.motivo}` : `No tenés acceso a "${e.nombre}".` };
  }
  return null;
}

function listBloqueos() {
  return db('pantallas_bloqueos as b')
    .join('users as u', 'u.id', 'b.user_id')
    .select('b.*', 'u.nombre', 'u.apellido', 'u.email', 'u.rol')
    .orderBy('b.id', 'desc');
}

async function bloquear({ userId, pantalla, motivo, adminId }) {
  const { AppError } = require('../middlewares/error.middleware');
  if (!PANTALLAS[pantalla]) throw new AppError('Pantalla desconocida', 400);
  const u = await db('users').where({ id: userId }).first();
  if (!u || !['alumno', 'profesor'].includes(u.rol)) throw new AppError('Solo se bloquean pantallas a alumnos o profesores', 400);
  const existente = await db('pantallas_bloqueos').where({ user_id: userId, pantalla }).first();
  if (existente) await db('pantallas_bloqueos').where({ id: existente.id }).update({ motivo: motivo || null, bloqueado_por: adminId });
  else await db('pantallas_bloqueos').insert({ user_id: userId, pantalla, motivo: motivo || null, bloqueado_por: adminId });
}

function desbloquear(id) {
  return db('pantallas_bloqueos').where({ id }).del();
}

module.exports = { PANTALLAS, ESTADOS, estados, guardarEstados, restriccion, bloqueosDe, listBloqueos, bloquear, desbloquear };
