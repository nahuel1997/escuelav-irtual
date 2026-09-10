// Registro de cada mail que la plataforma intentó mandar (transaccional o
// de campaña). Es al mismo tiempo auditoría y la fuente de datos del panel
// "Registro de envíos" en /admin-panel/mails. Ya estaba pensada en el
// informe de base de datos para el equipo de DBA (sección 4.3) — se crea
// acá porque ahora sí se implementa el motor de mails que la llena.
exports.up = function (knex) {
  return knex.schema.createTable('mail_log', (table) => {
    table.increments('id').primary();
    table.string('destinatario').notNullable();
    table.string('remitente').notNullable();
    table.string('asunto').notNullable();
    table.text('cuerpo').notNullable();
    // Clave de la plantilla usada (ver email_templates.clave) — permite
    // filtrar el registro por tipo de mail sin depender de parsear el asunto.
    table.string('tipo').notNullable();
    table.string('estado').notNullable().defaultTo('pendiente'); // pendiente | enviado | fallido
    table.string('proveedor'); // 'test' (Ethereal) | 'smtp' | el que se configure
    table.string('proveedor_message_id');
    // Solo se completa en modo prueba (Ethereal): link para ver el mail
    // "recibido" sin necesidad de una casilla real, útil para el botón de
    // pruebas del panel de admin.
    table.string('preview_url');
    table.integer('intentos').notNullable().defaultTo(0);
    table.text('error_detalle');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.integer('mailing_list_id').unsigned(); // se completa si vino de un envío de lista (FK se agrega en su propia migración)
    table.timestamp('enviado_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tipo', 'created_at']);
    table.index(['estado']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('mail_log');
};
