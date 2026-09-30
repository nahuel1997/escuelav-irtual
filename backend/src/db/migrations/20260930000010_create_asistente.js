// Asistente IA del panel de admin (el "bot" de DBA24): cada conversación
// guarda la lista COMPLETA de mensajes tal como la devolvió la API
// (incluidos los bloques de razonamiento y de herramientas), y solo se le
// agregan mensajes al final — nunca se edita lo anterior, porque los
// bloques de razonamiento dejan de ser válidos si cambia el historial.
exports.up = async function (knex) {
  await knex.schema.createTable('asistente_conversaciones', (table) => {
    table.increments('id').primary();
    table.integer('admin_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('titulo', 200);
    table.text('mensajes').notNullable(); // JSON: Anthropic MessageParam[]
    table.integer('tokens_entrada').notNullable().defaultTo(0);
    table.integer('tokens_salida').notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.index(['admin_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('asistente_conversaciones');
};
