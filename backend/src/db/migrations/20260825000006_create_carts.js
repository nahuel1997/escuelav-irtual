// Carrito de compras de la tienda de cursos. Antes la compra era directa
// (un solo curso, un solo click en "Comprar/Inscribirme" — eso se
// mantiene sin cambios para quien lo prefiera). El carrito es persistente
// en la base (no localStorage) justamente para que el servidor pueda
// detectar solo un carrito "abandonado" y disparar el mail correspondiente
// (ver jobs/carritoAbandonado.job.js), sin depender de que el navegador
// siga abierto.
//
// Un usuario tiene como máximo un carrito "activo" a la vez, pero eso se
// controla en la capa de aplicación (cart.model.js busca o crea), no con
// un unique acá: con el tiempo un mismo usuario va a tener varias filas en
// esta tabla (una por cada carrito viejo ya convertido o abandonado), así
// que la unicidad real es "a lo sumo un carrito con estado='activo'".
exports.up = function (knex) {
  return knex.schema.createTable('carts', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('estado').notNullable().defaultTo('activo'); // activo | convertido | abandonado
    table.timestamp('recordatorio_enviado_at'); // evita mandar el mail de abandono más de una vez por carrito
    table.timestamp('convertido_at');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('carts');
};
