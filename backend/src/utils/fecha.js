// Formateo de fechas para el contenido de los mails (turnos de
// calendario, recordatorios), con la misma zona horaria configurable que
// usa el frontend (general.zona_horaria, ver frontend/src/utils/fecha.js
// y frontend/src/config/timezones.js — mismo default acá para que, sin
// configurar nada, ambos lados coincidan en "Argentina").
const ZONA_HORARIA_DEFAULT = 'America/Argentina/Buenos_Aires';

function formatFecha(fecha, zona) {
  return new Date(fecha).toLocaleDateString('es-AR', { timeZone: zona || ZONA_HORARIA_DEFAULT });
}

function formatHora(fecha, zona) {
  return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: zona || ZONA_HORARIA_DEFAULT });
}

function formatFechaHora(fecha, zona) {
  return new Date(fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: zona || ZONA_HORARIA_DEFAULT });
}

module.exports = { ZONA_HORARIA_DEFAULT, formatFecha, formatHora, formatFechaHora };
