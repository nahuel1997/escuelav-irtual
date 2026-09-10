// Set propio de íconos en SVG monocromático (trazo, sin relleno) que
// reemplaza los emojis que usaba la UI antes (🏠🛍️🧭📚🗓️🎥🏆📄🔌🤖🛒💬
// 👁️🙈📎🔒🗑✓, etc.). Cada ícono usa stroke="currentColor" — hereda el
// color de texto del lugar donde se lo pone, así que sale blanco solo con
// ponerlo en un contenedor de fondo oscuro (el Sidebar, por ejemplo, ya
// define `color` en blanco/gris claro para sus links) y negro/gris oscuro
// en uno de fondo claro (tarjetas, botones con `className="text-muted"`,
// etc.) — sin tener que elegir "blanco o negro" a mano en cada lugar que
// se usa, y sin depender de que el sistema operativo/navegador tenga
// instalada una fuente de emoji a color (antes, sin eso, algunos emojis
// se veían como un cuadrado vacío).
//
// Para agregar un ícono nuevo: sumá una entrada a PATHS con el <path>/
// <circle>/etc. de un viewBox 24x24, después usalo como <Icon name="..." />.
const PATHS = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5a1 1 0 0 0 1 1H9.5v-6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6h3a1 1 0 0 0 1-1V10" />,
  store: (
    <>
      <path d="M4 8.5 5 4h14l1 4.5" />
      <path d="M4 8.5v10.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8.5" />
      <path d="M4 8.5h16M9 20v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-1.5 5-5 1.5 1.5-5z" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2z" />
      <path d="M6 18.5a2 2 0 0 1 2-2h10" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  video: (
    <>
      <rect x="2.5" y="6.5" width="13" height="11" rx="2" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3z" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1a4 4 0 0 0 3.5 4M17 6h3v1a4 4 0 0 1-3.5 4" />
      <path d="M12 14v3M9 20.5h6M9.5 20.5v-2.4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.4" />
    </>
  ),
  document: (
    <>
      <path d="M7 3h6l4.5 4.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M13 3v4.5h4.5" />
    </>
  ),
  plug: (
    <>
      <path d="M9 2.5v5M15 2.5v5M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 16v5.5" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="2.5" />
      <path d="M12 5.5V9M9 5.5h6" />
      <path d="M9 14.5v1M15 14.5v1" />
      <path d="M2 13v3M22 13v3" />
    </>
  ),
  cart: (
    <>
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
      <path d="M2 3h2.2l2.4 12.4a1.8 1.8 0 0 0 1.77 1.5h9.36a1.8 1.8 0 0 0 1.77-1.46L21 7.5H6" />
    </>
  ),
  chat: <path d="M4 4.5h16v11.5H9L4.5 20V4.5z" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A11 11 0 0 1 12 5c6.4 0 10 7 10 7a17.9 17.9 0 0 1-3.06 4.06M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10.6 10.6 0 0 0 4.24-.87" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  paperclip: <path d="M21.4 11.5 12 20.9a5 5 0 0 1-7.07-7.07L14.5 4.26a3.5 3.5 0 0 1 4.95 4.95L10 18.66a2 2 0 0 1-2.83-2.83L15.5 7.6" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V7.3a4 4 0 0 1 8 0V11" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M6.3 7 7.2 20a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1L17.7 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  check: <path d="M20 6.5 9.5 17 4 11.5" />,
};

export default function Icon({ name, size = 18, strokeWidth = 1.8, style, ...rest }) {
  const contenido = PATHS[name];
  if (!contenido) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0, ...style }}
      {...rest}
    >
      {contenido}
    </svg>
  );
}
