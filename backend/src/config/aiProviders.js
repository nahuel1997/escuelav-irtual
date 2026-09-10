// Catálogo fijo de las 3 IAs que un alumno puede vincular con su PROPIA
// API key en "Integraciones IA" (ver ai.routes.js, services/aiChat/). El
// modelo concreto que se usa en cada llamada es configurable por variable
// de entorno sin tocar código — para el día que un proveedor deprecie el
// que viene por defecto acá, alcanza con setear la variable, igual
// criterio que SMTP_HOST/MP_ACCESS_TOKEN en env.js.
const CATALOGO = [
  {
    clave: 'chatgpt',
    nombre: 'ChatGPT (OpenAI)',
    modelo: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    clave: 'claude',
    nombre: 'Claude (Anthropic)',
    modelo: process.env.ANTHROPIC_CHAT_MODEL || 'claude-3-5-haiku-20241022',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    clave: 'gemini',
    nombre: 'Gemini (Google)',
    modelo: process.env.GEMINI_CHAT_MODEL || 'gemini-1.5-flash',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
];

function clavesValidas() {
  return CATALOGO.map((p) => p.clave);
}

function getConfig(clave) {
  return CATALOGO.find((p) => p.clave === clave) || null;
}

module.exports = { CATALOGO, clavesValidas, getConfig };
