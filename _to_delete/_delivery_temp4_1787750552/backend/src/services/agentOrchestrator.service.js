// Motor de ejecución de un flujo de agentes: por ahora la "orquestación"
// es una cadena secuencial simple — el ORDEN del arreglo de nodos es el
// orden de ejecución, y la salida de cada agente es el contexto de
// entrada del siguiente (así se ve en la práctica qué significa
// "orquestar" varios agentes: uno le pasa la posta al otro). No hay
// ramas ni ejecución en paralelo todavía — es el caso de uso que más
// aparece en los cursos de la plataforma (clasificar → resumir → generar
// reporte, por ejemplo) y es suficiente para un sandbox educativo.
const { getProveedor } = require('./agentProviders');

async function ejecutarFlujo(nodos) {
  const pasos = [];
  let contextoPrevio = null;

  for (const nodo of nodos) {
    const proveedor = getProveedor(nodo.proveedor);
    const inicio = Date.now();
    // eslint-disable-next-line no-await-in-loop
    const { texto, meta } = await proveedor.ejecutar({ nodo, contextoPrevio });
    pasos.push({
      nodoId: nodo.id,
      nombre: nodo.nombre,
      proveedor: nodo.proveedor,
      salida: texto,
      meta: { ...meta, duracionMs: Date.now() - inicio },
    });
    contextoPrevio = texto;
  }

  return { pasos, resultadoFinal: contextoPrevio };
}

module.exports = { ejecutarFlujo };
