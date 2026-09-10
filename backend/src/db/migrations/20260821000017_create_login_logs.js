// Registro de inicio/fin de sesión. Con JWT no hay sesión server-side, así
// que "fin de conexión" se marca cuando el usuario aprieta "Cerrar sesión"
// (POST /api/auth/logout, ver auth.controller.js). Si cierra la pestaña
// sin desloguearse, logout_at queda null — se muestra como "sesión activa"
// en el panel de admin. Es una limitación honesta de JWT, no un bug.
exports.up = function (knex) {
  return knex.schema.createTable('login_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('login_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('logout_at');
    table.index(['user_id', 'login_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('login_logs');
};
