exports.up = function (knex) {
  return knex.schema.createTable('user_achievements', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('achievement_id').unsigned().notNullable().references('id').inTable('achievements').onDelete('CASCADE');
    table.timestamp('achieved_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'achievement_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('user_achievements');
};
