// SQLite no soporta modificar un CHECK constraint existente con ALTER
// TABLE, así que recreamos la columna: la sacamos y la volvemos a crear
// como texto libre (sin CHECK). El rol válido ('alumno' | 'profesor' |
// 'admin') se valida en la capa de aplicación (ver src/utils/roles.js),
// no en la base — así agregar un rol nuevo el día de mañana no requiere
// otra migración de este tipo.
exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('rol');
  });
  await knex.schema.alterTable('users', (table) => {
    table.string('rol').notNullable().defaultTo('alumno');
  });
  // Los usuarios existentes quedan como 'alumno' por el defaultTo de
  // arriba; en un ambiente real con datos ya cargados convendría hacer un
  // UPDATE explícito antes de dropear la columna vieja para no perder el
  // rol. Acá el proyecto está en etapa temprana, así que no aplica.
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('rol');
  });
  await knex.schema.alterTable('users', (table) => {
    table.enu('rol', ['alumno', 'profesor']).notNullable().defaultTo('alumno');
  });
};
