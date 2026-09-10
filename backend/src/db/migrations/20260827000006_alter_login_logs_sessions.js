// Convierte login_logs (que ya guardaba inicio/fin de cada conexión) en el
// registro completo de "sesiones" que necesita el admin: de dónde se
// conectó (ip + país/provincia resueltos por geolocalización, ver
// services/geo.service.js) y un identificador (`jti`) que ata cada fila a
// un JWT puntual, para poder invalidarlo antes de que expire solo —
// jwt.verify() no sabe nada de "revocado", así que ese chequeo lo hace el
// middleware de auth consultando esta tabla (ver auth.middleware.js).
//
// `revoked_at` es distinto de `logout_at`: logout_at lo pone el propio
// usuario al cerrar sesión desde la app; revoked_at lo pone un admin
// forzando el cierre de una sesión ajena (ver admin.controller.js). Las
// dos cuentan como "sesión terminada" para el middleware.
exports.up = function (knex) {
  return knex.schema.alterTable('login_logs', (table) => {
    table.string('jti').nullable().index();
    table.string('ip').nullable();
    table.string('user_agent').nullable();
    table.string('pais').nullable();
    table.string('provincia').nullable();
    table.timestamp('revoked_at').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('login_logs', (table) => {
    table.dropColumn('jti');
    table.dropColumn('ip');
    table.dropColumn('user_agent');
    table.dropColumn('pais');
    table.dropColumn('provincia');
    table.dropColumn('revoked_at');
  });
};
