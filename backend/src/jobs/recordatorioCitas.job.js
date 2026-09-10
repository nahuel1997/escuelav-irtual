// Job: recordatorio de turno 30 minutos antes (el número de minutos es
// configurable desde el backoffice — app_settings.minutos_recordatorio_cita).
// Corre cada 5 minutos: suficiente resolución para una anticipación de 30
// minutos sin recalcular constantemente.
const calendarEventModel = require('../models/calendarEvent.model');
const appSettingModel = require('../models/appSetting.model');
const contentModel = require('../models/content.model');
const mailService = require('../services/mail.service');
const env = require('../config/env');
const { formatFechaHora } = require('../utils/fecha');

async function correrJobRecordatorioCitas() {
  const minutos = Number(await appSettingModel.getValor('minutos_recordatorio_cita', 30));
  const zona = await contentModel.getValor('general.zona_horaria');
  const eventos = await calendarEventModel.listParaRecordatorio(minutos);

  for (const e of eventos) {
    const linkCalendario = `${env.FRONTEND_URL}/calendario`;
    const horaTexto = formatFechaHora(e.starts_at, zona);

    await mailService.enviarMail({
      clave: 'recordatorio_cita',
      destinatario: e.alumno_email,
      variables: { nombre_destinatario: e.alumno_nombre, nombre_otro_parte: e.profesor_nombre, motivo: e.motivo, hora: horaTexto, link_calendario: linkCalendario },
      userId: e.alumno_id,
    });
    await mailService.enviarMail({
      clave: 'recordatorio_cita',
      destinatario: e.profesor_email,
      variables: { nombre_destinatario: e.profesor_nombre, nombre_otro_parte: e.alumno_nombre, motivo: e.motivo, hora: horaTexto, link_calendario: linkCalendario },
      userId: e.profesor_id,
    });

    await calendarEventModel.marcarRecordatorioEnviado(e.id);
  }

  return eventos.length;
}

module.exports = { correrJobRecordatorioCitas };
