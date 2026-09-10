// "GPTs" propios del alumno, dentro de "Integraciones IA": no existe
// forma de crear un Custom GPT real de ChatGPT, un Proyecto real de
// Claude ni una Gem real de Gemini con una simple API key — ninguno de
// los 3 proveedores expone eso por su API pública, solo por su interfaz
// web de consumidor con cuenta propia (investigado y confirmado antes de
// construir esto, ver README "Integraciones IA — GPTs propios" para el
// detalle completo por proveedor).
//
// Esto es el equivalente FUNCIONAL, alojado 100% en esta plataforma: el
// alumno arma un nombre + instrucciones (personalidad/system prompt) +
// conocimiento de referencia opcional, elige con qué IA ya vinculada lo
// va a usar, y después puede iniciar conversaciones "con" ese GPT — ver
// el alter de ai_conversations en la migración siguiente para cómo se
// engancha con el chat real.
exports.up = function (knex) {
  return knex.schema.createTable('ai_gpts', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('proveedor').notNullable(); // 'chatgpt' | 'claude' | 'gemini'
    table.string('nombre').notNullable();
    table.text('instrucciones').notNullable(); // personalidad / system prompt
    table.text('conocimiento'); // opcional: texto de referencia pegado por el alumno
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['user_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('ai_gpts');
};
