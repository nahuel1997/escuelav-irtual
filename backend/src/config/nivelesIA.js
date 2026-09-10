// Estándares de nivel de "IA aplicada a oficina" que la app sugiere en el
// CV — no es una certificación externa, es una referencia razonable
// calculada sola a partir de cuántos cursos de la categoría "Inteligencia
// Artificial" (ver config/categorias.js) completó el alumno en la
// plataforma. Sirve para que el CV no arranque en blanco en esa sección:
// el alumno lo puede editar/borrar como cualquier otro texto generado.
//
// La lista está ordenada de menor a mayor `minCursos` a propósito:
// calcularNivel recorre de atrás para adelante y devuelve el primer nivel
// cuyo `minCursos` el alumno cumple, así que agregar un nivel intermedio
// nuevo el día de mañana alcanza con insertarlo en el lugar que
// corresponda por cantidad de cursos, sin tocar la función.
const NIVELES = [
  {
    clave: 'inicial',
    minCursos: 0,
    etiqueta: 'Nivel inicial en IA aplicada a la oficina',
    descripcion: 'Recién arrancando a explorar herramientas de inteligencia artificial para tareas de oficina.',
  },
  {
    clave: 'basico',
    minCursos: 1,
    etiqueta: 'Nivel básico — herramientas de IA para tareas de oficina',
    descripcion: 'Maneja las herramientas de IA generativa más comunes (texto, resúmenes, prompting) para el día a día de oficina.',
  },
  {
    clave: 'intermedio',
    minCursos: 2,
    etiqueta: 'Nivel intermedio — automatización y orquestación de agentes de IA',
    descripcion: 'Diseña flujos de agentes de IA encadenados para automatizar tareas repetitivas de oficina.',
  },
  {
    clave: 'avanzado',
    minCursos: 3,
    etiqueta: 'Nivel avanzado — integración de IA con sistemas LMS y flujos completos',
    descripcion: 'Conecta herramientas de IA con sistemas externos (LMS y similares) y arma flujos de trabajo completos end-to-end.',
  },
];

// Devuelve el nivel que corresponde a `cantidadCursosCompletados` — el de
// mayor `minCursos` que la cantidad todavía cumple.
function calcularNivel(cantidadCursosCompletados) {
  const cantidad = Number(cantidadCursosCompletados) || 0;
  let elegido = NIVELES[0];
  for (const nivel of NIVELES) {
    if (cantidad >= nivel.minCursos) elegido = nivel;
  }
  return elegido;
}

module.exports = { NIVELES, calcularNivel };
