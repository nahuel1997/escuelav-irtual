// Seguridad de la API de datos (/api/data, accesos de sistemas externos) —
// mismo perímetro que la "Gestión de API" de DBA24:
// - api_bloqueados: IPs o usuarios de API bloqueados (a mano, o la IP sola
//   por fuerza bruta). Separado de ips_bloqueadas (login de la app) a
//   propósito: bloquear una integración no tiene por qué dejar a esa red
//   sin poder entrar a la escuela, y viceversa.
// - api_bruteforce: racha de fallos de autenticación por IP + usuario de
//   API (10 -> 1 min, 10 más -> 5 min, 1 más -> se bloquea la IP; el
//   usuario de API nunca se bloquea solo, así nadie le corta la
//   integración a un sistema legítimo sabiendo su nombre de usuario).
// - api_errores: el texto de cada error que devuelve la API, editable
//   desde el panel (el código y el status HTTP quedan fijos).
exports.up = async function (knex) {
  await knex.schema.createTable('api_bloqueados', (table) => {
    table.increments('id').primary();
    table.string('tipo').notNullable(); // 'ip' | 'usuario'
    table.string('valor').notNullable();
    table.text('motivo').notNullable();
    table.integer('bloqueado_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    table.unique(['tipo', 'valor']);
  });

  await knex.schema.createTable('api_bruteforce', (table) => {
    table.increments('id').primary();
    table.string('clave').notNullable().unique();
    table.integer('fallos').notNullable().defaultTo(0);
    table.integer('etapa').notNullable().defaultTo(0);
    table.timestamp('bloqueado_hasta');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('api_errores', (table) => {
    table.increments('id').primary();
    table.string('codigo').notNullable().unique();
    table.integer('http_status').notNullable();
    table.text('mensaje').notNullable();
    table.text('descripcion');
    table.timestamps(true, true);
  });

  await knex('api_errores').insert([
    { codigo: 'SIN_AUTENTICACION', http_status: 401, mensaje: 'Falta autenticación (usuario y contraseña de la API)', descripcion: 'No mandó el header Authorization: Basic.' },
    { codigo: 'CREDENCIALES_MAL_FORMADAS', http_status: 401, mensaje: 'Credenciales mal formadas', descripcion: 'El header Basic no se pudo decodificar.' },
    { codigo: 'CREDENCIALES_INVALIDAS', http_status: 401, mensaje: 'Usuario o contraseña incorrectos', descripcion: 'Usuario inexistente o contraseña incorrecta.' },
    { codigo: 'ACCESO_DESACTIVADO', http_status: 403, mensaje: 'Este acceso fue desactivado', descripcion: 'El acceso existe pero está desactivado desde el panel.' },
    { codigo: 'BLOQUEADO', http_status: 403, mensaje: 'Acceso bloqueado. Contactá al administrador de la escuela.', descripcion: 'La IP o el usuario de API están bloqueados.' },
    { codigo: 'DEMASIADOS_INTENTOS', http_status: 429, mensaje: 'Demasiados intentos fallidos. Esperá {espera} antes de volver a intentar.', descripcion: 'Fuerza bruta: {espera} se reemplaza por el tiempo que falta.' },
    { codigo: 'TABLA_SIN_PERMISO', http_status: 403, mensaje: 'No tenés acceso a esta tabla', descripcion: 'El acceso no tiene permiso sobre la tabla pedida.' },
    { codigo: 'COLUMNAS_INEXISTENTES', http_status: 409, mensaje: 'Ninguna de las columnas habilitadas existe ya en esta tabla — pedile al admin que revise el acceso', descripcion: 'Las columnas habilitadas ya no existen.' },
  ]);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('api_errores');
  await knex.schema.dropTableIfExists('api_bruteforce');
  await knex.schema.dropTableIfExists('api_bloqueados');
};
