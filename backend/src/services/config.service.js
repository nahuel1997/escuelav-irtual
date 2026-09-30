// Configuración general editable desde Admin → Configuración (mantenimiento,
// páginas de error, feriados, apariencia...). Se guarda en app_settings
// (clave/valor) y se lee con una caché corta: hay middlewares que la
// consultan en cada request (ej. mantenimiento) y no tiene sentido ir a la
// base cada vez. set() invalida la caché en el acto.
const appSettingModel = require('../models/appSetting.model');

const TTL_MS = 10 * 1000;
let cache = null;
let cacheEn = 0;

async function mapa() {
  if (cache && Date.now() - cacheEn < TTL_MS) return cache;
  try {
    cache = await appSettingModel.getMap();
  } catch (_e) {
    cache = {}; // sin la tabla (migración pendiente): todo con sus valores por defecto
  }
  cacheEn = Date.now();
  return cache;
}

async function get(clave, porDefecto = '') {
  const m = await mapa();
  return clave in m ? m[clave] : porDefecto;
}

async function getBool(clave, porDefecto = false) {
  const v = await get(clave, porDefecto ? '1' : '0');
  return v === '1' || v === 'true';
}

async function getJson(clave, porDefecto) {
  const v = await get(clave, '');
  if (!v) return porDefecto;
  try { return JSON.parse(v); } catch (_e) { return porDefecto; }
}

async function set(clave, valor, descripcion) {
  const texto = typeof valor === 'object' && valor !== null ? JSON.stringify(valor) : String(valor);
  await appSettingModel.upsert(clave, texto, descripcion);
  invalidar();
}

function invalidar() {
  cache = null;
}

module.exports = { get, getBool, getJson, set, invalidar };
