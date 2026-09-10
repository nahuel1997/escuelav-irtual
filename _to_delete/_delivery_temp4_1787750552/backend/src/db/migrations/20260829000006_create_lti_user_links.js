// Mapeo entre "quién es este usuario en la plataforma externa" (el claim
// `sub` del id_token, único por plataforma) y "quién es en esta app". Se
// crea solo la primera vez que esa persona entra por LTI (ver
// userProvisioning.service.js): si ya existe una cuenta local con el
// mismo email la reutiliza (evita cuentas duplicadas para quien además
// usa el login normal), si no, crea una cuenta nueva.
exports.up = function (knex) {
  return knex.schema.createTable('lti_user_links', (table) => {
    table.increments('id').primary();
    table.integer('platform_id').unsigned().notNullable().references('id').inTable('lti_platforms').onDelete('CASCADE');
    table.string('lti_sub').notNullable();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['platform_id', 'lti_sub']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('lti_user_links');
};
