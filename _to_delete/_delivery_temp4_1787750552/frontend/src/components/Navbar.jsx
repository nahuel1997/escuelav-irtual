import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useContent } from '../hooks/useContent';
import { API_ORIGIN } from '../api/client';

// El menú de navegación depende del rol: alumno y profesor usan la
// plataforma para cosas distintas, así que no tiene sentido mostrarles las
// mismas opciones. Los links públicos (Inicio/Contacto) son para todos.
function getNavLinks(user) {
  const publicos = [
    { to: '/', label: 'Inicio', end: true },
    { to: '/contacto', label: 'Contacto' },
  ];

  if (!user) {
    return [...publicos, { to: '/tienda', label: 'Tienda de cursos' }];
  }

  if (user.rol === 'profesor') {
    return [
      ...publicos,
      { to: '/panel', label: 'Mi panel' },
      { to: '/mis-cursos', label: 'Mis cursos' },
      { to: '/calendario', label: 'Calendario' },
      { to: '/clases-en-vivo', label: 'Clases en vivo' },
      { to: '/agentes', label: 'Orquestación de agentes' },
    ];
  }

  // alumno
  return [
    ...publicos,
    { to: '/tienda', label: 'Tienda de cursos' },
    { to: '/panel', label: 'Mi panel' },
    { to: '/mis-cursos', label: 'Mis cursos' },
    { to: '/calendario', label: 'Calendario' },
    { to: '/clases-en-vivo', label: 'Clases en vivo' },
    { to: '/agentes', label: 'Orquestación de agentes' },
    { to: '/logros', label: 'Logros' },
    { to: '/cv', label: 'Creador de CV' },
  ];
}

// Los links extra que carga el admin (Generales → Links de menú) pueden
// apuntar afuera del sitio, así que no son siempre un <Link> de router.
function ExtraLink({ url, children }) {
  const esExterno = /^https?:\/\//.test(url);
  if (esExterno) {
    return <a href={url} target="_blank" rel="noreferrer" className="text-muted">{children}</a>;
  }
  return <NavLink to={url} className="text-muted">{children}</NavLink>;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { items, toggleDrawer } = useCart();
  const navigate = useNavigate();
  const { values: content, navLinks } = useContent();
  const links = getNavLinks(user);
  const extraMenu = navLinks.filter((l) => l.ubicacion === 'menu');
  // Menú de mobile: por default el header entero (links + acciones) entra
  // en una sola fila y a un ancho angosto (celular) no hay lugar — se
  // recortaba contra el borde de la pantalla. Acá abajo de ~860px pasa a
  // un botón de hamburguesa que despliega los links y acciones como un
  // panel debajo del header (ver .navbar-collapse en global.css); en
  // desktop este estado ni se usa, el CSS lo ignora.
  const [menuAbierto, setMenuAbierto] = useState(false);

  const logo = content['general.logo'];
  const logoAlt = content['general.logo.alt'] || 'Escuela Online';

  function handleLogout() {
    logout();
    navigate('/');
  }

  function irA(fn) {
    setMenuAbierto(false);
    if (fn) fn();
  }

  return (
    <header className="navbar" style={{ borderBottom: '1px solid var(--color-border)', background: '#fff', position: 'sticky', top: 0, zIndex: 20 }}>
      <div className="container navbar-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
        <Link to="/" onClick={() => setMenuAbierto(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-primary-dark)' }}>
          {logo ? (
            <img
              src={logo.startsWith('/uploads') ? `${API_ORIGIN}${logo}` : logo}
              alt={logoAlt}
              style={{ height: 34, display: 'block' }}
            />
          ) : (
            'Escuela Online'
          )}
        </Link>

        <button
          type="button"
          className="navbar-hamburger"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
        >
          <span /><span /><span />
        </button>

        <div className={`navbar-collapse${menuAbierto ? ' open' : ''}`}>
          <nav className="navbar-links">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="text-muted" onClick={() => setMenuAbierto(false)}>
                {l.label}
              </NavLink>
            ))}
            {extraMenu.map((l) => <ExtraLink key={l.id} url={l.url}>{l.texto}</ExtraLink>)}
          </nav>

          <div className="navbar-actions">
            {(!user || user.rol === 'alumno') && (
              // Antes navegaba a /carrito directo; ahora abre el panel lateral
              // (CartDrawer.jsx, montado en Layout.jsx) para poder verlo sin
              // salir de la página en la que estás — /carrito sigue existiendo
              // como el checkout de verdad, adonde lleva "Finalizar compra".
              // Visible sin estar logueado a propósito: el carrito de un
              // invitado vive en localStorage (ver CartContext.jsx) y se
              // fusiona solo con el de la cuenta apenas inicia sesión.
              <button
                onClick={() => irA(toggleDrawer)}
                className="text-muted"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1rem' }}
                title="Mi carrito"
                aria-label="Abrir carrito"
              >
                🛒
                {items.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -8, right: -10, background: 'var(--color-accent)', color: '#000',
                    borderRadius: 999, fontSize: '0.7rem', minWidth: 16, height: 16, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontWeight: 700,
                  }}>
                    {items.length}
                  </span>
                )}
              </button>
            )}
            {!user && (
              <>
                <Link to="/ingresar" className="btn btn-outline btn-sm" onClick={() => setMenuAbierto(false)}>Ingresar</Link>
                <Link to="/registrarme" className="btn btn-primary btn-sm" onClick={() => setMenuAbierto(false)}>Registrarme</Link>
              </>
            )}
            {user && (
              <>
                <Link to="/perfil" className="text-muted" style={{ fontSize: '0.9rem' }} onClick={() => setMenuAbierto(false)}>
                  {user.nombre} <span className="badge">{user.rol}</span>
                </Link>
                <button className="btn btn-outline btn-sm" onClick={() => irA(handleLogout)}>Cerrar sesión</button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
