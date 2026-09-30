// Historial de intentos de login (ver migración 20260930000001). Todo es
// best-effort: registrar un intento nunca puede romper el login.
const db = require('../config/db');
const { haceDias } = require('../utils/sqlFecha');

const PAGE_SIZE = 50;

function registrar({ email, userId, ip, userAgent, resultado, detalle }) {
  return db('login_eventos')
    .insert({
      email: email ? String(email).slice(0, 255) : null,
      user_id: userId || null,
      ip: ip || null,
      user_agent: userAgent ? String(userAgent).slice(0, 255) : null,
      resultado,
      detalle: detalle ? String(detalle).slice(0, 255) : null,
    })
    .catch((e) => console.error('[login_eventos]', e.message));
}

function baseQuery({ resultado, q, desde, hasta }) {
  const query = db('login_eventos as e').leftJoin('users as u', 'u.id', 'e.user_id');
  if (resultado) query.where('e.resultado', resultado);
  if (q) {
    const like = `%${String(q).toLowerCase()}%`;
    query.where((w) => w.whereRaw('lower(e.email) like ?', [like]).orWhere('e.ip', 'like', like));
  }
  if (desde) query.where('e.created_at', '>=', desde);
  if (hasta) query.where('e.created_at', '<=', `${hasta} 23:59:59`);
  return query;
}

async function listPage({ resultado, q, desde, hasta, page = 1 } = {}) {
  const pagina = Math.max(1, Number(page) || 1);
  const [rows, total] = await Promise.all([
    baseQuery({ resultado, q, desde, hasta })
      .select('e.*', 'u.nombre', 'u.apellido', 'u.rol')
      .orderBy('e.id', 'desc')
      .limit(PAGE_SIZE)
      .offset((pagina - 1) * PAGE_SIZE),
    baseQuery({ resultado, q, desde, hasta }).count({ count: '*' }).first(),
  ]);
  return { rows, total: Number(total.count), page: pagina, totalPages: Math.max(1, Math.ceil(Number(total.count) / PAGE_SIZE)) };
}

// Resumen para el dashboard de seguridad: fallos de las últimas 24 h.
async function resumen24h() {
  const filas = await db('login_eventos').where('created_at', '>=', haceDias(1)).select('resultado').count({ count: '*' }).groupBy('resultado');
  const mapa = {};
  filas.forEach((f) => { mapa[f.resultado] = Number(f.count); });
  return mapa;
}

// Poda: el historial no crece para siempre (ver jobs/index.js).
function limpiarViejos(dias = 90) {
  return db('login_eventos').where('created_at', '<', haceDias(dias)).del();
}

module.exports = { registrar, listPage, resumen24h, limpiarViejos, PAGE_SIZE };
