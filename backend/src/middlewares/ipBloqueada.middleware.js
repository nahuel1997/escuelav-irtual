// IPs bloqueadas (a mano por el admin o solas por la fuerza bruta del
// login): no llegan a NINGÚN endpoint de la API, ni siquiera al login —
// mismo criterio que middleware/ipBloqueada.js de DBA24. Se monta en app.js
// antes de todas las rutas. /api/health queda afuera (monitoreo).
//
// Sin caché a propósito: es una búsqueda por columna única (índice), y con
// caché un desbloqueo del admin tardaría en tomar efecto.
const ipBloqueadaModel = require('../models/ipBloqueada.model');

async function ipBloqueada(req, res, next) {
  if (req.path === '/api/health') return next();
  try {
    if (await ipBloqueadaModel.estaBloqueada(req.ip)) {
      return res.status(403).json({
        error: 'Tu conexión está bloqueada por seguridad. Si creés que es un error, escribinos desde otra red o contactá a la escuela.',
        codigo: 'IP_BLOQUEADA',
      });
    }
  } catch (err) {
    // Sin la migración todavía (o la base caída) no dejamos a todos afuera.
    console.error('[ipBloqueada]', err.message);
  }
  next();
}

module.exports = ipBloqueada;
