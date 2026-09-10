// Plantillas HTML de "CV para IA" (ChatGPT / Claude / Gemini), editables
// desde /admin-panel/cv-ia — mismo patrón exacto que email_templates
// (ver 20260825000003_create_email_templates.js): "clave" es el
// identificador fijo que usa el código para saber qué plantilla renderizar
// (services/cvAi/templateEngine.js), "html" es el documento HTML completo
// (no un fragmento) tal cual lo va a ver/descargar el alumno, y
// "variables_disponibles" es solo informativo para la UI del editor.
exports.up = function (knex) {
  return knex.schema.createTable('cv_ai_templates', (table) => {
    table.increments('id').primary();
    table.string('clave').notNullable().unique();
    table.string('nombre').notNullable();
    table.text('html').notNullable();
    table.string('variables_disponibles');
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('cv_ai_templates');
};
