const db = require('../config/db');

// Manda el mismo mensaje a varios usuarios a la vez: una fila por
// destinatario (ver la migración para el porqué de este diseño, en vez de
// una tabla de "envío" + una de "destinatarios").
function crear({ userIds, adminId, mensaje }) {
  const filas = userIds.map((user_id) => ({ user_id, admin_id: adminId, mensaje }));
  return db('alertas').insert(filas);
}

// Historial completo para el admin (pestaña "Alertas" del panel), con el
// nombre del destinatario de cada fila — más reciente primero. Ordena por
// "id" en vez de "created_at": dos alertas mandadas en el mismo segundo
// (created_at en sqlite/Postgres con default de segundo, no milisegundo)
// empatarían en el orden por fecha — el id autoincremental sí refleja
// siempre el orden real de inserción.
function listAll() {
  return db('alertas as a')
    .join('users as u', 'u.id', 'a.user_id')
    .select('a.id', 'a.mensaje', 'a.mostrado_en', 'a.recibido_en', 'a.created_at', 'u.id as user_id', 'u.nombre', 'u.apellido', 'u.email', 'u.rol')
    .orderBy('a.id', 'desc');
}

// Todo lo que le mandaron a ESTE usuario — su propia pestaña "Alertas",
// para volver a leer algo que ya vio como pop-up (o nunca llegó a ver).
function listByUser(userId) {
  return db('alertas').where({ user_id: userId }).orderBy('id', 'desc');
}

// La más reciente todavía sin mostrar (mostrado_en IS NULL) — la que se
// usa para armar el pop-up, o undefined si no hay ninguna pendiente.
function pendienteMasReciente(userId) {
  return db('alertas').where({ user_id: userId }).whereNull('mostrado_en').orderBy('id', 'desc').first();
}

// Marca TODAS las pendientes de este usuario como ya mostradas, en un
// solo paso — si se le mandaron dos alertas seguidas antes de que
// entrara, ve la más reciente como pop-up pero ninguna de las dos vuelve
// a aparecer como pop-up después (ambas siguen visibles igual en su
// pestaña "Alertas", eso no depende de mostrado_en).
function marcarMostradas(userId) {
  return db('alertas').where({ user_id: userId }).whereNull('mostrado_en').update({ mostrado_en: db.fn.now() });
}

// Acuse de recibo: solo el destinatario puede marcar la suya (el where por
// user_id es lo que lo garantiza — con el id de otra alerta no toca nada).
function marcarRecibido(id, userId) {
  return db('alertas').where({ id, user_id: userId }).whereNull('recibido_en').update({ recibido_en: db.fn.now() });
}

function contarSinRecibir(userId) {
  return db('alertas').where({ user_id: userId }).whereNull('recibido_en').count({ count: '*' }).first().then((r) => Number(r.count));
}

module.exports = { crear, listAll, listByUser, pendienteMasReciente, marcarMostradas, marcarRecibido, contarSinRecibir };
