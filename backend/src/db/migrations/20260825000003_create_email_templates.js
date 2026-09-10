// Plantillas de todos los mails que manda la plataforma. Viven en la base
// (no hardcodeadas en el código) para que el admin pueda editar el asunto
// y el cuerpo desde /admin-panel/mails sin necesitar un deploy — mismo
// criterio que site_content para los textos del sitio público.
//
// "clave" es el identificador fijo que usa el código para saber qué
// plantilla renderizar (ver mail.service.js). "variables_disponibles" es
// solo informativo para la UI del editor (qué {{variables}} puede usar esa
// plantilla puntual).
exports.up = function (knex) {
  return knex.schema.createTable('email_templates', (table) => {
    table.increments('id').primary();
    table.string('clave').notNullable().unique();
    table.string('nombre').notNullable();
    table.string('asunto').notNullable();
    table.text('cuerpo_html').notNullable();
    table.string('variables_disponibles'); // lista separada por comas, solo para mostrar en el editor
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('email_templates');
};
