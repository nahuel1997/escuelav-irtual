// Rate limiting para los endpoints de auth expuestos sin login (login,
// registro) y para el reenvío del código de verificación (logueado, pero
// igual de fácil de abusar como spam de mails si no se limita). No
// protege contra un atacante distribuido en muchas IPs distintas, pero
// frena el caso común — intentos repetidos desde un mismo script/IP — que
// era la ausencia de seguridad más concreta que tenía la API.
//
// Ventanas distintas a propósito: login se prueba muchas veces en uso
// normal (usuario que se equivoca de contraseña un par de veces), registro
// casi nunca más de una vez por persona real, y un reenvío de código
// tampoco — así que sus límites pueden ser más chicos en relación a lo
// esperable sin molestar a nadie legítimo.
const rateLimit = require('express-rate-limit');

// Los tests (backend/tests/) hacen muchos logins seguidos contra la misma
// IP de loopback: sin este escape, la propia suite de tests terminaría
// bloqueada por su propio rate limit.
const skipEnTests = () => process.env.NODE_ENV === 'test';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos por IP en la ventana
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipEnTests,
  message: { error: 'Demasiados intentos de inicio de sesión desde esta conexión. Esperá unos minutos y volvé a intentar.' },
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

module.exports = { loginLimiter, registerLimiter, verificationLimiter };
