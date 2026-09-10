// Links adicionales de menú/footer que el admin puede cargar sin tocar
// código (ej: redes sociales, una página externa, un blog). OJO: esto es
// además de la navegación funcional (Inicio, Tienda, Mis cursos, etc.),
// que sigue resuelta en código porque depende del rol/estado de sesión —
// ver Navbar.jsx. Estos son links "extra" que se agregan al final.
exports.up = function (knex) {
  return knex.schema.createTable('nav_links', (table) => {
    table.increments('id').primary();
    table.string('ubicacion').notNullable(); // 'menu' | 'footer'
    table.string('texto').notNullable();
    table.string('url').notNullable();
    table.integer('orden').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('nav_links');
};
