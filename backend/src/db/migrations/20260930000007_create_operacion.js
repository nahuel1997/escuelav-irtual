// Tablas de operación del backoffice (portado de DBA24):
// - metricas_app: foto horaria del estado del servidor (Estado de la app).
// - trafico_eventos: páginas vistas y actividad (Tráfico). Se poda sola.
// - backups_admins / actualizaciones_admins: listas blancas independientes
//   de quién puede entrar a Backups y a Actualizaciones.
// - versiones: registro de cambios (changelog) editable.
// - procesos: cola de procesos en segundo plano (P-000123).
// - jobs_config: tareas programadas configurables desde el panel.
exports.up = async function (knex) {
  await knex.schema.createTable('metricas_app', (table) => {
    table.increments('id').primary();
    table.timestamp('ts').notNullable().defaultTo(knex.fn.now());
    table.integer('rss_mb');
    table.integer('heap_mb');
    table.float('carga_cpu');
    table.float('lag_p99_ms');
    table.integer('requests');
    table.float('latencia_prom_ms');
    table.integer('errores_5xx');
    table.integer('usuarios_online');
    table.index(['ts']);
  });

  await knex.schema.createTable('trafico_eventos', (table) => {
    table.increments('id').primary();
    table.timestamp('ts').notNullable().defaultTo(knex.fn.now());
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('rol', 20); // null = visitante sin sesión
    table.string('visitante', 64); // id anónimo del navegador (sin datos personales)
    table.string('pagina', 300).notNullable();
    table.string('referencia', 300);
    table.string('dispositivo', 20); // escritorio | celular | tablet
    table.index(['ts']);
    table.index(['pagina']);
  });

  for (const nombre of ['backups_admins', 'actualizaciones_admins']) {
    await knex.schema.createTable(nombre, (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
      table.integer('agregado_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  await knex.schema.createTable('versiones', (table) => {
    table.increments('id').primary();
    table.string('version', 30).notNullable().unique();
    table.date('fecha').notNullable();
    table.string('titulo').notNullable();
    table.text('cambios').notNullable(); // un cambio por línea
    table.timestamps(true, true);
  });

  await knex.schema.createTable('procesos', (table) => {
    table.increments('id').primary();
    table.string('tipo', 60).notNullable();
    // pendiente | en_curso | terminado | error | cancelado
    table.string('estado').notNullable().defaultTo('pendiente');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('titulo');
    table.text('parametros'); // JSON
    table.text('resultado'); // JSON
    table.string('archivo'); // archivo generado en privado/procesos
    table.string('archivo_nombre');
    table.string('archivo_mime');
    table.text('error');
    table.integer('progreso').notNullable().defaultTo(0);
    table.integer('intentos').notNullable().defaultTo(0);
    table.timestamp('iniciado_en');
    table.timestamp('terminado_en');
    table.timestamps(true, true);
    table.index(['estado']);
    table.index(['user_id']);
  });

  await knex.schema.createTable('jobs_config', (table) => {
    table.increments('id').primary();
    table.string('clave').notNullable().unique();
    table.boolean('activo').notNullable().defaultTo(true);
    table.string('cron', 60).notNullable();
    table.timestamp('ultima_ejecucion');
    table.string('ultimo_resultado', 500);
    table.boolean('ultimo_ok');
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  for (const t of ['jobs_config', 'procesos', 'versiones', 'actualizaciones_admins', 'backups_admins', 'trafico_eventos', 'metricas_app']) {
    await knex.schema.dropTableIfExists(t);
  }
};
