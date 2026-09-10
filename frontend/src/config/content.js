// Registro de todo el contenido editable del sitio desde
// /admin-panel/contenido. Está organizado por página (cada una es una
// sub-pestaña del panel) para que sea fácil ubicar qué se edita dónde.
//
// Tipos de campo:
//   texto     -> input o textarea (según `textarea: true`)
//   imagen    -> sube un archivo, guarda la URL
//   color     -> selector de color (#rrggbb)
//   seleccion -> lista fija de opciones (tipografías, ver options)
//   boton     -> referencia a una "Opción N" del registro de botones
//                (Generales). Si `soloColor` es true, esa opción solo
//                aporta color de fondo/texto: el link del botón queda fijo
//                en código porque el botón dispara una acción (enviar un
//                formulario, comprar) y no puede apuntar a otro lado.
//
// Para agregar un campo nuevo: sumarlo acá (en la página que corresponda)
// y leerlo con useContent() en la página pública correspondiente.
export const CONTENT_PAGES = [
  {
    id: 'general',
    label: 'Generales',
    campos: [
      { clave: 'general.logo', tipo: 'imagen', label: 'Logo del sitio', default: 'data:image/png;base64,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' },
      { clave: 'general.logo_oscuro', tipo: 'imagen', label: 'Logo para fondos oscuros (footer) — opcional, si no se carga se usa el logo normal', default: 'data:image/png;base64,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' },
      { clave: 'general.logo.alt', tipo: 'texto', label: 'Texto alternativo del logo (SEO/accesibilidad)', default: 'AIVIENTO' },
      { clave: 'general.favicon', tipo: 'imagen', label: 'Favicon (ícono de la pestaña del navegador — PNG o SVG cuadrado)', default: 'https://aiviento.com/wp-content/uploads/2026/07/cropped-Favicon-web-32x32.png' },
      { clave: 'general.tipografia.titulos', tipo: 'seleccion', opciones: 'titulos', label: 'Tipografía de títulos', default: 'syne' },
      { clave: 'general.tipografia.texto', tipo: 'seleccion', opciones: 'texto', label: 'Tipografía de texto', default: 'inter' },
      { clave: 'general.color_primario', tipo: 'color', label: 'Color primario (botones y títulos por defecto en todo el sitio)', default: '#000000' },
      { clave: 'general.color_acento', tipo: 'color', label: 'Color de acento (links y detalles sobre fondo oscuro)', default: '#a5e84f' },
      { clave: 'general.color_fondo_oscuro', tipo: 'color', label: 'Color de fondo oscuro (footer y secciones de cierre en todo el sitio)', default: '#000000' },
      { clave: 'general.color_texto_oscuro', tipo: 'color', label: 'Color de texto sobre fondo oscuro', default: '#ffffff' },
      { clave: 'general.seo.sufijo', tipo: 'texto', label: 'Sufijo del título (aparece en la pestaña del navegador)', default: 'Escuela Online' },
      { clave: 'general.seo.descripcion_default', tipo: 'texto', textarea: true, label: 'Meta descripción por defecto (SEO)', default: 'Plataforma de cursos online con classroom, tareas, logros y creador de CV.' },
      {
        clave: 'general.zona_horaria',
        tipo: 'seleccion',
        opciones: 'zonaHoraria',
        label: 'Zona horaria del sitio (con qué hora se muestran todas las fechas: calendario, sesiones, mails, etc.)',
        default: 'America/Argentina/Buenos_Aires',
      },
    ],
  },
  {
    id: 'home',
    label: 'Home',
    campos: [
      { clave: 'home.hero.badge', tipo: 'texto', label: 'Etiqueta (badge)', default: 'Educación online' },
      { clave: 'home.hero.titulo', tipo: 'texto', label: 'Título principal', default: 'Aprendé a tu ritmo, con seguimiento real de tus profesores' },
      { clave: 'home.hero.subtitulo', tipo: 'texto', textarea: true, label: 'Subtítulo', default: 'Cursos, classroom con entrega de tareas, logros y un creador de CV que arma tu currículum con lo que vas aprendiendo en la plataforma.' },
      { clave: 'home.hero.imagen', tipo: 'imagen', label: 'Imagen de portada' },
      { clave: 'home.hero.color_fondo', tipo: 'color', label: 'Color de fondo de la portada', default: '#ffffff' },
      { clave: 'home.hero.boton_principal', tipo: 'boton', label: 'Botón "Ver cursos disponibles"', default: '' },
      { clave: 'home.hero.boton_secundario', tipo: 'boton', label: 'Botón "Crear cuenta gratis"', default: '' },
      { clave: 'home.cta.boton', tipo: 'boton', label: 'Botón final "Registrarme" (sección oscura de cierre)', default: '' },
      { clave: 'home.seo.titulo', tipo: 'texto', label: 'Título SEO de esta página', default: 'Inicio' },
      { clave: 'home.seo.descripcion', tipo: 'texto', textarea: true, label: 'Meta descripción de esta página' },
    ],
  },
  {
    id: 'contacto',
    label: 'Contacto',
    campos: [
      { clave: 'contacto.email', tipo: 'texto', label: 'Email de contacto', default: 'contacto@escuelaonline.demo' },
      { clave: 'contacto.telefono', tipo: 'texto', label: 'Teléfono / WhatsApp', default: '+54 11 5555 0000' },
      { clave: 'contacto.ubicacion', tipo: 'texto', label: 'Ubicación', default: 'Buenos Aires, Argentina' },
      { clave: 'contacto.color_fondo', tipo: 'color', label: 'Color de fondo de la página', default: '#000000' },
      { clave: 'contacto.boton_enviar', tipo: 'boton', label: 'Botón "Enviar mensaje" (solo color, es un envío de formulario)', default: '', soloColor: true },
      { clave: 'contacto.seo.titulo', tipo: 'texto', label: 'Título SEO de esta página', default: 'Contacto' },
      { clave: 'contacto.seo.descripcion', tipo: 'texto', textarea: true, label: 'Meta descripción de esta página' },
    ],
  },
  {
    id: 'tienda',
    label: 'Tienda de cursos',
    campos: [
      { clave: 'tienda.titulo', tipo: 'texto', label: 'Título de la página', default: 'Tienda de cursos' },
      { clave: 'tienda.subtitulo', tipo: 'texto', label: 'Subtítulo', default: 'Elegí el curso que quieras empezar hoy.' },
      { clave: 'tienda.color_fondo', tipo: 'color', label: 'Color de fondo', default: '#ffffff' },
      { clave: 'tienda.seo.titulo', tipo: 'texto', label: 'Título SEO de esta página', default: 'Tienda de cursos' },
      { clave: 'tienda.seo.descripcion', tipo: 'texto', textarea: true, label: 'Meta descripción de esta página' },
    ],
  },
  {
    id: 'curso',
    label: 'Detalle de curso',
    campos: [
      { clave: 'curso.color_acento', tipo: 'color', label: 'Color del precio / acentos', default: '#a5e84f' },
      { clave: 'curso.boton_comprar', tipo: 'boton', label: 'Botón "Comprar / Inscribirme" (solo color, dispara la compra)', default: '', soloColor: true },
      { clave: 'curso.seo.titulo', tipo: 'texto', label: 'Título SEO de esta página', default: 'Curso' },
      { clave: 'curso.seo.descripcion', tipo: 'texto', textarea: true, label: 'Meta descripción de esta página' },
    ],
  },
  {
    id: 'terminos',
    label: 'Términos y condiciones',
    campos: [
      { clave: 'terminos.seo.titulo', tipo: 'texto', label: 'Título SEO de esta página', default: 'Términos y condiciones' },
      { clave: 'terminos.seo.descripcion', tipo: 'texto', textarea: true, label: 'Meta descripción de esta página' },
    ],
  },
  {
    id: 'login',
    label: 'Ingresar',
    campos: [
      { clave: 'login.boton_ingresar', tipo: 'boton', label: 'Botón "Ingresar" (solo color, dispara el login)', default: '', soloColor: true },
      { clave: 'login.seo.titulo', tipo: 'texto', label: 'Título SEO de esta página', default: 'Ingresar' },
    ],
  },
  {
    id: 'registro',
    label: 'Crear cuenta',
    campos: [
      { clave: 'registro.boton_crear', tipo: 'boton', label: 'Botón "Crear cuenta" (solo color, dispara el registro)', default: '', soloColor: true },
      { clave: 'registro.seo.titulo', tipo: 'texto', label: 'Título SEO de esta página', default: 'Crear cuenta' },
    ],
  },
];

// Todos los campos "aplanados", útil para valores por defecto y para
// buscar un campo puntual por clave sin recorrer las páginas a mano.
export const CONTENT_FIELDS = CONTENT_PAGES.flatMap((p) => p.campos);

export function defaultsMap() {
  const m = {};
  CONTENT_FIELDS.forEach((f) => { m[f.clave] = f.default ?? ''; });
  return m;
}
