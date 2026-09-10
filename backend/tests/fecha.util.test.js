const { formatFecha, formatHora, formatFechaHora, ZONA_HORARIA_DEFAULT } = require('../src/utils/fecha');

// Utilidad pura de formateo de fechas para el contenido de los mails
// (turnos de calendario) — ver comentario en calendar.controller.js sobre
// por qué la zona horaria configurada (general.zona_horaria) tiene que
// reflejarse ahí y no solo en el frontend.
describe('utils/fecha (zona horaria configurable)', () => {
  // 2026-01-15T02:30:00Z: elegido a propósito cerca de medianoche UTC,
  // para que un cambio de zona horaria efectivamente cambie el DÍA
  // mostrado, no solo la hora — así el test detecta si timeZone no se
  // está aplicando de verdad.
  const fechaUtc = '2026-01-15T02:30:00Z';

  test('sin zona explícita, usa Argentina por defecto', () => {
    expect(ZONA_HORARIA_DEFAULT).toBe('America/Argentina/Buenos_Aires');
    // 02:30 UTC == 23:30 (11:30pm) del día anterior en Argentina (GMT-3).
    expect(formatFecha(fechaUtc)).toBe('14/1/2026');
    expect(formatHora(fechaUtc)).toMatch(/11:30/);
  });

  test('con otra zona configurada, la fecha/hora mostrada cambia de verdad', () => {
    // Madrid (GMT+1 en enero, sin horario de verano): 02:30 UTC == 03:30am.
    expect(formatFecha(fechaUtc, 'Europe/Madrid')).toBe('15/1/2026');
    expect(formatHora(fechaUtc, 'Europe/Madrid')).toMatch(/03:30/);
  });

  test('formatFechaHora combina ambas en un solo texto, respetando la zona', () => {
    const texto = formatFechaHora(fechaUtc, 'America/Argentina/Buenos_Aires');
    expect(texto).toMatch(/14/); // el día correcto en Argentina
    expect(texto).toMatch(/11:30/);
  });
});
