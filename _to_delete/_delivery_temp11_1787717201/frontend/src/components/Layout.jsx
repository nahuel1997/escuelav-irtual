import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import AppTopbar from './AppTopbar';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import CartDrawer from './CartDrawer';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../hooks/useContent';
import { useFonts } from '../hooks/useFonts';
import { useTheme } from '../hooks/useTheme';
import { useFavicon } from '../hooks/useFavicon';

export default function Layout() {
  // Se piden acá arriba para poder aplicar tipografía, colores de marca y
  // favicon elegidos en Generales a todo el sitio público apenas carga
  // cualquier página.
  const { values } = useContent();
  useFonts(values);
  useTheme(values);
  useFavicon(values);

  const { user } = useAuth();
  // Apenas hay un alumno o profesor logueado, el menú pasa del header
  // horizontal (Navbar) a una sidebar fija a la izquierda (Sidebar,
  // colapsable) — mismo criterio de "área con menú propio" que ya usa
  // /admin-panel, pero temado como el sitio público. Un visitante sin
  // sesión sigue viendo el Navbar de siempre: admin y soporte ni pasan por
  // acá, tienen su login y layout aparte.
  const conSidebar = user && ['alumno', 'profesor'].includes(user.rol);

  // El capítulo del classroom (video) y la sala de una clase en vivo
  // (Jitsi) son la única sección "de video" del sitio: pensada para usar
  // toda la pantalla (ver .container-video en global.css), no para
  // terminar scrolleando hasta un Footer de sitio público que no aporta
  // nada ahí. Se detecta por ruta en vez de agregar una prop porque
  // Layout.jsx es el único lugar que decide si hay Footer o no.
  const { pathname } = useLocation();
  const sinFooter = /^\/classroom\/[^/]+\/unidades\/[^/]+\/capitulos\/[^/]+/.test(pathname)
    || /^\/clases-en-vivo\/[^/]+\/sala/.test(pathname);

  if (conSidebar) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar user={user} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <AppTopbar />
          <main style={{ flex: 1 }}>
            <Outlet />
          </main>
          {!sinFooter && <Footer />}
        </div>
        <ChatWidget />
        <CartDrawer />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
      {!sinFooter && <Footer />}
      {/* Chat de contacto flotante — solo se muestra si hay un alumno o
          profesor logueado (ver adentro del componente); un visitante
          anónimo o un admin no lo ven. */}
      <ChatWidget />
      {/* Panel lateral del carrito — montado acá (una sola vez, fuera del
          <Outlet/>) para poder abrirse con el ícono del Navbar desde
          cualquier página sin perder el estado; solo se renderiza para
          alumnos (ver adentro del componente). */}
      <CartDrawer />
    </>
  );
}
