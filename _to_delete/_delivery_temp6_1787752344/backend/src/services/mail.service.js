// =============================================================================
// mail.service.js — Motor de envío de mails.
//
// Aislado con el mismo criterio que payments.service.js / storage.service.js:
// el resto del código solo pide "mandá el mail <clave> a <destinatario> con
// estas variables" (ver enviarMail más abajo) y nunca sabe con qué
// proveedor se manda de verdad. Conectar un proveedor real el día de
// mañana es completar variables en .env — no hay que tocar código.
//
// MODO PRUEBA (por defecto, sin SMTP_HOST configurado): se usa una cuenta
// descartable de Ethereal (https://ethereal.email), un servicio pensado
// justo para esto — "recibe" el mail en una casilla de prueba y devuelve
// un link para verlo, sin que llegue nunca a una casilla real. Cada mail
// además queda guardado completo en la tabla mail_log, así que el panel
// de admin (/admin-panel/mails → Registro) siempre muestra qué se mandó,
// aunque no haya salido de verdad. Si ni siquiera hay salida a internet
// para crear la cuenta de Ethereal, se cae a un transporte "json" que no
// manda nada a ningún lado pero tampoco rompe el flujo — el mail queda
// igual registrado en mail_log.
//
// Cómo se conectaría un proveedor real (queda comentado como guía, mismo
// espíritu que las guías de payments.service.js/storage.service.js):
//
//   # backend/.env
//   SMTP_HOST=smtp.sendgrid.net
//   SMTP_PORT=587
//   SMTP_USER=apikey
//   SMTP_PASS=<tu api key>
//   MAIL_FROM_EMAIL=no-responder@tuescuela.com
//
// Con esas variables completas este archivo arma un transporte SMTP real
// automáticamente en el próximo arranque — no hace falta cambiar código.
// Para SendGrid/Resend/SES por API (en vez de SMTP) el cambio también
// queda contenido acá: se reemplazaría construirTransporteReal() por el
// SDK del proveedor, sin tocar ningún controller.
// =============================================================================
const nodemailer = require('nodemailer');
const env = require('../config/env');
const emailTemplateModel = require('../models/emailTemplate.model');
const mailLogModel = require('../models/mailLog.model');
const appSettingModel = require('../models/appSetting.model');
const { renderTexto } = require('../utils/template');

let transportPromise = null;
let modoActual = null; // 'smtp' | 'test' | 'test-offline' — informativo (panel de admin)

function construirTransporteReal() {
  modoActual = 'smtp';
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

async function construirTransportePrueba() {
  try {
    const cuenta = await nodemailer.createTestAccount();
    modoActual = 'test';
    return nodemailer.createTransport({
      host: cuenta.smtp.host,
      port: cuenta.smtp.port,
      secure: cuenta.smtp.secure,
      auth: { user: cuenta.user, pass: cuenta.pass },
    });
  } catch (e) {
    // Sin salida a internet (o Ethereal caído): no bloqueamos el flujo de
    // la app por esto. jsonTransport arma el mail en memoria sin mandarlo
    // a ningún lado — alcanza porque lo que de verdad importa en modo
    // prueba es que quede el registro en mail_log.
    console.warn('[mail.service] No se pudo crear cuenta de prueba de Ethereal (¿sin internet?). Uso transporte offline.', e.message);
    modoActual = 'test-offline';
    return nodemailer.createTransport({ jsonTransport: true });
  }
}

// El transporte se arma una sola vez (cuenta de Ethereal incluida) y se
// reutiliza en todos los envíos siguientes del proceso.
//
// NODE_ENV=test siempre usa el transporte offline (jsonTransport), pase lo
// que pase en SMTP_HOST — así los tests (a mano, en CI, o corridos desde
// /admin-panel/testing) nunca disparan un mail real ni dependen de un SMTP
// real accesible/autenticado, ni se cuelgan esperando un handshake de
// verdad. Sin este chequeo, con un SMTP_HOST real cargado en .env (que
// dotenv lee para todo el proceso, tests incluidos) cualquier test que
// dispare un mail —el registro de un alumno nuevo manda el de
// verificación en su propio beforeAll, por ejemplo— intenta de verdad
// conectarse y autenticarse contra ese proveedor, y agota el timeout de
// 5000ms del hook de Jest antes de fallar o conectar.
function getTransporter() {
  if (!transportPromise) {
    if (env.NODE_ENV === 'test') {
      modoActual = 'test-offline';
      transportPromise = Promise.resolve(nodemailer.createTransport({ jsonTransport: true }));
    } else {
      transportPromise = env.SMTP_HOST ? Promise.resolve(construirTransporteReal()) : construirTransportePrueba();
    }
  }
  return transportPromise;
}

function getModo() {
  return modoActual || (env.SMTP_HOST ? 'smtp' : 'test');
}

// Envía el mail de la plantilla `clave` a `destinatario`, reemplazando
// variables en asunto y cuerpo. Nunca tira: cualquier error (plantilla
// inactiva/inexistente, falla del transporte) se registra en mail_log con
// estado 'fallido' y la función devuelve { ok:false, motivo } — ningún
// flujo de negocio (compra, verificación de cuenta, turno) debería
// romperse porque un mail no pudo salir. Mismo criterio "best effort" que
// loginLogModel.create en auth.controller.js.
// "Modo prueba" de mails: mientras app_settings.mail_modo_prueba_destinatario
// tenga un valor (ver Configuración en /admin-panel/mails, mismo mecanismo
// que los umbrales de mails automáticos), TODO mail que la app quiera
// mandar —de negocio (compra, verificación, turnos) o el botón "Probar"
// sin destinatario explícito— se redirige de verdad a esa casilla en vez
// del destinatario real. Pensado para validar un SMTP real recién
// conectado sin mandarle nada a alumnos/profesores de verdad; se apaga
// dejando el valor vacío. mail_log.destinatario queda con la dirección a
// la que se mandó de verdad; redirigido_desde guarda para quién era.
async function enviarMail({ clave, destinatario, variables = {}, userId = null, mailingListId = null }) {
  const plantilla = await emailTemplateModel.findByClave(clave);
  if (!plantilla) {
    console.error(`[mail.service] Plantilla desconocida: "${clave}"`);
    return { ok: false, motivo: 'plantilla_inexistente' };
  }
  if (!plantilla.activo) {
    return { ok: false, motivo: 'plantilla_inactiva' };
  }

  const asunto = renderTexto(plantilla.asunto, variables);
  const cuerpo = renderTexto(plantilla.cuerpo_html, variables);
  const remitente = `${env.MAIL_FROM_NAME} <${env.MAIL_FROM_EMAIL}>`;

  const modoPruebaDestino = (await appSettingModel.getValor('mail_modo_prueba_destinatario', '') || '').trim();
  const destinoReal = modoPruebaDestino || destinatario;

  const [logId] = await mailLogModel.create({
    destinatario: destinoReal,
    redirigido_desde: modoPruebaDestino ? destinatario : null,
    remitente,
    asunto,
    cuerpo,
    tipo: clave,
    estado: 'pendiente',
    user_id: userId,
    mailing_list_id: mailingListId,
  });

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({ from: remitente, to: destinoReal, subject: asunto, html: cuerpo });
    const previewUrl = getModo() === 'test' ? nodemailer.getTestMessageUrl(info) || null : null;
    await mailLogModel.markEnviado(logId, {
      proveedor: getModo(),
      proveedor_message_id: info.messageId,
      preview_url: previewUrl,
    });
    return { ok: true, previewUrl, modo: getModo(), redirigidoA: modoPruebaDestino || null };
  } catch (err) {
    console.error(`[mail.service] Falló el envío de "${clave}" a ${destinatario}${modoPruebaDestino ? ` (redirigido a ${modoPruebaDestino})` : ''}:`, err.message);
    await mailLogModel.markFallido(logId, err.message).catch(() => {});
    return { ok: false, motivo: 'error_envio', error: err.message };
  }
}

module.exports = { enviarMail, renderTexto, getModo };
