// Capítulos: el segundo nivel de la jerarquía (dentro de una unidad). Cada
// capítulo es un video (link externo a YouTube/Vimeo, se detecta el
// proveedor por el formato de la URL — no hace falta guardarlo aparte).
exports.up = function (knex) {
  return knex.schema.createTable('course_chapters', (table) => {
    table.increments('id').primary();
    table.integer('unit_id').unsigned().notNullable().references('id').inTable('course_units').onDelete('CASCADE');
    table.string('titulo').notNullable();
    table.string('video_url').notNullable();
    table.integer('orden').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('course_chapters');
};
