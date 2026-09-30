// Herramientas del panel de admin (portado de DBA24):
// - users.es_prueba: cuentas creadas por el Tester (se pueden filtrar de
//   reportes y limpiar al cerrar la sesión de prueba).
// - pantallas_bloqueos: una pantalla puntual bloqueada para un usuario
//   puntual (Habilitación de pantallas).
// - tester_sesiones / tester_observaciones: sesiones de prueba y lo que
//   anota el admin mientras prueba (se exporta a PDF).
// - manual_secciones: manual de uso por rol, editable.
const MANUAL = [
  ['alumno', 'Primeros pasos', 'Desde "Tienda de cursos" elegís un curso y lo comprás (o lo sumás al carrito).\nUna vez comprado aparece en "Mis cursos": ahí ves las unidades, los capítulos y tu avance.'],
  ['alumno', 'Clases y turnos', '"Clases en vivo" muestra las clases agendadas de tus cursos; entrás a la sala desde ahí.\nEn "Calendario" pedís un turno con un profesor. Los feriados no se pueden elegir.'],
  ['alumno', 'Ayuda', 'Para algo que necesita seguimiento, abrí una consulta en "Mis consultas": te avisamos por mail cada novedad.\nSi algo no funciona, usá "Reportar error" y sumá capturas de pantalla.\nLos avisos de la escuela llegan a "Alertas": marcalos como recibidos.'],
  ['profesor', 'Tus cursos', 'En "Mis cursos" ves los cursos que dictás, sus alumnos y el temario.\nEn "Calendario" aceptás o rechazás los turnos que te piden.'],
  ['profesor', 'Clases en vivo', 'Las clases las agenda la administración; vos las iniciás y finalizás desde "Clases en vivo".'],
  ['profesor', 'Ayuda', '"Mis consultas" para pedidos a la administración, "Reportar error" si algo falla y "Alertas" para los avisos.'],
  ['admin', 'Panel de admin', 'El menú de la izquierda se puede reordenar y ocultar desde "Menú del panel".\n"Configuración" tiene el modo mantenimiento, las páginas de error, el modo oscuro, los feriados, el logo de los mails y las tareas programadas.'],
  ['admin', 'Seguridad', '"Usuarios": alta/baja y bloqueo de cuentas. "Bloqueados": IPs bloqueadas (el login bloquea solo la IP tras 21 intentos fallidos, nunca la cuenta).\n"Sesiones": conexiones abiertas e intentos de ingreso.'],
  ['admin', 'Soporte y errores', '"Tickets": consultas de alumnos y profesores con seguimiento, notas internas y pedidos de aprobación por mail.\n"Errores": errores del servidor y del navegador agrupados, mails fallidos y los reportes de los usuarios.'],
  ['admin', 'Marketing', '"Campañas": mails de publicidad programados, con segmentos, estadísticas de apertura y clicks, y baja automática.\n"Ofertas en la app": barras, banners y pop-ups con cuenta regresiva, y descuento real en la tienda si se asocia a un curso.'],
  ['soporte', 'Panel de soporte', '"Chats": conversaciones en vivo. "Tickets": consultas con seguimiento — asignalas, respondé, dejá notas internas o pedí una aprobación por mail.'],
];

exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.boolean('es_prueba').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('pantallas_bloqueos', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('pantalla', 40).notNullable();
    table.string('motivo', 300);
    table.integer('bloqueado_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'pantalla']);
  });

  await knex.schema.createTable('tester_sesiones', (table) => {
    table.increments('id').primary();
    table.integer('admin_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('rol', 20).notNullable();
    table.string('nota', 300);
    table.timestamp('cerrada_en');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('tester_observaciones', (table) => {
    table.increments('id').primary();
    table.integer('sesion_id').unsigned().references('id').inTable('tester_sesiones').onDelete('SET NULL');
    table.integer('admin_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('pantalla', 200);
    table.string('tipo', 20).notNullable().defaultTo('bug'); // bug | mejora | ok
    table.text('texto').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('manual_secciones', (table) => {
    table.increments('id').primary();
    table.string('rol', 20).notNullable();
    table.integer('orden').notNullable().defaultTo(0);
    table.string('titulo').notNullable();
    table.text('contenido').notNullable();
    table.timestamps(true, true);
    table.index(['rol']);
  });

  await knex('manual_secciones').insert(MANUAL.map(([rol, titulo, contenido], i) => ({ rol, titulo, contenido, orden: i })));
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('manual_secciones');
  await knex.schema.dropTableIfExists('tester_observaciones');
  await knex.schema.dropTableIfExists('tester_sesiones');
  await knex.schema.dropTableIfExists('pantallas_bloqueos');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('es_prueba');
  });
};
