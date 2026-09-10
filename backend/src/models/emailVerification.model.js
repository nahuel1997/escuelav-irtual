// Capa de acceso a "email_verifications" — códigos de 6 dígitos para
// validar la cuenta (ver auth.controller.js: register los genera,
// verify-email los consume).
const db = require('../config/db');

const MINUTOS_VIGENCIA = 15;
const INTENTOS_MAXIMOS = 5;

function generarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000)); // siempre 6 dígitos
}

async function crear(userId) {
  const codigo = generarCodigo();
  const expira_en = new Date(Date.now() + MINUTOS_VIGENCIA * 60 * 1000);
  await db('email_verifications').insert({ user_id: userId, codigo, expira_en });
  return { codigo, expira_en };
}

// El código vigente más reciente de un usuario (todavía no usado). Solo
// nos interesa el último: si pidió reenviar, los anteriores quedan
// "muertos" aunque sigan en la tabla (historial).
function ultimoVigente(userId) {
  return db('email_verifications').where({ user_id: userId }).whereNull('verificado_at').orderBy('created_at', 'desc').first();
}

function incrementarIntentos(id) {
  return db('email_verifications').where({ id }).increment('intentos', 1);
}

function marcarVerificado(id) {
  return db('email_verifications').where({ id }).update({ verificado_at: db.fn.now() });
}

module.exports = { crear, ultimoVigente, incrementarIntentos, marcarVerificado, MINUTOS_VIGENCIA, INTENTOS_MAXIMOS };
