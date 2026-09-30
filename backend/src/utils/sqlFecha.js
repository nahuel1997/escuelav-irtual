// Fechas para comparar/guardar en la base de forma que ande igual en
// SQLite y en Postgres.
//
// Por qué hace falta: en SQLite, knex manda un objeto Date como NÚMERO
// (milisegundos), pero las columnas con default CURRENT_TIMESTAMP guardan
// TEXTO ('YYYY-MM-DD HH:MM:SS', UTC). SQLite ordena cualquier número antes
// que cualquier texto, así que `where('created_at', '<', new Date())` da
// siempre falso (y '>' siempre verdadero), sin tirar ningún error. Con este
// helper, en SQLite se compara texto contra texto en el mismo formato; en
// Postgres se sigue mandando el Date.
const db = require('../config/db');

function esSqlite() {
  return db.client.config.client === 'better-sqlite3';
}

function paraSql(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (!esSqlite()) return d;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function haceDias(dias) {
  return paraSql(new Date(Date.now() - dias * 86400000));
}

// Al revés: lo que devuelve la base → Date. SQLite devuelve
// 'YYYY-MM-DD HH:MM:SS' sin zona (es UTC); new Date() lo tomaría como hora
// local, así que se le agrega la Z.
function aDate(valor) {
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor)) return new Date(`${valor.replace(' ', 'T')}Z`);
  return new Date(valor);
}

module.exports = { paraSql, haceDias, aDate };
