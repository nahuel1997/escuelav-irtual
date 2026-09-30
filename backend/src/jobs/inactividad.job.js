// Job: mail de "te extrañamos" por inactividad. Corre una vez por día; el
// umbral (cuántos días sin loguearse) es configurable desde el backoffice
// (app_settings.dias_inactividad_te_extranamos). Evita reenviar todos los
// días mientras la cuenta siga inactiva gracias al cooldown de
// users.ultimo_mail_inactividad_at (ver loginLog.model.listUsuariosInactivos).
const loginLogModel = require('../models/loginLog.model');
const { paraSql } = require('../utils/sqlFecha');
const userModel = require('../models/user.model');
const appSettingModel = require('../models/appSetting.model');
const mailService = require('../services/mail.service');
const env = require('../config/env');

async function correrJobInactividad() {
  const dias = Number(await appSettingModel.getValor('dias_inactividad_te_extranamos', 30));
  const umbralFecha = paraSql(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));
  // paraSql: en SQLite un Date se compara como número contra columnas de texto y el
  // filtro nunca daba verdadero — el mail no salía nunca (ver utils/sqlFecha.js).
  const usuarios = await loginLogModel.listUsuariosInactivos(umbralFecha);

  for (const u of usuarios) {
    await mailService.enviarMail({
      clave: 'te_extranamos',
      destinatario: u.email,
      variables: { nombre: u.nombre, dias_inactivo: dias, link_ingresar: `${env.FRONTEND_URL}/ingresar` },
      userId: u.id,
    });
    await userModel.marcarRecordatorioInactividadEnviado(u.id);
  }

  return usuarios.length;
}

module.exports = { correrJobInactividad };
