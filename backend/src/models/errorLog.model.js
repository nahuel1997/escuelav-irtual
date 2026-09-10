const db = require('../config/db');

const PAGE_SIZE = 20;

function create({ status, mensaje, ruta, metodo, user_id }) {
  return db('error_logs').insert({ status, mensaje, ruta, metodo, user_id: user_id || null });
}

function baseQuery({ desde, hasta } = {}) {
  const query = db('error_logs');
  if (desde) query.where('created_at', '>=', desde);
  if (hasta) query.where('created_at', '<=', hasta);
  return query;
}

// Página del registro para el admin, más reciente primero (20 por página
// — antes traía hasta 300 filas de una sola vez, que para una app con
// errores reales seguidos se volvía una tabla larguísima). Filtro opcional
// por rango de fechas (desde/hasta, formato ISO).
async function listPage({ desde, hasta, page = 1 } = {}) {
  const paginaValida = Math.max(1, Number(page) || 1);
  const offset = (paginaValida - 1) * PAGE_SIZE;
  const [rows, totalRow] = await Promise.all([
    baseQuery({ desde, hasta }).select('*').orderBy('created_at', 'desc').limit(PAGE_SIZE).offset(offset),
    baseQuery({ desde, hasta }).count({ count: '*' }).first(),
  ]);
  return { rows, total: Number(totalRow.count) };
}

// Vacía el registro completo — irreversible, así que el front lo confirma
// con el usuario antes de pegarle a este endpoint.
function clearAll() {
  return db('error_logs').del();
}

module.exports = { create, listPage, clearAll, PAGE_SIZE };
