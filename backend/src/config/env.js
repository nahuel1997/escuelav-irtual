// Carga y valida las variables de entorno.
// Centralizar esto en un solo módulo evita leer `process.env.X` suelto por
// todo el código y permite fallar rápido si falta algo crítico.
require('dotenv').config();

const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_CLIENT: process.env.DB_CLIENT || 'sqlite',
  SQLITE_FILE: process.env.SQLITE_FILE || './data/escuela.sqlite3',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-inseguro-cambiar',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3500',
  // Origen público de ESTE backend (no del frontend) — hace falta como URL
  // propia, aparte de FRONTEND_URL, para armar los links de vuelta que le
  // pasamos a Mercado Pago/PayPal (ver payments.service.js): esos links
  // los visita el navegador del alumno DESPUÉS de pagar, pero antes de que
  // nuestro propio frontend entre en juego — hace falta que apunten
  // directo a la API. En producción, cambiar esto a la URL pública real
  // del backend (y ahí sí Mercado Pago va a poder pegarle también al
  // webhook solo; en local, sin URL pública, el webhook no es alcanzable
  // desde afuera — no importa, el "retorno" ya vuelve a confirmar el pago
  // por su cuenta, ver payments.controller.js).
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`,

  // --- Mails (ver mail.service.js) ---
  // Si SMTP_HOST no está seteado, el motor arranca en modo prueba
  // (Ethereal): no manda mails reales, pero registra todo en mail_log y da
  // un link de preview. Completar estas 4 variables es lo único que hace
  // falta para pasar a un proveedor real (SMTP de SendGrid, Resend, Gmail,
  // Amazon SES, etc.) — no requiere tocar código.
  SMTP_HOST: process.env.SMTP_HOST || null,
  SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || null,
  SMTP_PASS: process.env.SMTP_PASS || null,
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'Escuela Online',
  MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL || 'no-responder@escuela-online.demo',

  // --- Pagos (ver payments.service.js) ---
  // Sin MP_ACCESS_TOKEN configurado, ese método de pago no aparece como
  // opción (el checkout sigue funcionando en modo simulado, como hasta
  // ahora). Mismo criterio con PayPal. Se pueden habilitar los dos, uno
  // solo, o ninguno — no hace falta tocar código para prender/apagar cada
  // uno, solo completar (o borrar) estas variables.
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN || null,
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY || null,
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || null,
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || null,
  // 'sandbox' (cuentas de prueba, gratis, para desarrollar sin cobrar
  // nada real) o 'live' (cuenta real de comercio, cobra de verdad).
  PAYPAL_MODE: process.env.PAYPAL_MODE || 'sandbox',

  // --- Clases en vivo (ver realtime/liveClassSocket.js y JitsiRoom.jsx) ---
  // Dominio del servidor de Jitsi Meet que embebe el frontend vía su
  // External API (https://<dominio>/external_api.js). meet.jit.si es el
  // servidor público y gratuito de Jitsi — alcanza para arrancar sin
  // infraestructura propia. El día de mañana, para tener salas propias
  // (más control, sin depender de un servicio de terceros), alcanza con
  // levantar un Jitsi self-hosted y cambiar esta variable — no hace falta
  // tocar código, ni backend ni frontend.
  JITSI_DOMAIN: process.env.JITSI_DOMAIN || 'meet.jit.si',

  // --- Jobs programados (ver src/jobs/) ---
  // Apagado general de los 3 cron jobs (recordatorio de turno, carrito
  // abandonado, inactividad). Sirve para desactivarlos sin tocar código si
  // hace falta (ej: durante un debug puntual). Los tests ya los ignoran
  // solos por NODE_ENV=test, esto es una llave aparte para desarrollo.
  JOBS_HABILITADOS: process.env.JOBS_HABILITADOS !== 'false',
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-secret-inseguro-cambiar') {
  // Antes esto era solo un warning para no "romper un despliegue a último
  // momento" — pero un secreto de JWT conocido públicamente (está en este
  // mismo repo) en producción significa que cualquiera puede firmar tokens
  // válidos como cualquier usuario, incluido admin. Eso no es un problema
  // que se pueda dejar "para después": directamente no arrancamos.
  console.error('[FATAL] JWT_SECRET no fue configurado en producción (quedó el valor por defecto del repo).');
  console.error('Definilo en backend/.env antes de arrancar — con el secreto por defecto cualquiera puede falsificar sesiones, incluida la de admin.');
  process.exit(1);
}

module.exports = env;
