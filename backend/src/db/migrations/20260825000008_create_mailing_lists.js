// Listas armables a mano desde el backoffice para mandar ofertas o avisos
// (ej: "Oferta Black Friday", "Corte de mantenimiento"). Se arman
// eligiendo alumnos y/o profesores puntuales, con selección múltiple —
// ver mailing_list_members.
exports.up = function (knex) {
  return knex.schema.createTable('mailing_lists', (table) => {
    table.increments('id').primary();
    table.string('nombre').notNullable();
    table.text('descripcion');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('mailing_lists');
};
