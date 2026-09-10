// Unidades ("temas") de un curso: el primer nivel de la jerarquía
// curso > unidad > capítulo. Cada unidad tiene su propia página de detalle
// con introducción y un resumen de qué se va a ver, antes de entrar a sus
// capítulos.
exports.up = function (knex) {
  return knex.schema.createTable('course_units', (table) => {
    table.increments('id').primary();
    table.integer('course_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.string('titulo').notNullable();
    table.text('introduccion'); // Texto de la página de detalle de la unidad.
    table.text('contenido'); // "Qué vas a ver en esta unidad" (temario/bullets en texto libre).
    table.integer('orden').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('course_units');
};
