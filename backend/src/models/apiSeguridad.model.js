// Bloqueos, fuerza bruta y mensajes de error de la API de datos — ver la
// migración 20260930000003 para el porqué de cada tabla.
const db = require('../config/db');

const TOPE_FALLOS = 10;
const ESPERA_ETAPA_MS = { 0: 60 * 1000, 1: 5 * 60 * 1000 };

// --- Bloqueos ---

async function estaBloqueado({ ip, username }) {
  const q = db('api_bloqueados').where((w) => {
    w.where({ tipo: 'ip', valor: ip || '' });
    if (username) w.orWhere({ tipo: 'usuario', valor: String(username).toLowerCase() });
  });
  return Boolean(await q.first());
}

function listBloqueados() {
  return db('api_bloqueados as b')
    .leftJoin('users as u', 'u.id', 'b.bloqueado_por')
    .select('b.*', 'u.nombre as bloqueado_por_nombre')
    .orderBy('b.id', 'desc');
}

async function bloquear({ tipo, valor, motivo, bloqueadoPor = null }) {
  const v = tipo === 'usuario' ? String(valor).toLowerCase() : String(valor);
  const existente = await db('api_bloqueados').where({ tipo, valor: v }).first();
  if (existente) {
    await db('api_bloqueados').where({ id: existente.id }).update({ motivo, bloqueado_por: bloqueadoPor, updated_at: db.fn.now() });
    return db('api_bloqueados').where({ id: existente.id }).first();
  }
  const [id] = await db('api_bloqueados').insert({ tipo, valor: v, motivo, bloqueado_por: bloqueadoPor });
  return db('api_bloqueados').where({ id }).first();
}

function desbloquear(id) {
  return db('api_bloqueados').where({ id }).del();
}

// --- Fuerza bruta ---

function clave(ip, username) {
  return `${ip || 'sin-ip'}|${String(username || '').toLowerCase().trim()}`;
}

async function esperaRestanteMs(ip, username) {
  const fila = await db('api_bruteforce').where({ clave: clave(ip, username) }).first();
  if (!fila || !fila.bloqueado_hasta) return 0;
  return Math.max(0, new Date(fila.bloqueado_hasta).getTime() - Date.now());
}

// Devuelve { esperaMs } si arrancó una espera, { bloqueoDefinitivo } si
// bloqueó la IP, o null si solo sumó un fallo.
async function registrarFallo(ip, username) {
  const k = clave(ip, username);
  const previa = await db('api_bruteforce').where({ clave: k }).first();
  if (previa && previa.etapa >= 2) {
    await bloquear({ tipo: 'ip', valor: ip, motivo: 'Bloqueo automático: demasiados intentos de autenticación fallidos contra la API.' });
    await db('api_bruteforce').where({ clave: k }).del();
    return { bloqueoDefinitivo: true };
  }
  const fallos = (previa?.fallos || 0) + 1;
  const etapa = previa?.etapa || 0;
  if (fallos < TOPE_FALLOS) {
    if (previa) await db('api_bruteforce').where({ clave: k }).update({ fallos, updated_at: db.fn.now() });
    else await db('api_bruteforce').insert({ clave: k, fallos, etapa: 0 });
    return null;
  }
  const esperaMs = ESPERA_ETAPA_MS[etapa];
  const patch = { fallos: 0, etapa: etapa + 1, bloqueado_hasta: new Date(Date.now() + esperaMs), updated_at: db.fn.now() };
  if (previa) await db('api_bruteforce').where({ clave: k }).update(patch);
  else await db('api_bruteforce').insert({ clave: k, ...patch });
  return { esperaMs };
}

function registrarExito(ip, username) {
  return db('api_bruteforce').where({ clave: clave(ip, username) }).del();
}

// --- Mensajes de error editables ---

function listErrores() {
  return db('api_errores').select('*').orderBy('http_status').orderBy('codigo');
}

function findError(codigo) {
  return db('api_errores').where({ codigo }).first();
}

function setMensajeError(codigo, mensaje) {
  return db('api_errores').where({ codigo }).update({ mensaje, updated_at: db.fn.now() });
}

module.exports = {
  estaBloqueado,
  listBloqueados,
  bloquear,
  desbloquear,
  esperaRestanteMs,
  registrarFallo,
  registrarExito,
  listErrores,
  findError,
  setMensajeError,
  TOPE_FALLOS,
};
