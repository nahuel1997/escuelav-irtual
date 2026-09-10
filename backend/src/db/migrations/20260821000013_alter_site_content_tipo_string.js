// Mismo problema que ya resolvimos con users.rol (ver migración
// 20260821000009): "tipo" estaba armado como enu() de knex, que en SQLite
// se traduce en un CHECK constraint que no se puede alterar más adelante.
// Como ahora vamos a sumar tipos nuevos (color, selección de tipografía,
// referencia a un botón), lo pasamos a string plano y la validez la
// controla la aplicación (ver utils/contentTipos.js).
exports.up = async function (knex) {
  await knex.schema.alterTable('site_content', (table) => {
    table.dropColumn('tipo');
  });
  await knex.schema.alterTable('site_content', (table) => {
    table.string('tipo').notNullable().defaultTo('texto');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('site_content', (table) => {
    table.dropColumn('tipo');
  });
  await knex.schema.alterTable('site_content', (table) => {
    table.enu('tipo', ['texto', 'imagen']).notNullable().defaultTo('texto');
  });
};
