// Suma "es_prueba" a payment_orders: distingue una orden real (cursos que
// de verdad compró un alumno) de una generada desde /admin-panel/testing
// con la herramienta "Test Pagos" (ver
// checkout.service.js::iniciarOrdenDePrueba). Se agregó para poder
// ejercitar el recorrido de pago real (Mercado Pago/PayPal) de punta a
// punta desde el panel de admin, con un precio libre, SIN que eso
// inscriba a nadie en ningún curso, otorgue el logro de "primer curso" ni
// dispare el mail de confirmación de compra — checkout.service.js
// ::finalizarOrden corta ahí apenas confirma el pago si la orden es de
// prueba, antes de tocar enrollments/achievements/mail.
exports.up = function (knex) {
  return knex.schema.alterTable('payment_orders', (table) => {
    table.boolean('es_prueba').notNullable().defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('payment_orders', (table) => {
    table.dropColumn('es_prueba');
  });
};
