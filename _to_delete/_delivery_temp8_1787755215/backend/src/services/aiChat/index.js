// Registro de motores REALES de IA para "Integraciones IA" — a
// diferencia de agentProviders/index.js (Sandbox de agentes, siempre
// simulado hasta que se conecte algo real), acá los 3 SÍ hablan con la IA
// de verdad desde el día uno, usando la API key propia de cada alumno
// (ver ai.controller.js y utils/crypto.js). Firma común de cada motor:
// enviarMensaje({ apiKey, modelo, mensajes }) => { texto }.
const openai = require('./openai.provider');
const anthropic = require('./anthropic.provider');
const gemini = require('./gemini.provider');

const MOTORES = { chatgpt: openai, claude: anthropic, gemini };

function getMotor(clave) {
  return MOTORES[clave] || null;
}

module.exports = { getMotor };
