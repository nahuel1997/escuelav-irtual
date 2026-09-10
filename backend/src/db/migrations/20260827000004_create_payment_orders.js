// payment_orders — una fila por cada intento de pago real (Mercado Pago o
// PayPal). No existía hasta ahora porque el pago era 100% simulado y
// síncrono: se cobraba y se inscribía en la misma request (ver
// payments.service.js). Un pago real es asíncrono — se crea la orden acá
// "pendiente", se manda al alumno a la pasarela, y recién se confirma
// cuando llega el webhook (o, como red de seguridad, cuando el alumno
// vuelve a la app y re-consultamos el estado real contra la API del
// proveedor) — nunca confiamos ciegamente en el redirect ni en el body
// que manda el webhook sin volver a preguntarle al proveedor.
//
// `items` guarda un snapshot en JSON de qué se estaba comprando (curso(s),
// título, precio) en el momento de iniciar el pago — si un curso cambia de
// precio o de estado mientras el alumno todavía está en la pasarela, la
// orden sigue reflejando lo que se le mostró y cobró en su momento.
exports.up = function (knex) {
  return knex.schema.createTable('payment_orders', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('provider').notNullable(); // 'mercadopago' | 'paypal'
    table.string('external_id'); // preference id (MP) u order id (PayPal)
    table.string('payment_id'); // payment id (MP) o capture id (PayPal), recién al aprobarse
    table.string('status').notNullable().defaultTo('pendiente'); // pendiente | aprobado | rechazado | cancelado
    table.text('items').notNullable(); // JSON: [{course_id, titulo, precio}]
    table.decimal('total', 10, 2).notNullable();
    table.string('moneda').notNullable().defaultTo('ARS'); // ARS (MP) o USD (PayPal, ver paypal_tasa_cambio_usd)
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('paid_at');
    table.index(['user_id']);
    table.index(['provider', 'external_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('payment_orders');
};
