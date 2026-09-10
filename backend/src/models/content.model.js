const db = require('../config/db');

function listAll() {
  return db('site_content').select('*').orderBy('clave');
}

// Devuelve { clave: valor } listo para que el frontend público lo consuma
// de un solo golpe (GET /api/content).
async function getMap() {
  const filas = await listAll();
  const mapa = {};
  filas.forEach((f) => {
    mapa[f.clave] = f.valor;
  });
  return mapa;
}

// Devuelve el valor de una clave puntual (ej: general.zona_horaria), o el
// default si todavía no se cargó nada — mismo criterio que
// appSettingModel.getValor. Se usa desde el backend (mails, jobs) para no
// tener que traer TODO site_content cuando solo hace falta una clave.
async function getValor(clave, valorDefault) {
  const fila = await db('site_content').where({ clave }).first();
  return fila && fila.valor ? fila.valor : valorDefault;
}

async function upsert(clave, { tipo, valor }) {
  const existente = await db('site_content').where({ clave }).first();
  if (existente) {
    await db('site_content').where({ clave }).update({
      ...(tipo !== undefined ? { tipo } : {}),
      valor,
      updated_at: db.fn.now(),
    });
  } else {
    await db('site_content').insert({ clave, tipo: tipo || 'texto', valor });
  }
  return db('site_content').where({ clave }).first();
}

module.exports = { listAll, getMap, getValor, upsert };
