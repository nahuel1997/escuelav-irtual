// Capa de datos del sistema de fuerza bruta del login — ver README
// "Seguridad de cuentas" para el detalle completo. Todo gira alrededor de
// una "clave" (IP + email normalizado que se intentó, arma la clave
// auth.controller.js): 3 tramos según cuántos fallos lleva acumulados esa
// combinación puntual.
const db = require('../config/db');

const TRAMO_1_FALLOS = 10; // a partir de acá, espera 1 minuto
const TRAMO_1_ESPERA_MS = 60 * 1000;
const TRAMO_2_FALLOS = 20; // a partir de acá, espera 5 minutos
const TRAMO_2_ESPERA_MS = 5 * 60 * 1000;
const TRAMO_3_FALLOS = 21; // a partir de acá, bloqueo definitivo (IP + cuenta)

function armarClave(ip, email) {
  return `${ip || 'sin-ip'}|${(email || '').toLowerCase().trim()}`;
}

// ¿Esta clave todavía está en tiempo de espera (tramo 1 o 2)? Se llama
// ANTES de tocar bcrypt — si devuelve una fecha, el controller corta ahí
// mismo sin gastar CPU verificando la contraseña.
async function estaEsperando(clave) {
  const fila = await db('login_intentos').where({ clave }).first();
  if (!fila || !fila.espera_hasta) return null;
  const esperaHasta = new Date(fila.espera_hasta);
  return esperaHasta > new Date() ? esperaHasta : null;
}

// Suma un fallo a la clave y decide en qué tramo queda. Devuelve
// {intentos, esperaHasta, bloqueoDefinitivo} para que el controller sepa
// si tiene que además bloquear la IP y la cuenta (tramo 3).
async function registrarFallo(clave) {
  const existente = await db('login_intentos').where({ clave }).first();
  const intentos = (existente?.intentos || 0) + 1;

  let esperaHasta = null;
  let bloqueoDefinitivo = false;
  if (intentos >= TRAMO_3_FALLOS) {
    bloqueoDefinitivo = true;
  } else if (intentos >= TRAMO_2_FALLOS) {
    esperaHasta = new Date(Date.now() + TRAMO_2_ESPERA_MS);
  } else if (intentos >= TRAMO_1_FALLOS) {
    esperaHasta = new Date(Date.now() + TRAMO_1_ESPERA_MS);
  }

  if (existente) {
    await db('login_intentos').where({ clave }).update({
      intentos,
      espera_hasta: esperaHasta,
      updated_at: db.fn.now(),
    });
  } else {
    await db('login_intentos').insert({ clave, intentos, espera_hasta: esperaHasta });
  }

  return { intentos, esperaHasta, bloqueoDefinitivo };
}

// Un login exitoso borra toda la racha de fallos acumulada para esa
// clave — no queda memoria de fallos viejos (ver README).
function limpiar(clave) {
  return db('login_intentos').where({ clave }).del();
}

module.exports = { armarClave, estaEsperando, registrarFallo, limpiar };
