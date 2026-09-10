// Capa de acceso a "app_settings" (configuración clave/valor editable
// desde el backoffice). Mismo patrón de upsert-por-clave que
// content.model.js.
const db = require('../config/db');

function listAll() {
  return db('app_settings').select('*').orderBy('clave');
}

async function getMap() {
  const filas = await listAll();
  const mapa = {};
  filas.forEach((f) => { mapa[f.clave] = f.valor; });
  return mapa;
}

// Devuelve el valor guardado, o el default si la clave todavía no existe
// (ej: recién instalado y el seed no corrió, o se agregó una clave nueva
// después). Nunca tira si falta — siempre hay un comportamiento razonable.
async function getValor(clave, valorDefault) {
  const fila = await db('app_settings').where({ clave }).first();
  return fila ? fila.valor : valorDefault;
}

async function upsert(clave, valor, descripcion) {
  const existente = await db('app_settings').where({ clave }).first();
  if (existente) {
    await db('app_settings').where({ clave }).update({
      valor: String(valor),
      ...(descripcion !== undefined ? { descripcion } : {}),
      updated_at: db.fn.now(),
    });
  } else {
    await db('app_settings').insert({ clave, valor: String(valor), descripcion: descripcion || null });
  }
  return db('app_settings').where({ clave }).first();
}

module.exports = { listAll, getMap, getValor, upsert };
