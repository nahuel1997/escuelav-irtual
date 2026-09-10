// Formateo de fechas con la zona horaria configurada por el admin (ver
// general.zona_horaria en Contenido > Generales, config/timezones.js).
//
// Por qué un módulo con estado global en vez de pasar la zona horaria
// como prop en cada página: useContent() se llama de forma independiente
// en decenas de componentes (cada uno hace su propio fetch/poll de
// /api/content, no hay un Provider único — ver hooks/useContent.js), y
// ahí mismo dejamos un efecto que mantiene `zonaActual` al día. Así,
// cualquier archivo que ya formateaba fechas con `new Date(x).
// toLocaleString('es-AR', {...})` solo tiene que sumar `timeZone:
// zonaActual()` (o usar directamente formatFecha de acá) sin tener que
// enhebrar la zona horaria como prop por toda la app.
import { ZONA_HORARIA_DEFAULT } from '../config/timezones';

let zona = ZONA_HORARIA_DEFAULT;

export function setZonaHoraria(nueva) {
  zona = nueva || ZONA_HORARIA_DEFAULT;
}

export function zonaActual() {
  return zona;
}

// Fecha + hora, ej: "26/08/2026 14:30".
export function formatFecha(iso, opciones = {}) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    ...opciones,
    timeZone: zona,
  });
}

// Solo fecha, sin hora, ej: "26/08/2026".
export function formatFechaCorta(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: zona });
}

// Solo hora, ej: "14:30".
export function formatHora(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: zona });
}
