// Manejo centralizado de errores. Cualquier controller puede simplemente
// hacer `next(error)` (o tirar un throw dentro de un async-handler) y esto
// se encarga de loguear y responder con un formato consistente.
function notFoundHandler(req, res, next) {
  res.status(404).json({ error: 'Recurso no encontrado', path: req.originalUrl });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[ERROR]', err);
    // Solo persistimos errores 5xx (fallas reales del sistema), no 4xx de
    // uso normal (permisos, validaciones de negocio) — eso llenaría el
    // registro de ruido sin aportar nada útil para "Errores" en el admin.
    // Best-effort: si esto falla, no debe tirar abajo la respuesta.
    // require() adentro de la función para evitar dependencia circular con
    // config/db.js al arrancar la app.
    try {
      const errorLogModel = require('../models/errorLog.model');
      errorLogModel
        .create({
          status,
          mensaje: (err.message || 'Error interno del servidor').slice(0, 500),
          ruta: req.originalUrl,
          metodo: req.method,
          user_id: req.user?.id,
        })
        .catch(() => {});
    } catch (_e) {
      // noop
    }
  }
  // Para 4xx (permisos, validaciones de negocio) el mensaje SIEMPRE viene
  // de un AppError armado a propósito por el controller (err.publicMessage)
  // — esos son seguros y útiles de mostrar tal cual. Para 5xx (excepciones
  // no manejadas: errores de la base, bugs, lo que sea) NUNCA mandamos
  // err.message al cliente: puede traer detalles internos (nombres de
  // tabla, columnas, hasta el SQL de la query, como pasó con el error de
  // login_logs). El detalle real solo queda en el log del servidor y en
  // /admin-panel/errores; al usuario le llega un mensaje genérico y claro.
  const mensaje = status >= 500
    ? 'Ocurrió un error inesperado en el servidor. Por favor, intentá de nuevo en unos minutos.'
    : (err.publicMessage || err.message || 'Ocurrió un error. Intentá de nuevo.');

  res.status(status).json({ error: mensaje });
}

// Helper para no repetir try/catch en cada controller async.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.publicMessage = message;
  }
}

module.exports = { notFoundHandler, errorHandler, asyncHandler, AppError };
