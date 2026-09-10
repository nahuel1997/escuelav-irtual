// Categorías fijas de curso — antes era texto libre en el form de admin,
// lo que se prestaba a inconsistencias (mayúsculas distintas, typos) que
// rompían cualquier filtro/agrupación por categoría más adelante. Lista
// chica y estable a propósito: no amerita una tabla en la base, para
// agregar o sacar una alcanza con editar este archivo.
//
// A diferencia de estadosCurso.js, el backend NO rechaza un valor de
// categoría que no esté en esta lista al guardar un curso — así un curso
// viejo con una categoría que ya no está acá se puede seguir editando sin
// romperse. La lista es lo que puebla el desplegable del admin
// (GET /api/courses/categories); a partir de ahora, toda categoría nueva
// sale de acá.
module.exports = [
  'Inteligencia Artificial',
  'Programación',
  'Diseño',
  'Marketing',
  'Negocios y emprendimiento',
  'Datos y análisis',
  'Idiomas',
  'Desarrollo personal',
  'Otro',
];
