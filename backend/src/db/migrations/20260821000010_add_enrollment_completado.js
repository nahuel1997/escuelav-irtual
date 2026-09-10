exports.up = function (knex) {
  return knex.schema.alterTable('enrollments', (table) => {
    table.timestamp('completado_at');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('enrollments', (table) => {
    table.dropColumn('completado_at');
  });
};
