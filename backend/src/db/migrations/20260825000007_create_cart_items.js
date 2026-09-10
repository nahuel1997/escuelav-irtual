exports.up = function (knex) {
  return knex.schema.createTable('cart_items', (table) => {
    table.increments('id').primary();
    table.integer('cart_id').unsigned().notNullable().references('id').inTable('carts').onDelete('CASCADE');
    table.integer('course_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.timestamp('agregado_at').defaultTo(knex.fn.now());
    // No tiene sentido el mismo curso dos veces en un mismo carrito.
    table.unique(['cart_id', 'course_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('cart_items');
};
