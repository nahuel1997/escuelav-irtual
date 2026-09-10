// Cifrado simétrico (AES-256-GCM) para datos sensibles que la app
// necesita guardar pero NUNCA debería quedar en texto plano en un dump de
// la base — hoy el único uso es la API key que cada alumno carga para
// vincular su cuenta de IA (ver ai_links / aiLink.model.js): se usa
// server-side para reenviar sus mensajes al proveedor real (OpenAI/
// Anthropic/Google), pero ningún endpoint la devuelve descifrada una vez
// guardada (ver aiLink.model.js — solo se expone un preview corto).
//
// La clave de cifrado se deriva de JWT_SECRET (scrypt + salt fijo) en vez
// de pedir una variable de entorno nueva: JWT_SECRET ya es "el secreto
// maestro" de esta app (env.js ya frena el arranque en producción si
// quedó el valor por defecto del repo) — reusarlo no baja la protección
// real y evita sumarle al admin una variable más para configurar. Si el
// día de mañana se quiere una clave de cifrado independiente del secreto
// de sesión, alcanza con agregar un env var acá (ej: AI_KEYS_SECRET) sin
// tocar el resto del código.
const crypto = require('crypto');
const env = require('../config/env');

const SALT_FIJO = 'escuela-app.ai-links.v1';
let claveCache = null;

function getClave() {
  if (!claveCache) claveCache = crypto.scryptSync(env.JWT_SECRET, SALT_FIJO, 32);
  return claveCache;
}

// Formato guardado: "iv:tag:datos" (los 3 en hex), todo en una sola
// columna de texto — más simple que 3 columnas separadas para un dato que
// siempre se lee/escribe entero, nunca se busca por él.
function encriptar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getClave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), cifrado.toString('hex')].join(':');
}

function desencriptar(payload) {
  const [ivHex, tagHex, dataHex] = String(payload).split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Payload cifrado inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getClave(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const texto = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return texto.toString('utf8');
}

module.exports = { encriptar, desencriptar };
