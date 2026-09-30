// Etiquetas y colores de estado/prioridad de los tickets de soporte —
// compartidas entre "Mis consultas" y la bandeja del equipo.
export const ESTADOS_TICKET = {
  abierto: { label: 'Abierto', clase: 'badge-warning' },
  en_curso: { label: 'En curso', clase: 'badge-warning' },
  esperando_usuario: { label: 'Esperando respuesta', clase: '' },
  resuelto: { label: 'Resuelto', clase: 'badge-success' },
  cerrado: { label: 'Cerrado', clase: 'badge-success' },
};

export const PRIORIDADES_TICKET = {
  baja: { label: 'Baja', clase: '' },
  media: { label: 'Media', clase: 'badge-warning' },
  alta: { label: 'Alta', clase: 'badge-danger' },
};
