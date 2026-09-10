// Contenido editable del sitio (textos e imágenes) que el admin puede
// modificar desde el panel sin tocar código. Cada "clave" identifica un
// campo puntual (ej: "home.hero.titulo"); el frontend público tiene un
// valor por defecto hardcodeado y lo pisa con lo que venga de acá si
// existe (ver GET /api/content).
exports.up = function (knex) {
  return knex.schema.createTable('site_content', (table) => {
    table.increments('id').primary();
    table.string('clave').notNullable().unique();
    table.enu('tipo', ['texto', 'imagen']).notNullable().defaultTo('texto');
    table.text('valor');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('site_content');
};
