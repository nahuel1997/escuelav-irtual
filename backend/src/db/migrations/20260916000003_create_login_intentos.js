// Contador de intentos fallidos de login por "clave" (IP + email
// normalizado que se intentó, ver loginIntento.model.js) — es lo que
// alimenta el bloqueo escalonado de 3 tramos del login (10 fallos ->
// espera 1 min, 10 más -> espera 5 min, 1 más -> bloqueo definitivo, ver
// auth.controller.js). Vive en su propia tabla, separada de login_logs
// (que registra sesiones exitosas), porque acá lo que importa es la
// racha de fallos, no el historial de accesos.
exports.up = function (knex) {
  return knex.schema.createTable('login_intentos', (table) => {
    table.increments('id').primary();
    table.string('clave').notNullable().unique();
    table.integer('intentos').notNullable().defaultTo(0);
    // Mientras esta fecha sea futura, el login rebota con "esperá un
    // poco" ANTES de tocar bcrypt/la base de usuarios (ver
    // auth.controller.js) — así un atacante no gasta CPU nuestro
    // verificando contraseñas mientras está en tiempo de espera.
    table.timestamp('espera_hasta');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('login_intentos');
};
