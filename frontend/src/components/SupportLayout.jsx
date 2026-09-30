import { Outlet, useNavigate, useLocation, Link, NavLink } from 'react-router-dom';
import { useSupportAuth } from '../context/SupportAuthContext';
import { useContent } from '../hooks/useContent';

// Layout propio del panel de soporte — deliberadamente simple (una sola
// pantalla, la bandeja de chats), mismo look oscuro que AdminLayout para
// que se sienta parte de la misma familia de backoffices, pero sin
// sidebar de navegación: no hay nada más a lo que navegar todavía.
export default function SupportLayout() {
  const { user, logout } = useSupportAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // No usamos el contenido en sí acá (el panel de soporte no tiene look
  // personalizable) — solo llamamos al hook para que, aunque un agente
  // abra únicamente /soporte en la pestaña, la zona horaria configurada
  // por el admin se aplique igual al formatear fechas acá (ver
  // utils/fecha.js sobre por qué esto alcanza con solo llamar al hook).
  useContent();

  function handleLogout() {
    logout();
    navigate('/soporte/ingresar');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-alt)' }}>
      <header style={{ background: 'var(--color-dark-bg)', color: '#fff', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.05rem' }}>
            Escuela Online <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '0.85rem' }}>· Panel de soporte</span>
          </div>
          <nav style={{ display: 'flex', gap: 6 }}>
            {[['/soporte', 'Chats'], ['/soporte/tickets', 'Tickets'], ['/soporte/manual', 'Manual']].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end
                style={({ isActive }) => ({ padding: '6px 12px', borderRadius: 8, color: isActive ? '#fff' : '#b7c2cf', background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', textDecoration: 'none', fontSize: '0.9rem' })}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ color: '#b7c2cf', fontSize: '0.85rem' }}>{user?.nombre} {user?.apellido}</span>
          <Link to="/" style={{ fontSize: '0.8rem', color: '#8b97a5' }}>← Sitio público</Link>
          <button className="btn btn-outline btn-sm" style={{ borderColor: '#455568', color: '#fff' }} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      {/* La bandeja de chats ocupa el alto justo (overflow hidden); los
          tickets son una página común que scrollea. */}
      <main style={{ flex: 1, padding: '24px 28px', overflow: pathname === '/soporte' ? 'hidden' : 'auto', display: 'flex' }}>
        <Outlet />
      </main>
    </div>
  );
}
