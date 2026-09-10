// =============================================================================
// Registro de proveedores de IA para el sandbox de orquestación de agentes.
//
// HOY los cuatro apuntan al mismo motor simulado (ver simulated.provider.js)
// — es la decisión de producto explícita: "por ahora un sandbox educativo
// simulador, pero escalable a Claude, Gemini, ChatGPT y modelos alojados
// internamente por hosts privados". Esa escalabilidad es justamente lo que
// resuelve este archivo: para conectar un proveedor real el día de mañana,
// alcanza con:
//   1. Crear claude.provider.js / gemini.provider.js / chatgpt.provider.js /
//      selfHosted.provider.js con la misma firma que simulated.provider.js
//      (ejecutar({ nodo, contextoPrevio }) => { texto, meta }).
//   2. Reemplazar la entrada correspondiente en PROVEEDORES de acá abajo.
// El controller, el modelo y el frontend no necesitan tocarse — todos
// hablan con "el proveedor que corresponda a nodo.proveedor" a través de
// getProveedor(), nunca importan simulated.provider.js directamente.
const simulado = require('./simulated.provider');

// Metadata visible en el frontend (para el selector de proveedor por nodo)
// y usada por el motor simulado para variar el estilo de cada "voz".
const CATALOGO = [
  { clave: 'claude', label: 'Claude (Anthropic)', disponibleReal: false },
  { clave: 'gemini', label: 'Gemini (Google)', disponibleReal: false },
  { clave: 'chatgpt', label: 'ChatGPT (OpenAI)', disponibleReal: false },
  { clave: 'privado', label: 'Modelo propio (host privado)', disponibleReal: false },
];

const PROVEEDORES = {
  claude: simulado,
  gemini: simulado,
  chatgpt: simulado,
  privado: simulado,
};

function getProveedor(clave) {
  return PROVEEDORES[clave] || PROVEEDORES.privado;
}

function clavesValidas() {
  return CATALOGO.map((p) => p.clave);
}

module.exports = { CATALOGO, getProveedor, clavesValidas };
