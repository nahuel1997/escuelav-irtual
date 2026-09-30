// Reenvío de un PDF por mail (portado de mailPdfController de DBA24):
// - tope de 15 envíos por hora por usuario,
// - asunto con prefijo fijo (no se puede hacer pasar por otro mail),
// - firma de quién lo mandó, y el mensaje escapado (sin HTML).
const db = require('../config/db');
const mailService = require('./mail.service');
const { escaparHtml } = require('../utils/template');
const { haceDias } = require('../utils/sqlFecha');
const { AppError } = require('../middlewares/error.middleware');

const TOPE_POR_HORA = 15;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Se valida al ENCOLAR (para avisar enseguida) y se vuelve a contar al enviar.
async function validarDestino(userId, destinatario) {
  const email = String(destinatario || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) throw new AppError('El mail de destino no es válido', 400);
  const hechos = await db('envios_pdf').where({ user_id: userId }).where('created_at', '>=', haceDias(1 / 24)).count({ c: '*' }).first();
  if (Number(hechos.c) >= TOPE_POR_HORA) throw new AppError(`Llegaste al máximo de ${TOPE_POR_HORA} envíos por hora. Probá más tarde.`, 429);
  return email;
}

async function enviar({ user, destinatario, titulo, mensaje, buffer, nombreArchivo }) {
  const email = await validarDestino(user.id, destinatario);
  await db('envios_pdf').insert({ user_id: user.id, destinatario: email, titulo: String(titulo).slice(0, 200) });
  const r = await mailService.enviarMail({
    clave: 'reenvio_pdf',
    destinatario: email,
    variables: {
      titulo: escaparHtml(titulo),
      mensaje: escaparHtml(String(mensaje || '').slice(0, 2000)),
      remitente: escaparHtml(`${user.nombre} ${user.apellido || ''}`.trim()),
      remitente_email: escaparHtml(user.email),
    },
    adjuntos: [{ nombre: nombreArchivo, buffer, mime: 'application/pdf' }],
  });
  if (!r.ok) throw new Error(`El PDF se generó pero el mail no salió (${r.motivo || 'error'}).`);
  return email;
}

module.exports = { validarDestino, enviar, TOPE_POR_HORA };
