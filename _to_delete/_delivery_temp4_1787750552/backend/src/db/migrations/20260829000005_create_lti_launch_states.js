// El login de LTI 1.3 son dos pasos separados por un ida-y-vuelta al
// navegador (OIDC third-party initiated login): acá guardamos, entre un
// paso y el otro, el "state" (protección CSRF) y el "nonce" (protección
// contra reintentos) que generamos al iniciar el login, para poder
// verificarlos cuando la plataforma nos manda el id_token de vuelta. Cada
// fila se borra apenas se usa (o si nadie completa el login, queda
// "vencida" a los 10 minutos — ver launchValidator.service.js) — no es
// una tabla que crezca sin límite.
exports.up = function (knex) {
  return knex.schema.createTable('lti_launch_states', (table) => {
    table.increments('id').primary();
    table.string('state').notNullable().unique();
    table.string('nonce').notNullable();
    table.integer('platform_id').unsigned().notNullable().references('id').inTable('lti_platforms').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('lti_launch_states');
};
