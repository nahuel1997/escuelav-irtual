// Lista curada de zonas horarias (mismo criterio que fonts.js: no es
// exhaustiva, pero cubre los países más relevantes para esta plataforma —
// principalmente Latinoamérica — más algunos globales comunes) para el
// selector de "Zona horaria del sitio" en Contenido > Generales. Cada
// entrada usa un identificador IANA real (el mismo que entiende
// Intl.DateTimeFormat / toLocaleString con la opción timeZone), así que
// alcanza con guardar el `id` — el navegador se encarga de calcular el
// offset real (incluido horario de verano) al formatear cada fecha.
export const ZONAS_HORARIAS = [
  { id: 'America/Argentina/Buenos_Aires', label: 'Argentina (GMT-3)' },
  { id: 'America/Montevideo', label: 'Uruguay (GMT-3)' },
  { id: 'America/Sao_Paulo', label: 'Brasil — São Paulo (GMT-3)' },
  { id: 'America/Santiago', label: 'Chile (GMT-4/-3)' },
  { id: 'America/Asuncion', label: 'Paraguay (GMT-4/-3)' },
  { id: 'America/La_Paz', label: 'Bolivia (GMT-4)' },
  { id: 'America/Bogota', label: 'Colombia (GMT-5)' },
  { id: 'America/Lima', label: 'Perú (GMT-5)' },
  { id: 'America/Guayaquil', label: 'Ecuador (GMT-5)' },
  { id: 'America/Caracas', label: 'Venezuela (GMT-4)' },
  { id: 'America/Mexico_City', label: 'México (GMT-6)' },
  { id: 'America/Panama', label: 'Panamá (GMT-5)' },
  { id: 'America/Costa_Rica', label: 'Costa Rica (GMT-6)' },
  { id: 'America/Santo_Domingo', label: 'República Dominicana (GMT-4)' },
  { id: 'America/New_York', label: 'Estados Unidos — Este (GMT-5/-4)' },
  { id: 'America/Chicago', label: 'Estados Unidos — Centro (GMT-6/-5)' },
  { id: 'America/Denver', label: 'Estados Unidos — Montaña (GMT-7/-6)' },
  { id: 'America/Los_Angeles', label: 'Estados Unidos — Pacífico (GMT-8/-7)' },
  { id: 'Europe/Madrid', label: 'España (GMT+1/+2)' },
  { id: 'Europe/London', label: 'Reino Unido (GMT+0/+1)' },
  { id: 'Europe/Paris', label: 'Francia (GMT+1/+2)' },
  { id: 'UTC', label: 'UTC (GMT+0)' },
];

export function findZonaHoraria(id) {
  return ZONAS_HORARIAS.find((z) => z.id === id) || ZONAS_HORARIAS[0];
}

export const ZONA_HORARIA_DEFAULT = 'America/Argentina/Buenos_Aires';
