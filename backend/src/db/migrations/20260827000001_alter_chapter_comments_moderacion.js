// Moderación de comentarios (pedido: el admin/profesor tiene que poder
// responder un comentario y ocultarlo de los alumnos SIN borrarlo).
// - oculto: en vez de borrar, el gestor del curso lo marca oculto — sigue
//   existiendo en la base, pero listComments lo filtra para cualquiera que
//   no sea gestor (ver curriculum.controller.js).
// - parent_comment_id: para que una respuesta del profesor/admin quede
//   asociada al comentario que responde (hilo simple, un solo nivel).
exports.up = function (knex) {
  return knex.schema.alterTable('chapter_comments', (table) => {
    table.boolean('oculto').notNullable().defaultTo(false);
    table.integer('parent_comment_id').unsigned().nullable()
      .references('id').inTable('chapter_comments').onDelete('CASCADE');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('chapter_comments', (table) => {
    table.dropColumn('oculto');
    table.dropColumn('parent_comment_id');
  });
};
