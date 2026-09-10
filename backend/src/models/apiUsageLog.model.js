// Registro de cada consulta real a la API de datos: qué cliente, qué
// tabla, cuánto tardó y desde qué IP — lo que pide el panel de admin en
// la pestaña "Detalle y uso" (ver AdminApis.jsx).
const db = require('../config/db');

function create(clientId, { tabla, ip, duracionMs, filasDevueltas }) {
  return db('api_usage_log').insert({
    client_id: clientId,
    tabla,
    ip: ip || null,
    duracion_ms: duracionMs,
    filas_devueltas: filasDevueltas,
  });
}

function listByClient(clientId, { limit = 200 } = {}) {
  return db('api_usage_log').where({ client_id: clientId }).orderBy('creado_at', 'desc').limit(limit);
}

module.exports = { create, listByClient };
