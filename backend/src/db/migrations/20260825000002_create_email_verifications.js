// Códigos de 6 dígitos para validar la cuenta por mail. Se genera uno al
// registrarse (o al pedir un reenvío) y se guarda acá con su vencimiento —
// nunca en la tabla users, para poder tener el historial y no pisar el
// código anterior mientras esté vigente.
exports.up = function (knex) {
  return knex.schema.createTable('email_verifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('codigo', 6).notNullable();
    table.timestamp('expira_en').notNullable();
    table.timestamp('verificado_at');
    table.integer('intentos').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Último código vigente de un usuario: se busca todo el tiempo por acá.
    table.index(['user_id', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('email_verifications');
};
