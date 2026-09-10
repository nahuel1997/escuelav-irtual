// Link opcional de cada inscripción a la orden de pago real que la generó
// (cuando vino de Mercado Pago o PayPal) — nullable porque la mayoría de
// las inscripciones existentes (y las que se sigan generando en modo
// simulado, sin método de pago real elegido) no tienen una orden detrás.
// Sirve sobre todo para debug/soporte: "este alumno dice que pagó, ¿qué
// pasó con esa orden puntual?".
exports.up = function (knex) {
  return knex.schema.alterTable('enrollments', (table) => {
    table.integer('payment_order_id').unsigned().references('id').inTable('payment_orders').onDelete('SET NULL');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('enrollments', (table) => {
    table.dropColumn('payment_order_id');
  });
};
