// Acceso de "API de datos" para sistemas externos: el admin da de alta un
// usuario/contraseña (api_clients), le asigna qué tablas puede leer y con
// qué columnas exactas dentro de cada una (api_client_permisos — nunca
// "toda la tabla" por defecto, el admin elige columna por columna), y
// queda un registro de cada consulta real (api_usage_log: cuándo, cuánto
// tardó, desde qué IP) — ver dataApi.controller.js para el endpoint que
// consumen estos clientes y admin/apiClients.controller.js para la
// gestión desde el panel.
//
// `password_hash` nunca se puede leer de vuelta (mismo criterio que
// users.password_hash): la contraseña se muestra una única vez, al
// crearla o regenerarla (ver apiClient.model.js) — si se pierde, se
// regenera, no se recupera.
exports.up = function (knex) {
  return knex.schema
    .createTable('api_clients', (table) => {
      table.increments('id').primary();
      table.string('username').notNullable().unique();
      table.string('password_hash').notNullable();
      table.boolean('activo').notNullable().defaultTo(true);
      table.text('descripcion'); // para qué es este acceso (lo carga el admin, informativo)
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('api_client_permisos', (table) => {
      table.increments('id').primary();
      table.integer('client_id').unsigned().notNullable().references('id').inTable('api_clients').onDelete('CASCADE');
      table.string('tabla').notNullable();
      table.text('columnas').notNullable(); // JSON: ["id", "titulo", ...]
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['client_id', 'tabla']);
    })
    .createTable('api_usage_log', (table) => {
      table.increments('id').primary();
      table.integer('client_id').unsigned().notNullable().references('id').inTable('api_clients').onDelete('CASCADE');
      table.string('tabla').notNullable();
      table.string('ip');
      table.integer('duracion_ms');
      table.integer('filas_devueltas');
      table.timestamp('creado_at').defaultTo(knex.fn.now());
      table.index(['client_id']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('api_usage_log')
    .then(() => knex.schema.dropTableIfExists('api_client_permisos'))
    .then(() => knex.schema.dropTableIfExists('api_clients'));
};
