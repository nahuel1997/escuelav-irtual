import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useContent } from '../hooks/useContent';
import { API_ORIGIN } from '../api/client';

const CLAVE_COLAPSADO = 'sidebar_colapsado';

// Links del menú lateral, con ícono para que sigan siendo reconocibles
// cuando el menú está colapsado (solo íconos, sin texto). Es intencional
// que sea una lista aparte de la de Navbar.jsx (getNavLinks): esa sigue
// siendo la del header horizontal para un visitante sin sesión, esta es
// la del menú lateral que reemplaza al header una vez que hay un alumno o
// profesor logueado — ver Layout.jsx.
function getSidebarLinks(user) {
  const comunes = [{ to: '/', label: 'Inicio', icon: '🏠', end: true }];

  if (user.rol === 'profesor') {
    return [
      ...comunes,
      { to: '/panel', label: 'Mi panel', icon: '🧭' },
      { to: '/mis-cursos', label: 'Mis cursos', icon: '📚' },
      { to: '/calendario', label: 'Calendario', icon: '🗓️' },
      { to: '/clases-en-vivo', label: 'Clases en vivo', icon: '🎥' },
    ];
  }

  // alumno
  return [
    ...comunes,
    { to: '/tienda', label: 'Tienda de cursos', icon: '🛍️' },
    { to: '/panel', label: 'Mi panel', icon: '🧭' },
    { to: '/mis-cursos', label: 'Mis cursos', icon: '📚' },
    { to: '/calendario', label: 'Calendario', icon: '🗓️' },
    { to: '/clases-en-vivo', label: 'Clases en vivo', icon: '🎥' },
    { to: '/logros', label: 'Logros', icon: '🏆' },
    { to: '/cv', label: 'Creador de CV', icon: '📄' },
    { to: '/integraciones-ia', label: 'Integraciones IA', icon: '🔌' },
    { to: '/gpts', label: 'GPTs', icon: '🤖' },
  ];
}

function leerPreferenciaGuardada() {
  try {
    const guardado = localStorage.getItem(CLAVE_COLAPSADO);
    if (guardado !== null) return guardado === '1';
  } catch {
    // localStorage puede no estar disponible (modo privado agresivo, etc.)
    // — en ese caso no persiste entre visitas, pero no rompe nada.
  }
  // Sin preferencia guardada todavía: arranca colapsado en pantallas
  // angostas (más lugar para el contenido), expandido en el resto.
  return typeof window !== 'undefined' && window.innerWidth < 860;
}

// Menú lateral para alumno/profesor logueados — mismo espíritu que
// AdminLayout.jsx (sidebar fija a la izquierda con logo + links), pero
// con la marca/colores del sitio público (temables desde Generales, ver
// useTheme.js) en vez del look fijo del backoffice, y con un botón propio
// para colapsarlo a solo íconos sin perder el acceso a ningún link.
export default function Sidebar({ user }) {
  const [colapsado, setColapsado] = useState(leerPreferenciaGuardada);
  const { values: content } = useContent();
  const logo = content['general.logo'];
  const logoAlt = content['general.logo.alt'] || 'Escuela Online';
  const links = getSidebarLinks(user);
  // Iniciales para el logo colapsado: la mayoría de los logos son
  // isotipo + texto (no un ícono cuadrado), así que achicar la imagen tal
  // cual la deja ilegible en la barra angosta — mostramos las iniciales
  // del nombre de marca en su lugar, y recién con el menú expandido se ve
  // el logo completo cargado en Generales.
  const iniciales = logoAlt.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_COLAPSADO, colapsado ? '1' : '0');
    } catch {
      // ver comentario en leerPreferenciaGuardada
    }
  }, [colapsado]);

  return (
    <aside
      className={`app-sidebar${colapsado ? ' app-sidebar-colapsado' : ''}`}
      style={{
        width: colapsado ? 72 : 220,
        background: 'var(--color-dark-bg)',
        color: 'var(--color-dark-text)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        transition: 'width 0.18s ease',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setColapsado((v) => !v)}
        className="app-sidebar-toggle"
        style={{
          alignSelf: colapsado ? 'center' : 'flex-end',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-dark-text)',
          opacity: 0.75,
          cursor: 'pointer',
          fontSize: '1rem',
          padding: '14px 16px',
          lineHeight: 1,
        }}
        title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
        aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
        aria-expanded={!colapsado}
      >
        {colapsado ? '»' : '«'}
      </button>

      <Link
        to="/"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: colapsado ? 'center' : 'flex-start',
          padding: colapsado ? '0 0 20px' : '0 20px 20px', minHeight: 30,
        }}
      >
        {colapsado ? (
          <span
            style={{
              width: 34, height: 34, borderRadius: 8, background: '#fff', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading), sans-serif', fontWeight: 800, fontSize: '0.85rem',
            }}
          >
            {iniciales || 'EO'}
          </span>
        ) : logo ? (
          <div style={{ background: '#fff', display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 8 }}>
            <img
              src={logo.startsWith('/uploads') ? `${API_ORIGIN}${logo}` : logo}
              alt={logoAlt}
              style={{ height: 22, display: 'block', maxWidth: 140, objectFit: 'contain' }}
            />
          </div>
        ) : (
          <strong style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: '1.15rem' }}>
            Escuela Online
          </strong>
        )}
      </Link>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px', flex: 1, overflowY: 'auto' }}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            title={colapsado ? l.label : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              justifyContent: colapsado ? 'center' : 'flex-start',
              padding: colapsado ? '11px 0' : '11px 12px',
              borderRadius: 8,
              color: isActive ? 'var(--color-dark-text)' : 'rgba(255,255,255,0.72)',
              background: isActive ? 'rgba(255,255,255,0.14)' : 'transparent',
              textDecoration: 'none',
              fontSize: '0.92rem',
              whiteSpace: 'nowrap',
            })}
          >
            <span aria-hidden="true" style={{ fontSize: '1.05rem', lineHeight: 1 }}>{l.icon}</span>
            {!colapsado && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
