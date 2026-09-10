// Registro de errores reales de la aplicación (5xx), capturado desde el
// errorHandler central (ver middlewares/error.middleware.js). A propósito
// NO logueamos errores 4xx acá (permisos, validaciones de negocio como
// "ya estás inscripto"): eso pasa todo el tiempo en el uso normal y
// llenaría la tabla de ruido; lo que sirve ver en "Errores" son los fallos
// inesperados del sistema.
exports.up = function (knex) {
  return knex.schema.createTable('error_logs', (table) => {
    table.increments('id').primary();
    table.integer('status').notNullable();
    table.string('mensaje').notNullable();
    table.string('ruta');
    table.string('metodo');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('error_logs');
};
