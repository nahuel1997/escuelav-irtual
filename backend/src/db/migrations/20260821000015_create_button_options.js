// Registro global y reutilizable de estilos de botón ("Opción 1", "Opción
// 2"...). Se define acá (fondo, color de texto, link) y después, en cada
// pestaña de página, se elige qué opción usa cada botón puntual — el
// nombre "Opción N" se arma con el id, así no hay que renombrar nada
// cuando se borra una opción del medio (ver button.model.js).
exports.up = function (knex) {
  return knex.schema.createTable('button_options', (table) => {
    table.increments('id').primary();
    table.string('color_fondo').notNullable().defaultTo('#16324a');
    table.string('color_texto').notNullable().defaultTo('#ffffff');
    table.string('link').notNullable().defaultTo('/');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('button_options');
};
