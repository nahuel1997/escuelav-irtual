import { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useContent } from '../hooks/useContent';
import { useFavicon } from '../hooks/useFavicon';
import { API_ORIGIN } from '../api/client';

const links = [
  { to: '/admin-panel', label: 'Dashboard', end: true },
  { to: '/admin-panel/cursos', label: 'Cursos' },
  { to: '/admin-panel/profesores', label: 'Profesores' },
  { to: '/admin-panel/usuarios', label: 'Usuarios' },
  { to: '/admin-panel/contenido', label: 'Contenido del sitio' },
  { to: '/admin-panel/calendario', label: 'Calendario' },
  { to: '/admin-panel/clases-en-vivo', label: 'Clases en vivo' },
  { to: '/admin-panel/mails', label: 'Mails' },
  { to: '/admin-panel/pagos', label: 'Pagos' },
  { to: '/admin-panel/soporte', label: 'Agentes de soporte' },
  { to: '/admin-panel/chats', label: 'Chats' },
  { to: '/admin-panel/errores', label: 'Errores' },
  { to: '/admin-panel/logins', label: 'Sesiones' },
  { to: '/admin-panel/apis', label: 'APIs' },
  { to: '/admin-panel/testing', label: 'Testing' },
  { to: '/admin-panel/testing/pagos', label: 'Test Pagos' },
  { to: '/admin-panel/lti', label: 'Integraciones LMS (LTI)' },
];

// Layout propio del backoffice: sidebar oscuro fijo + contenido a la
// derecha. Deliberadamente distinto del Navbar/Footer públicos para que
// se sienta como un área aparte (como el /pmt-admin de referencia).
export default function AdminLayout() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  // Mismo contenido público (logo, alt) que usa el Navbar del sitio: el
  // panel de admin ya no queda afuera del sistema de theming en lo que
  // respecta al logo/marca, aunque el resto de sus colores/tipografía sigue
  // siendo el look fijo del backoffice (ver nota en la entrega anterior).
  const { values: content } = useContent();
  const logo = content['general.logo'];
  const logoAlt = content['general.logo.alt'] || 'Escuela Online';
  // El favicon sí es global (identifica la pestaña, no es parte del "look"
  // del backoffice), así que el admin también lo aplica — a diferencia de
  // useTheme()/useFonts(), que quedan fuera de este layout a propósito.
  useFavicon(content);
  // El sidebar del backoffice era fijo (220px, siempre visible) — en
  // celular eso solo le dejaba a "main" un resto angosto y todo el
  // contenido terminaba recortado contra el borde. Abajo de ~860px pasa a
  // un panel que se esconde fuera de pantalla (ver .admin-sidebar en
  // global.css) y se abre con este botón; en desktop el CSS lo ignora y
  // el sidebar se comporta exactamente como antes.
  const [menuAbierto, setMenuAbierto] = useState(false);

  function handleLogout() {
    logout();
    navigate('/admin-panel/ingresar');
  }

  function cerrarMenu() {
    setMenuAbierto(false);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <button
        type="button"
        className="admin-mobile-toggle"
        onClick={() => setMenuAbierto((v) => !v)}
        aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuAbierto}
      >
        <span /><span /><span />
      </button>
      {menuAbierto && <div className="admin-backdrop" onClick={cerrarMenu} />}

      <aside className={`admin-sidebar${menuAbierto ? ' open' : ''}`} style={{ width: 220, background: 'var(--color-dark-bg)', color: '#fff', padding: '24px 16px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', marginBottom: 24 }}>
          {logo ? (
            // Fondo blanco chico detrás del logo: no sabemos qué colores va
            // a tener el logo que suba el admin, y el sidebar es oscuro. Un
            // logo oscuro sin este fondo sería invisible acá. No alteramos
            // el logo en sí (nada de filtros), solo le damos contraste.
            <div style={{ background: '#fff', display: 'inline-block', padding: '6px 10px', borderRadius: 8, marginBottom: 6 }}>
              <img
                src={logo.startsWith('/uploads') ? `${API_ORIGIN}${logo}` : logo}
                alt={logoAlt}
                style={{ height: 26, display: 'block' }}
              />
            </div>
          ) : (
            'Escuela Online'
          )}
          <span style={{ color: 'var(--color-accent)', fontSize: '0.85rem' }}>Panel de admin</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={cerrarMenu}
              style={({ isActive }) => ({
                padding: '10px 12px',
                borderRadius: 8,
                color: isActive ? '#fff' : '#b7c2cf',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                textDecoration: 'none',
                fontSize: '0.92rem',
              })}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 16 }}>
          <p style={{ color: '#b7c2cf', fontSize: '0.85rem', margin: 0 }}>{user?.nombre} {user?.apellido}</p>
          <Link to="/" style={{ fontSize: '0.8rem', color: '#8b97a5', display: 'block', marginTop: 8 }}>← Volver al sitio</Link>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 10, borderColor: '#455568', color: '#fff' }} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="admin-main" style={{ flex: 1, background: 'var(--color-bg-alt)', padding: '32px 40px', overflowX: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
