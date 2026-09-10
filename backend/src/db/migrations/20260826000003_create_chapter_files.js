// Archivos de utilidad de un capítulo (apuntes, código fuente, planillas,
// etc.). Opcionales: un capítulo puede no tener ninguno, en cuyo caso esa
// sección directamente no aparece en la página del capítulo.
exports.up = function (knex) {
  return knex.schema.createTable('chapter_files', (table) => {
    table.increments('id').primary();
    table.integer('chapter_id').unsigned().notNullable().references('id').inTable('course_chapters').onDelete('CASCADE');
    table.string('archivo_path').notNullable();
    table.string('archivo_nombre_original');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('chapter_files');
};
