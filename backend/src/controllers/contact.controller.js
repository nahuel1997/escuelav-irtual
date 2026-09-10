const db = require('../config/db');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Guarda el mensaje de contacto en la base. No mandamos email real todavía
// (requeriría credenciales SMTP en .env) — queda como próximo paso obvio:
// engancharla con nodemailer usando las mismas variables que ya usa
// AIVIENTO (smtp.hostinger.com) si se quiere reusar esa cuenta de correo.
const sendMessage = asyncHandler(async (req, res) => {
  const { nombre, email, telefono, mensaje } = req.body;
  if (!nombre || !email || !mensaje) {
    throw new AppError('Faltan nombre, email y/o mensaje', 400);
  }

  await db('contact_messages').insert({ nombre, email, telefono, mensaje });
  res.status(201).json({ ok: true });
});

module.exports = { sendMessage };
