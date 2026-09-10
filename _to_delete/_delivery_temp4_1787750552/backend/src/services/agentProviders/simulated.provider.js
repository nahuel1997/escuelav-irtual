// =============================================================================
// simulated.provider.js — motor de ejecución SIMULADA de un agente.
//
// Ningún proveedor llama todavía a una IA real: esto es un sandbox
// educativo (así lo pidieron explícitamente) que arma una respuesta con
// una plantilla, sin red, sin costo y sin necesitar ninguna API key. Lo
// que sí hace de verdad es usar el rol/instrucciones que cargó el alumno
// y encadenar el contexto del agente anterior, para que el flujo se "sienta"
// real y sirva para entender cómo se pasan información entre sí varios
// agentes — que es el objetivo pedagógico del curso "Automatización de
// procesos de oficina con IA".
//
// Por qué existe este archivo separado (y no la lógica adentro del
// controller): el día de mañana, conectar un proveedor real (Claude,
// Gemini, ChatGPT, o un modelo propio alojado en un host privado) es
// escribir UN archivo nuevo en esta misma carpeta con la misma firma
// — ejecutar({ nodo, contextoPrevio, historial }) devolviendo
// { texto, meta } — y darlo de alta en index.js. Nada en el controller,
// el modelo ni el frontend necesita cambiar para ese día.
function simularLatenciaMs() {
  return 350 + Math.floor(Math.abs(Math.sin(Date.now())) * 400);
}

// Devuelve un resumen corto de la salida del agente anterior para citarla
// como contexto. Importante: NO cortamos por el primer punto — la salida
// de un agente estilo "chatgpt" arranca con "1. Rol asignado: ..." y
// cortar ahí dejaría solo "1", que no dice nada. Cortamos por longitud.
function primeraOracion(texto) {
  if (!texto) return '';
  const limpio = texto.replace(/\s+/g, ' ').trim();
  return limpio.length > 140 ? `${limpio.slice(0, 140)}…` : limpio;
}

// Cada "voz" simulada tiene un estilo de redacción distinto para que un
// flujo con varios proveedores distintos se note al leer la transcripción
// — no es una simulación de calidad/capacidad real de cada IA, solo un
// recurso didáctico para diferenciarlas a simple vista.
const ESTILOS = {
  claude: (rol, instrucciones, contexto) => {
    const pasos = [
      `Como ${rol || 'agente'}, antes de responder voy a pensarlo en voz alta.`,
      instrucciones ? `Mi instrucción es: "${instrucciones}".` : 'No me cargaron instrucciones específicas, así que actúo según mi rol.',
      contexto ? `Tomando lo que dejó el paso anterior ("${primeraOracion(contexto)}"), lo primero que noto es un punto de partida claro para seguir.` : 'Como soy el primer agente del flujo, no tengo contexto previo — arranco desde cero.',
      'Con eso en mente, mi resultado para el siguiente paso del flujo es: [salida simulada — acá iría la respuesta real de Claude].',
    ];
    return pasos.join(' ');
  },
  gemini: (rol, instrucciones, contexto) => {
    const bullets = [
      `Rol: ${rol || 'agente sin rol definido'}.`,
      instrucciones ? `Tarea: ${instrucciones}.` : 'Tarea: no especificada.',
      contexto ? `Entrada recibida: "${primeraOracion(contexto)}".` : 'Entrada recibida: ninguna (primer nodo del flujo).',
      'Salida: [resultado simulado, formato breve — acá iría la respuesta real de Gemini].',
    ];
    return bullets.join('\n• ');
  },
  chatgpt: (rol, instrucciones, contexto) => {
    const numerados = [
      `1. Rol asignado: ${rol || 'agente'}.`,
      `2. ${instrucciones ? `Instrucción a seguir: ${instrucciones}.` : 'No hay instrucción específica cargada.'}`,
      `3. ${contexto ? `Contexto recibido del agente anterior: "${primeraOracion(contexto)}".` : 'No hay contexto previo (primer agente del flujo).'}`,
      '4. Resultado: [salida simulada, estructurada en pasos — acá iría la respuesta real de ChatGPT].',
    ];
    return numerados.join('\n');
  },
  privado: (rol, instrucciones, contexto) => {
    const lineas = [
      `[modelo propio — host privado] Rol: ${rol || 'agente'}.`,
      instrucciones ? `Instrucción: ${instrucciones}.` : 'Sin instrucción específica.',
      contexto ? `Contexto recibido (procesado localmente, sin salir de la red interna): "${primeraOracion(contexto)}".` : 'Sin contexto previo.',
      'Salida generada dentro del host privado: [resultado simulado — acá iría la respuesta real del modelo self-hosted].',
    ];
    return lineas.join(' ');
  },
};

async function ejecutar({ nodo, contextoPrevio }) {
  const estilo = ESTILOS[nodo.proveedor] || ESTILOS.privado;
  const texto = estilo(nodo.rol, nodo.instrucciones, contextoPrevio);
  return {
    texto,
    meta: {
      proveedor: nodo.proveedor,
      simulado: true,
      latenciaMs: simularLatenciaMs(),
    },
  };
}

module.exports = { ejecutar };
