const db = require('../config/db');

// Crea la fila de sesión al loguear/registrarse. `jti` es el id único que
// también viaja adentro del JWT (ver auth.controller.js::signToken) —
// es lo que le permite al middleware de auth (y al admin) identificar y
// cerrar ESTA sesión puntual entre varias que puede tener el mismo
// usuario abiertas a la vez (varios dispositivos).
function create(userId, { jti, ip, userAgent, pais, provincia } = {}) {
  return db('login_logs').insert({
    user_id: userId,
    login_at: db.fn.now(),
    jti: jti || null,
    ip: ip || null,
    user_agent: userAgent || null,
    pais: pais || null,
    provincia: provincia || null,
  });
}

// Cierra la sesión identificada por jti (la que llamó a /auth/logout).
// Antes cerrábamos "la más reciente sin logout_at" del usuario, pero eso
// rompía con más de un dispositivo logueado a la vez: cerrar sesión en el
// celular podía marcar como terminada la sesión de la compu. Con jti en
// el token, cada logout cierra exactamente la sesión que lo llamó.
async function closeSession(jti) {
  if (!jti) return 0;
  return db('login_logs').where({ jti }).whereNull('logout_at').whereNull('revoked_at').update({ logout_at: db.fn.now() });
}

// Compatibilidad hacia atrás: tokens emitidos antes de esta migración no
// tienen jti (ver auth.middleware.js), así que su logout no puede
// identificar una fila puntual — usamos el heurístico viejo como
// fallback para que esos usuarios (con sesión ya abierta) puedan seguir
// cerrándola prolijamente hasta que expire el token y vuelvan a loguearse.
async function closeOpenSession(userId) {
  const abierta = await db('login_logs')
    .where({ user_id: userId })
    .whereNull('logout_at')
    .whereNull('revoked_at')
    // login_at es CURRENT_TIMESTAMP (granularidad de 1 segundo en SQLite):
    // dos sesiones abiertas en el mismo segundo empatan ahí, y sin un
    // criterio de desempate el orden entre esas filas no está garantizado.
    // "id" es autoincremental, así que ordenar también por id desc
    // desempata siempre a favor de la fila insertada más recientemente.
    .orderBy([{ column: 'login_at', order: 'desc' }, { column: 'id', order: 'desc' }])
    .first();
  if (!abierta) return 0;
  return db('login_logs').where({ id: abierta.id }).update({ logout_at: db.fn.now() });
}

// Para el middleware de auth: ¿esta sesión sigue activa? (ni el usuario ni
// el admin la cerraron). select mínimo — esto corre en cada request
// autenticado, así que el costo extra de ir a la base tiene que ser
// chico (una fila por jti indexado).
async function estaActiva(jti) {
  const fila = await db('login_logs').where({ jti }).whereNull('logout_at').whereNull('revoked_at').first();
  return Boolean(fila);
}

// El admin fuerza el cierre de una sesión ajena desde el historial. Solo
// tiene efecto si seguía abierta (no pisa un logout_at/revoked_at ya
// puesto).
async function revocar(id) {
  const fila = await db('login_logs').where({ id }).first();
  if (!fila) return null;
  if (fila.logout_at || fila.revoked_at) return fila; // ya estaba cerrada
  await db('login_logs').where({ id }).update({ revoked_at: db.fn.now() });
  return db('login_logs').where({ id }).first();
}

// Cierra TODAS las sesiones activas de un usuario de un saque — se usa al
// resetear su contraseña desde el admin (ver admin.controller.js::
// updateUser): si alguien tenía la cuenta comprometida, cambiar la
// contraseña sin esto no serviría de mucho porque su sesión ya abierta
// seguiría funcionando hasta que expire sola.
function revocarTodasDeUsuario(userId) {
  return db('login_logs').where({ user_id: userId }).whereNull('logout_at').whereNull('revoked_at').update({ revoked_at: db.fn.now() });
}

// Registro para el admin: usuario, cuándo entró, cuándo salió (o "sigue
// activa" si logout_at y revoked_at son null), de dónde (ip/país/
// provincia), filtrable por usuario y rango de fechas.
function listAll({ userId, desde, hasta } = {}) {
  const query = db('login_logs as l')
    .join('users as u', 'u.id', 'l.user_id')
    .select(
      'l.id',
      'l.user_id',
      'l.login_at',
      'l.logout_at',
      'l.revoked_at',
      'l.ip',
      'l.pais',
      'l.provincia',
      'u.nombre',
      'u.apellido',
      'u.email',
      'u.rol'
    )
    // Mismo motivo que en closeOpenSession: desempatar por id para que el
    // orden "más reciente primero" sea determinístico aunque dos sesiones
    // se hayan creado dentro del mismo segundo.
    .orderBy([{ column: 'l.login_at', order: 'desc' }, { column: 'l.id', order: 'desc' }])
    .limit(500);
  if (userId) query.where('l.user_id', userId);
  if (desde) query.where('l.login_at', '>=', desde);
  if (hasta) query.where('l.login_at', '<=', hasta);
  return query;
}

// Usado por jobs/inactividad.job.js (mail "te extrañamos"): alumnos y
// profesores que no tienen NINGÚN login_log con login_at más nuevo que
// `umbralFecha` (o sea, o hace mucho que no entran, o nunca entraron
// después de crear la cuenta), excluyendo cuentas recién creadas (todavía
// no tuvieron tiempo de "extrañarse") y a quien ya se le mandó el aviso
// hace poco (ver users.ultimo_mail_inactividad_at, cooldown para no
// reenviar todos los días mientras siga inactivo).
function listUsuariosInactivos(umbralFecha) {
  return db('users as u')
    .whereIn('u.rol', ['alumno', 'profesor'])
    .where('u.created_at', '<', umbralFecha)
    .where(function () {
      this.whereNull('u.ultimo_mail_inactividad_at').orWhere('u.ultimo_mail_inactividad_at', '<', umbralFecha);
    })
    .whereNotExists(function () {
      this.select('*').from('login_logs as l').whereRaw('l.user_id = u.id').where('l.login_at', '>=', umbralFecha);
    })
    .select('u.id', 'u.nombre', 'u.email');
}

module.exports = {
  create,
  closeSession,
  closeOpenSession,
  estaActiva,
  revocar,
  revocarTodasDeUsuario,
  listAll,
  listUsuariosInactivos,
};
