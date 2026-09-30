// Marketing:
// - Campañas de mail programadas (publicidad): contenido, segmento de
//   destinatarios, fecha/hora de envío y estado. Cada envío tiene un token
//   propio para medir aperturas y clicks y para darse de baja.
// - users.acepta_publicidad: la baja de publicidad (link en cada campaña).
//   Los mails de servicio (compras, turnos, tickets) se siguen mandando.
// - Ofertas en la app: barra, banner o pop-up con cuenta regresiva, para un
//   público, con descuento real sobre un curso si se asocia uno.
exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.boolean('acepta_publicidad').notNullable().defaultTo(true);
    table.timestamp('baja_publicidad_en');
  });

  await knex.schema.createTable('ofertas', (table) => {
    table.increments('id').primary();
    table.string('titulo', 120).notNullable();
    table.string('mensaje', 500);
    table.string('tipo', 20).notNullable().defaultTo('barra'); // barra | banner | popup
    table.string('imagen_url', 500);
    table.string('color_fondo', 7).notNullable().defaultTo('#e0972d');
    table.string('color_texto', 7).notNullable().defaultTo('#1a1f26');
    table.string('boton_texto', 60);
    table.string('boton_url', 500);
    table.integer('curso_id').unsigned().references('id').inTable('courses').onDelete('SET NULL');
    table.integer('descuento_pct'); // 1-90, solo si hay curso
    table.string('audiencia', 20).notNullable().defaultTo('todos'); // todos | visitantes | alumnos | profesores
    table.timestamp('inicia_en').notNullable();
    table.timestamp('termina_en').notNullable();
    table.boolean('mostrar_contador').notNullable().defaultTo(true);
    table.boolean('activa').notNullable().defaultTo(true);
    table.integer('prioridad').notNullable().defaultTo(0);
    table.integer('creada_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('oferta_eventos', (table) => {
    table.increments('id').primary();
    table.integer('oferta_id').unsigned().notNullable().references('id').inTable('ofertas').onDelete('CASCADE');
    table.string('tipo', 20).notNullable(); // vista | click | cerrada
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('visitante', 64);
    table.timestamp('ts').defaultTo(knex.fn.now());
    table.index(['oferta_id', 'tipo']);
  });

  await knex.schema.createTable('campanias', (table) => {
    table.increments('id').primary();
    table.string('nombre', 120).notNullable(); // interno
    table.string('asunto', 200).notNullable();
    table.string('titulo', 200).notNullable();
    table.text('contenido').notNullable(); // texto, un párrafo por línea
    table.string('imagen_url', 500);
    table.string('boton_texto', 60);
    table.string('boton_url', 500);
    table.integer('oferta_id').unsigned().references('id').inTable('ofertas').onDelete('SET NULL');
    table.text('segmento').notNullable(); // JSON
    table.timestamp('programada_para');
    // borrador | programada | enviando | enviada | cancelada | error
    table.string('estado').notNullable().defaultTo('borrador');
    table.integer('total_destinatarios').notNullable().defaultTo(0);
    table.integer('enviados').notNullable().defaultTo(0);
    table.integer('fallidos').notNullable().defaultTo(0);
    table.integer('proceso_id').unsigned().references('id').inTable('procesos').onDelete('SET NULL');
    table.integer('creada_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('enviada_en');
    table.timestamps(true, true);
    table.index(['estado', 'programada_para']);
  });

  await knex.schema.createTable('campania_envios', (table) => {
    table.increments('id').primary();
    table.integer('campania_id').unsigned().notNullable().references('id').inTable('campanias').onDelete('CASCADE');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('email').notNullable();
    table.string('token', 64).notNullable().unique();
    table.string('estado', 20).notNullable().defaultTo('pendiente'); // pendiente | enviado | fallido
    table.string('error', 300);
    table.timestamp('enviado_en');
    table.timestamp('abierto_en');
    table.timestamp('click_en');
    table.integer('clicks').notNullable().defaultTo(0);
    table.timestamp('baja_en');
    table.unique(['campania_id', 'user_id']);
  });
};

exports.down = async function (knex) {
  for (const t of ['campania_envios', 'campanias', 'oferta_eventos', 'ofertas']) await knex.schema.dropTableIfExists(t);
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('acepta_publicidad');
    table.dropColumn('baja_publicidad_en');
  });
};
