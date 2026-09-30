// Feriados (Admin → Configuración → Feriados): días sin turnos. La fecha
// del turno se evalúa en la zona horaria de la escuela, no en UTC.
const configService = require('./config.service');
const contentModel = require('../models/content.model');
const { ZONA_HORARIA_DEFAULT } = require('../utils/fecha');

async function feriadoDe(fecha) {
  const config = await configService.getJson('config.feriados', { dias: [] });
  const dias = (config && config.dias) || [];
  if (!dias.length) return null;
  const zona = (await contentModel.getValor('general.zona_horaria').catch(() => null)) || ZONA_HORARIA_DEFAULT;
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(fecha));
  return dias.find((d) => d.fecha === dia) || null;
}

module.exports = { feriadoDe };
