// Instructivos de "Integraciones IA" (pestaña Vinculaciones — ver
// ai.routes.js): el texto que explica paso a paso cómo sacar la API key
// de ChatGPT/Claude/Gemini y pegarla en nuestro panel. Editable por el
// admin desde /admin-panel/ai-integraciones — mismo patrón EXACTO que
// cv_ai_templates (ver 20260830000001_create_cv_ai_templates.js) y
// email_templates: "clave" es el identificador fijo (chatgpt/claude/
// gemini) que usa el código, "instructivo_html" es el HTML completo que
// se muestra dentro de cada sección desplegable.
exports.up = function (knex) {
  return knex.schema.createTable('ai_integration_templates', (table) => {
    table.increments('id').primary();
    table.string('clave').notNullable().unique();
    table.string('nombre').notNullable();
    table.text('instructivo_html').notNullable();
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('ai_integration_templates');
};
