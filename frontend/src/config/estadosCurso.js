// Estados posibles de un curso — reflejan backend/src/config/estadosCurso.js
// (el backend es quien valida los valores; esto es solo para no repetir la
// lista/etiquetas/color de badge en cada pantalla que los muestra).
export const ESTADOS_CURSO = [
  { value: 'subido', label: 'Subido', badge: 'badge-success' },
  { value: 'en_revision', label: 'En revisión', badge: 'badge-warning' },
  { value: 'cancelado', label: 'Cancelado', badge: 'badge-danger' },
  { value: 'fuera_sistema', label: 'Fuera de sistema', badge: '' },
];

export const ESTADO_CURSO_INFO = Object.fromEntries(ESTADOS_CURSO.map((e) => [e.value, e]));
