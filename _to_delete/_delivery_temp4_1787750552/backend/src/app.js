// =============================================================================
// app.js — Punto de entrada de la API de la escuela.
// Alguien que nunca vio este proyecto debería poder entender el flujo
// completo leyendo solo este archivo y sus comentarios.
// =============================================================================

// 1) Variables de entorno: se cargan primero que nada (env.js hace el
//    require('dotenv').config() internamente) para que el resto de los
//    módulos ya las tengan disponibles al importarse.
const env = require('./config/env');

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const db = require('./config/db');
const migrationStatus = require('./utils/migrationStatus');

// 2) Creación de la app de Express.
const app = express();

// 3) Middlewares globales (el orden importa):

// helmet agrega headers HTTP de seguridad por defecto (evita algunos
// ataques comunes: sniffing de MIME, clickjacking, etc.)
app.use(helmet({
  // Servimos PDFs generados (CV) y archivos subidos; relajamos la política
  // de recursos cruzados para que el frontend (otro puerto) pueda abrirlos.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// cors habilita que el frontend (React, corriendo en otro puerto/dominio)
// pueda llamar a esta API. Restringido a FRONTEND_URL por variable de entorno.
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

// morgan loguea cada request entrante en consola (solo útil en desarrollo).
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// express.json() parsea bodies JSON entrantes (POST/PUT) a req.body.
app.use(express.json());
// express.urlencoded() hace falta específicamente para el launch de LTI
// (ver routes/lti.routes.js): la plataforma nos manda el id_token con un
// POST "form_post" clásico (application/x-www-form-urlencoded), no JSON
// — así lo pide el estándar OIDC, para que funcione con un submit de
// formulario HTML normal del lado de la plataforma.
app.use(express.urlencoded({ extended: false }));

// Servimos los archivos subidos por los alumnos (entregas de tareas) y,
// eventualmente, imágenes de perfil. En producción esto normalmente se
// movería a un storage externo (S3, etc.), pero para arrancar alcanza con
// disco local.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// 4) Montaje de rutas. Cada dominio de la app vive en su propio archivo de
//    rutas + controller, todas bajo el prefijo /api para separarlas
//    claramente de cualquier asset estático.
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/courses', require('./routes/courses.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/classroom', require('./routes/classroom.routes'));
// El temario del curso (unidades > capítulos, progreso de video,
// comentarios, archivos de utilidad) es parte del mismo dominio
// "classroom" pero vive en su propio controller/rutas por ser bastante
// más grande que tareas/entregas — Express permite montar más de un
// router bajo el mismo prefijo sin problema, prueba cada uno en orden.
app.use('/api/classroom', require('./routes/curriculum.routes'));
app.use('/api/calendar', require('./routes/calendar.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/content', require('./routes/content.routes'));
app.use('/api/achievements', require('./routes/achievements.routes'));
app.use('/api/contact', require('./routes/contact.routes'));
app.use('/api/cv', require('./routes/cv.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/soporte', require('./routes/support.routes'));
// API de datos de solo lectura para sistemas externos (usuario/contraseña
// propios, no el login de la app — ver data.routes.js).
app.use('/api/data', require('./routes/data.routes'));
// Pagos reales (Mercado Pago/PayPal): webhooks, retorno del alumno desde
// la pasarela, y consulta de una orden propia — ver payments.routes.js.
// Arrancar un pago (crear la orden) NO vive acá, sino dentro de
// /api/cart/checkout y /api/courses/:id/enroll (ver el comentario en
// payments.controller.js sobre por qué).
app.use('/api/payments', require('./routes/payments.routes'));
// Clases en vivo (alumno/profesor): listado propio, sala (Jitsi) e
// historial del chat de la clase — agendar/editar/cancelar es del admin,
// ver admin.routes.js. Los mensajes en vivo en sí van por socket, no acá
// (ver realtime/liveClassSocket.js).
app.use('/api/clases-en-vivo', require('./routes/liveClasses.routes'));
// Sandbox de orquestación de agentes (alumno/profesor): flujos de agentes
// con ejecución simulada — ver agentFlows.routes.js y
// services/agentProviders/ para la arquitectura pensada para conectar IA
// real (Claude/Gemini/ChatGPT/self-hosted) más adelante.
app.use('/api/agentes', require('./routes/agentFlows.routes'));
// Integración LMS real (LTI 1.3): endpoints públicos que llama el LMS
// (login OIDC, launch, jwks) y el frontend (exchange) — el alta de
// plataformas es admin, ver /api/admin/lti/* en admin.routes.js.
app.use('/api/lti', require('./routes/lti.routes'));

// Endpoint simple para chequear que el server está vivo (útil para health
// checks, monitoreo, o simplemente para probar que todo arrancó bien).
// Incluye el estado de migraciones (ver chequearMigraciones() más abajo)
// para poder confirmar de un vistazo que la base está al día.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: env.NODE_ENV, timestamp: new Date().toISOString(), migraciones: migrationStatus.getEstado() });
});

// 5) Manejo de errores centralizado: primero 404 para rutas que no
//    matchearon nada de arriba, después el handler genérico de errores.
app.use(notFoundHandler);
app.use(errorHandler);

// 6) Chequeo de migraciones pendientes. No bloquea el arranque (una
//    migración pendiente no significa necesariamente que TODO esté roto,
//    solo la parte que depende de esa tabla/columna) pero lo dejamos bien
//    gritado en consola — este chequeo es la respuesta directa al bug real
//    que motivó agregarlo: migraciones nunca corridas causando 500
//    silenciosos que tardaron en detectarse. También queda expuesto en
//    GET /api/health por si hace falta confirmarlo sin mirar logs.
async function chequearMigraciones() {
  try {
    const [, pendientes] = await db.migrate.list();
    const nombres = pendientes.map((m) => m.file || m.name || String(m));
    migrationStatus.setPendientes(nombres);
    if (nombres.length > 0) {
      console.warn('\n' + '='.repeat(70));
      console.warn(`[MIGRACIONES PENDIENTES] Hay ${nombres.length} migración(es) sin correr:`);
      nombres.forEach((n) => console.warn(`  - ${n}`));
      console.warn('Corré "npm run migrate" — si no, partes de la app van a fallar en');
      console.warn('silencio (endpoints devolviendo 500 por tablas/columnas inexistentes).');
      console.warn('='.repeat(70) + '\n');
    }
  } catch (err) {
    // Best-effort: si esto falla (ej: la base ni existe todavía), no
    // tiramos abajo el arranque del server por un chequeo que es solo
    // informativo — el propio error real va a aparecer igual al usarla.
    console.error('[MIGRACIONES] No se pudo chequear el estado de las migraciones:', err.message);
  }
}

// 7) Arranque del servidor. Solo lo levantamos si este archivo se ejecuta
//    directamente (no cuando lo importan los tests con supertest, que
//    corren sus propias migraciones antes de importar la app). Los jobs
//    programados (src/jobs/) y el chat en vivo (src/realtime/chatSocket.js)
//    arrancan en este mismo bloque y por el mismo motivo: no tiene sentido
//    (ni es seguro) que un test dispare de fondo un cron job que manda
//    mails, o levante un servidor de WebSockets, mientras solo quiere
//    pegarle a la API con supertest.
//
//    Antes acá había un simple app.listen(...). Ahora usamos
//    http.createServer(app) primero porque Socket.io necesita "engancharse"
//    al servidor HTTP crudo para poder atender conexiones WebSocket además
//    de las requests HTTP normales que ya maneja Express — server.listen()
//    en vez de app.listen() sigue sirviendo exactamente las mismas rutas
//    de siempre, más el chat en vivo.
//
//    El chat de las clases en vivo (src/realtime/liveClassSocket.js) NO
//    levanta un segundo servidor de Socket.io — un http.Server solo admite
//    uno enganchado — sino que reutiliza la misma instancia `io` que
//    devuelve attachChatSocket() (que ya resolvió la autenticación por
//    JWT), agregando sus propios eventos sobre esa conexión.
if (require.main === module) {
  chequearMigraciones().finally(() => {
    const server = http.createServer(app);
    const io = require('./realtime/chatSocket').attachChatSocket(server);
    require('./realtime/liveClassSocket').attachLiveClassSocket(io);
    server.listen(env.PORT, () => {
      console.log(`API de la escuela escuchando en http://localhost:${env.PORT}`);
      console.log(`CORS habilitado para: ${env.FRONTEND_URL}`);
      require('./jobs').iniciar();
    });
  });
}

module.exports = app;
