exports.up = function (knex) {
  return knex.schema.createTable('enrollments', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('course_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.string('payment_status').notNullable().defaultTo('pagado'); // simulado por ahora
    table.string('payment_method').notNullable().defaultTo('simulado');
    table.string('transaction_id');
    table.timestamp('purchased_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'course_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('enrollments');
};
