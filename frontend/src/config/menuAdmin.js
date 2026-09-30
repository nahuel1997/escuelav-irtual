// Menú de fábrica del panel de admin, agrupado en secciones. El admin lo
// puede reordenar, renombrar y ocultar desde "Menú del panel" (se guarda en
// el backend como config.menu_admin); lo que no esté en el menú guardado
// (una pantalla nueva agregada después) aparece al final, en "Otros", para
// que nunca quede inaccesible.
export const MENU_ADMIN_DEFAULT = [
  {
    nombre: 'General',
    items: [
      { ruta: '/admin-panel', titulo: 'Dashboard' },
      { ruta: '/admin-panel/reportes', titulo: 'Reportes' },
      { ruta: '/admin-panel/asistente', titulo: 'Asistente IA' },
    ],
  },
  {
    nombre: 'Personas',
    items: [
      { ruta: '/admin-panel/usuarios', titulo: 'Usuarios' },
      { ruta: '/admin-panel/profesores', titulo: 'Profesores' },
      { ruta: '/admin-panel/calificaciones', titulo: 'Calificaciones internas' },
      { ruta: '/admin-panel/encuestas', titulo: 'Encuestas' },
      { ruta: '/admin-panel/alertas', titulo: 'Alertas' },
      { ruta: '/admin-panel/bloqueados', titulo: 'Bloqueados' },
      { ruta: '/admin-panel/logins', titulo: 'Sesiones' },
    ],
  },
  {
    nombre: 'Cursos',
    items: [
      { ruta: '/admin-panel/cursos', titulo: 'Cursos' },
      { ruta: '/admin-panel/calendario', titulo: 'Calendario' },
      { ruta: '/admin-panel/clases-en-vivo', titulo: 'Clases en vivo' },
      { ruta: '/admin-panel/pagos', titulo: 'Pagos' },
    ],
  },
  {
    nombre: 'Marketing',
    items: [
      { ruta: '/admin-panel/campanias', titulo: 'Campañas de mail' },
      { ruta: '/admin-panel/ofertas', titulo: 'Ofertas en la app' },
      { ruta: '/admin-panel/mails', titulo: 'Mails' },
      { ruta: '/admin-panel/contenido', titulo: 'Contenido del sitio' },
    ],
  },
  {
    nombre: 'Soporte',
    items: [
      { ruta: '/admin-panel/tickets', titulo: 'Tickets', contador: 'tickets' },
      { ruta: '/admin-panel/errores', titulo: 'Errores', contador: 'errores' },
      { ruta: '/admin-panel/soporte', titulo: 'Agentes de soporte' },
      { ruta: '/admin-panel/chats', titulo: 'Chats' },
    ],
  },
  {
    nombre: 'Integraciones',
    items: [
      { ruta: '/admin-panel/apis', titulo: 'APIs' },
      { ruta: '/admin-panel/lti', titulo: 'Integraciones LMS (LTI)' },
      { ruta: '/admin-panel/cv-ia', titulo: 'CV para IA' },
      { ruta: '/admin-panel/ai-integraciones', titulo: 'Integraciones IA' },
    ],
  },
  {
    nombre: 'Sistema',
    items: [
      { ruta: '/admin-panel/configuracion', titulo: 'Configuración' },
      { ruta: '/admin-panel/estado-app', titulo: 'Estado de la app' },
      { ruta: '/admin-panel/trafico', titulo: 'Tráfico' },
      { ruta: '/admin-panel/procesos', titulo: 'Procesos' },
      { ruta: '/admin-panel/pantallas', titulo: 'Pantallas' },
      { ruta: '/admin-panel/tester', titulo: 'Tester' },
      { ruta: '/admin-panel/testing', titulo: 'Testing' },
      { ruta: '/admin-panel/testing/pagos', titulo: 'Test Pagos' },
      { ruta: '/admin-panel/versiones', titulo: 'Versiones' },
      { ruta: '/admin-panel/manual', titulo: 'Manual' },
      { ruta: '/admin-panel/menu', titulo: 'Menú del panel' },
      { ruta: '/admin-panel/sistema', titulo: 'Backups y actualizaciones' },
    ],
  },
];

const CATALOGO = new Map(MENU_ADMIN_DEFAULT.flatMap((s) => s.items).map((it) => [it.ruta, it]));

// Menú guardado + catálogo → menú final. Ítems desconocidos se descartan;
// los que faltan van a "Otros"; "Menú del panel" nunca se puede ocultar
// (si no, no habría forma de volver a mostrar nada).
export function armarMenu(guardado) {
  if (!guardado || !Array.isArray(guardado.secciones)) return MENU_ADMIN_DEFAULT.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, visible: true })) }));
  const usados = new Set();
  const secciones = guardado.secciones.map((s) => ({
    nombre: s.nombre,
    items: (s.items || [])
      .filter((it) => CATALOGO.has(it.ruta) && !usados.has(it.ruta))
      .map((it) => {
        usados.add(it.ruta);
        return { ...CATALOGO.get(it.ruta), titulo: it.titulo || CATALOGO.get(it.ruta).titulo, visible: it.ruta === '/admin-panel/menu' ? true : it.visible !== false };
      }),
  }));
  const faltantes = [...CATALOGO.values()].filter((it) => !usados.has(it.ruta)).map((it) => ({ ...it, visible: true }));
  if (faltantes.length) secciones.push({ nombre: 'Otros', items: faltantes });
  return secciones;
}
