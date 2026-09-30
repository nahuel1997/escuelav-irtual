// Catálogo de qué tablas/columnas puede exponer la API de datos para
// sistemas externos (ver dataApi.controller.js y
// admin/apiClients.controller.js). Se arma consultando el esquema real de
// la base con knex en vez de mantener una lista a mano: en este proyecto
// las tablas cambian seguido (una migración nueva casi en cada entrega),
// así que una lista hardcodeada se habría desactualizado enseguida.
//
// Trade-off: exponemos POR DEFECTO cualquier tabla de la app (menos las
// internas de knex) — es el admin quien decide, tabla por tabla, a qué
// cliente le da acceso y con qué columnas exactas (nunca "todas" de
// entrada). Como red de seguridad adicional, ciertas columnas quedan
// bloqueadas SIEMPRE, sin importar lo que el admin elija: contraseñas,
// hashes y secretos no tienen ningún motivo para salir por esta API.
const db = require('../config/db');

const TABLAS_EXCLUIDAS = [
  'knex_migrations', 'knex_migrations_lock', 'api_clients', 'api_client_permisos', 'api_usage_log',
  // Seguridad y operación internas: no tiene sentido (y sería riesgoso)
  // exponerlas a un sistema externo.
  'api_bloqueados', 'api_bruteforce', 'api_errores', 'login_eventos', 'login_intentos', 'ips_bloqueadas',
  'errores_app', 'reportes_error', 'reportes_error_adjuntos', 'procesos', 'trafico_eventos', 'metricas_app',
  'backups_admins', 'actualizaciones_admins', 'tester_sesiones', 'tester_observaciones', 'pantallas_estado',
  'pantallas_bloqueos', 'menu_items', 'menu_secciones', 'jobs_config',
  // Datos internos o personales que no tienen por qué salir a otro sistema.
  'asistente_conversaciones', 'envios_pdf', 'campania_envios', 'oferta_eventos', 'profesor_calificaciones',
  'profesor_adjuntos', 'ticket_aprobaciones', 'ticket_adjuntos', 'ticket_mensajes',
];
const COLUMNA_BLOQUEADA = /password|contrasena|hash|secret|token/i;

async function listarTablas() {
  const cliente = db.client.config.client;
  let filas;
  if (cliente === 'pg') {
    // El driver pg devuelve { rows: [...] }, a diferencia de
    // better-sqlite3 (que devuelve el array directo, confirmado corriendo
    // esta misma query contra la base de desarrollo).
    const resultado = await db.raw("SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    filas = resultado.rows;
  } else {
    filas = await db.raw("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  }
  const nombres = filas.map((r) => r.name);
  return nombres.filter((n) => !TABLAS_EXCLUIDAS.includes(n));
}

// Columnas "exponibles" de una tabla: todas las reales, menos las
// bloqueadas por nombre (ver COLUMNA_BLOQUEADA). Si la tabla no existe,
// columnInfo() de knex devuelve {} — el resultado queda vacío, no tira.
async function listarColumnas(tabla) {
  if (TABLAS_EXCLUIDAS.includes(tabla)) return [];
  const info = await db(tabla).columnInfo();
  return Object.keys(info).filter((c) => !COLUMNA_BLOQUEADA.test(c));
}

async function catalogoCompleto() {
  const tablas = await listarTablas();
  const catalogo = await Promise.all(
    tablas.map(async (tabla) => ({ tabla, columnas: await listarColumnas(tabla) }))
  );
  // Una tabla que termina sin ninguna columna exponible (ej: todas
  // bloqueadas) no tiene sentido ofrecerla en el catálogo del admin.
  return catalogo.filter((t) => t.columnas.length > 0);
}

module.exports = { listarTablas, listarColumnas, catalogoCompleto, COLUMNA_BLOQUEADA };
