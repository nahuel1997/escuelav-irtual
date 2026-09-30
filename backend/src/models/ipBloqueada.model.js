const db = require('../config/db');

async function estaBloqueada(ip) {
  if (!ip) return false;
  const fila = await db('ips_bloqueadas').where({ ip }).first();
  return Boolean(fila);
}

// Upsert por IP: bloquear una IP que ya estaba bloqueada no duplica fila,
// solo actualiza motivo/fecha — mismo criterio para el bloqueo manual
// (admin) y el automático (fuerza bruta, bloqueadoPor null), así ambos
// mecanismos escriben la misma tabla sin conflicto.
async function bloquear(ip, { motivo, bloqueadoPor = null }) {
  const existente = await db('ips_bloqueadas').where({ ip }).first();
  if (existente) {
    await db('ips_bloqueadas').where({ ip }).update({
      motivo,
      bloqueado_por: bloqueadoPor,
      updated_at: db.fn.now(),
    });
    return db('ips_bloqueadas').where({ ip }).first();
  }
  const [id] = await db('ips_bloqueadas').insert({ ip, motivo, bloqueado_por: bloqueadoPor });
  return db('ips_bloqueadas').where({ id }).first();
}

function desbloquear(id) {
  return db('ips_bloqueadas').where({ id }).del();
}

function findById(id) {
  return db('ips_bloqueadas').where({ id }).first();
}

// Para el admin: lista de bloqueos con el nombre de quién bloqueó a mano
// (null si fue automático por fuerza bruta).
function listAll() {
  return db('ips_bloqueadas as b')
    .leftJoin('users as u', 'u.id', 'b.bloqueado_por')
    .select('b.*', 'u.nombre as bloqueado_por_nombre')
    .orderBy('b.created_at', 'desc');
}

module.exports = { estaBloqueada, bloquear, desbloquear, findById, listAll };
