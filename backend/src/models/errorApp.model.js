// Lectura del registro de errores agrupados (errores_app) para el admin.
// La escritura la hace services/erroresApp.service.js, en lotes.
const db = require('../config/db');
const { haceDias } = require('../utils/sqlFecha');

const PAGE_SIZE = 30;

function baseQuery({ origen, q, desde, hasta }) {
  const query = db('errores_app');
  if (origen) query.where({ origen });
  if (q) {
    const like = `%${String(q).toLowerCase()}%`;
    query.where((w) => w.whereRaw('lower(mensaje) like ?', [like]).orWhereRaw('lower(url) like ?', [like]));
  }
  if (desde) query.where('ultima_vez', '>=', desde);
  if (hasta) query.where('ultima_vez', '<=', `${hasta} 23:59:59`);
  return query;
}

async function listPage({ origen, q, desde, hasta, page = 1 } = {}) {
  const pagina = Math.max(1, Number(page) || 1);
  const [rows, total] = await Promise.all([
    baseQuery({ origen, q, desde, hasta })
      .select('id', 'origen', 'mensaje', 'contexto', 'url', 'metodo', 'usuario_nombre', 'rol', 'veces', 'primera_vez', 'ultima_vez')
      .orderBy('ultima_vez', 'desc')
      .orderBy('id', 'desc')
      .limit(PAGE_SIZE)
      .offset((pagina - 1) * PAGE_SIZE),
    baseQuery({ origen, q, desde, hasta }).count({ count: '*' }).first(),
  ]);
  const t = Number(total.count);
  return { rows, total: t, page: pagina, totalPages: Math.max(1, Math.ceil(t / PAGE_SIZE)) };
}

async function findById(id) {
  const fila = await db('errores_app').where({ id }).first();
  if (fila && fila.detalle) {
    try { fila.detalle = JSON.parse(fila.detalle); } catch (_e) { /* queda como texto */ }
  }
  return fila;
}

function remove(id) {
  return db('errores_app').where({ id }).del();
}

function clearAll() {
  return db('errores_app').del();
}

// Cantidad de errores distintos que aparecieron o se repitieron en las
// últimas 24 h (para el dashboard / estado de la app).
function contarUltimas24h() {
  return db('errores_app').where('ultima_vez', '>=', haceDias(1)).count({ count: '*' }).first().then((r) => Number(r.count));
}

module.exports = { listPage, findById, remove, clearAll, contarUltimas24h, PAGE_SIZE };
