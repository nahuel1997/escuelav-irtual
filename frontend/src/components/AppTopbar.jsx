import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Icon from './Icon';
import { useModoOscuro } from '../hooks/useModoOscuro';

// Header superior para alumno/profesor logueados — angosto, sin el menú
// de navegación (que ahora vive en el Sidebar de al lado, ver Layout.jsx):
// solo lo que no es "navegación" en sí, sino acciones de cuenta — Contacto,
// Mi perfil, el carrito (solo alumno) y Cerrar sesión.
export default function AppTopbar() {
  const { user, logout } = useAuth();
  const { items, toggleDrawer } = useCart();
  const navigate = useNavigate();
  const modoOscuro = useModoOscuro();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header style={{ borderBottom: '1px solid var(--color-border)', background: '#fff', position: 'sticky', top: 0, zIndex: 20 }}>
      {/* flexWrap: en vez de un height fijo (que en pantallas angostas
          recortaba "Cerrar sesión" contra el borde derecho), esta fila
          pasa a una segunda línea sola cuando no entra todo junto — mismo
          criterio que .navbar-collapse en el header público. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 12, rowGap: 8, minHeight: 60, padding: '10px 24px' }}>
        <Link to="/contacto" className="text-muted" style={{ fontSize: '0.9rem' }}>Contacto</Link>

        {user.rol === 'alumno' && (
          <button
            onClick={toggleDrawer}
            className="text-muted"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1rem' }}
            title="Mi carrito"
            aria-label="Abrir carrito"
          >
            <Icon name="cart" size={18} />
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

        <Link to="/perfil" className="text-muted" style={{ fontSize: '0.9rem' }}>
          {user.nombre} <span className="badge">{user.rol}</span>
        </Link>

        {modoOscuro.disponible && (
          <button
            className="btn btn-outline btn-sm"
            onClick={modoOscuro.alternar}
            title={modoOscuro.activo ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}
            aria-pressed={modoOscuro.activo}
          >
            {modoOscuro.activo ? '☀ Claro' : '☾ Oscuro'}
          </button>
        )}

        <button className="btn btn-outline btn-sm" onClick={handleLogout}>Cerrar sesión</button>
      </div>
    </header>
  );
}
