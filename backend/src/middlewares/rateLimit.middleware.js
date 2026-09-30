// Rate limiting para los endpoints de auth expuestos sin login (login,
// registro), para el reenvío del código de verificación, y para las
// acciones de escritura/generación de PDFs y mails de usuarios ya logueados
// (spam de reportes, de tickets o de PDFs podía llenar la base o el disco
// sin freno — mismo criterio que los "escrituraLimiter" de DBA24).
//
// El login tiene DOS capas:
// - loginLimiter (acá): piso volumétrico crudo por IP, sin mirar el email,
//   contra una ráfaga de automatización directa (60 por minuto).
// - la fuerza bruta escalonada por IP + email (auth.controller.js +
//   loginIntento.model.js): 10 fallos -> 1 min, 20 -> 5 min, 21 -> se
//   bloquea la IP. Antes este limiter cortaba a los 10 intentos cada 15 min
//   y los tramos de la fuerza bruta nunca se llegaban a alcanzar.
const rateLimit = require('express-rate-limit');

// Los tests (backend/tests/) hacen muchos logins seguidos contra la misma
// IP de loopback: sin este escape, la propia suite de tests terminaría
// bloqueada por su propio rate limit.
const skipEnTests = () => process.env.NODE_ENV === 'test';

const LOGIN_MAX_POR_MINUTO = 60;

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: LOGIN_MAX_POR_MINUTO,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipEnTests,
  message: { error: 'Demasiados intentos de inicio de sesión desde esta conexión. Esperá un momento y volvé a intentar.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 cuentas nuevas por IP por hora
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipEnTests,
  message: { error: 'Demasiadas cuentas creadas desde esta conexión. Probá de nuevo más tarde.' },
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 8, // intentos de código + reenvíos combinados por IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipEnTests,
  message: { error: 'Demasiados intentos de verificación desde esta conexión. Esperá unos minutos y volvé a intentar.' },
});

// Fábrica para endpoints de usuarios logueados: la clave es el usuario (no
// la IP), así varios alumnos detrás de la misma red de un colegio no se
// pisan entre sí. Montar DESPUÉS de requireAuth.
function limiterPorUsuario({ windowMs = 60 * 1000, max = 30, mensaje = 'Demasiadas solicitudes, esperá un momento.' } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipEnTests,
    keyGenerator: (req) => (req.user ? `u${req.user.id}` : req.ip),
    message: { error: mensaje },
  });
}

// Los más comunes, ya armados:
const escrituraLimiter = limiterPorUsuario({ max: 30 });
const pdfLimiter = limiterPorUsuario({ max: 10, mensaje: 'Demasiadas solicitudes de PDF, esperá un momento.' });
const reporteErrorLimiter = limiterPorUsuario({
  windowMs: 60 * 60 * 1000,
  max: 10,
  mensaje: 'Mandaste muchos reportes seguidos. Probá de nuevo en un rato.',
});
// Reenvío de PDFs por mail: 15 por hora por usuario (decisión DBA24).
const mailPdfLimiter = limiterPorUsuario({
  windowMs: 60 * 60 * 1000,
  max: 15,
  mensaje: 'Llegaste al máximo de 15 envíos por hora. Probá más tarde.',
});

module.exports = {
  loginLimiter,
  registerLimiter,
  verificationLimiter,
  limiterPorUsuario,
  escrituraLimiter,
  pdfLimiter,
  reporteErrorLimiter,
  mailPdfLimiter,
  LOGIN_MAX_POR_MINUTO,
};
