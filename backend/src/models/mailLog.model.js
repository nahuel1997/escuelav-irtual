const db = require('../config/db');

function create(data) {
  return db('mail_log').insert(data);
}

function markEnviado(id, { proveedor, proveedor_message_id, preview_url }) {
  return db('mail_log').where({ id }).update({
    estado: 'enviado',
    proveedor,
    proveedor_message_id: proveedor_message_id || null,
    preview_url: preview_url || null,
    enviado_at: db.fn.now(),
  });
}

function markFallido(id, error) {
  return db('mail_log')
    .where({ id })
    .increment('intentos', 1)
    .update({ estado: 'fallido', error_detalle: String(error).slice(0, 1000) });
}

// Registro para el panel de admin, más reciente primero, con filtros
// opcionales por tipo/estado (los mismos que ofrece la pestaña "Registro").
function listAll({ tipo, estado, limit = 100 } = {}) {
  const query = db('mail_log').select('*').orderBy('created_at', 'desc').limit(limit);
  if (tipo) query.where({ tipo });
  if (estado) query.where({ estado });
  return query;
}

function countByTipoYEstado() {
  return db('mail_log').select('tipo', 'estado').count({ total: '*' }).groupBy('tipo', 'estado');
}

// Usado por el job de carrito abandonado / inactividad para no reenviar el
// mismo aviso: ¿ya se mandó un mail de este tipo a este destinatario
// (por user_id) en los últimos N días?
function huboEnvioReciente(userId, tipo, desdeFecha) {
  return db('mail_log')
    .where({ user_id: userId, tipo, estado: 'enviado' })
    .where('created_at', '>=', desdeFecha)
    .first();
}

module.exports = { create, markEnviado, markFallido, listAll, countByTipoYEstado, huboEnvioReciente };
