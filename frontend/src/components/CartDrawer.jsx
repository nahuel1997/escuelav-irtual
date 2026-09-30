import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { API_ORIGIN } from '../api/client';
import Icon from './Icon';

function formatPrecio(precio) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precio);
}

// Panel lateral del carrito: se monta una sola vez en Layout.jsx (mismo
// criterio que ChatWidget.jsx) para poder abrirse desde CUALQUIER página
// con el ícono 🛒 del Navbar, sin navegar. Es un preview rápido — el
// checkout de verdad (el pago simulado) sigue pasando en /carrito, que es
// justamente adonde lleva el botón "Finalizar compra" de acá abajo.
//
// A diferencia de un carrito de e-commerce típico, acá no hay selector de
// cantidad: cada curso es un ítem único (no tiene sentido "comprar 2 del
// mismo curso"), así que cada fila es simplemente título + precio + sacar.
export default function CartDrawer() {
  const { user } = useAuth();
  const { items, drawerAbierto, cerrarDrawer, quitar } = useCart();
  const navigate = useNavigate();

  const subtotal = items.reduce((acc, i) => acc + Number(i.precio || 0), 0);

  // Cerrar con Escape, como cualquier panel/modal.
  useEffect(() => {
    if (!drawerAbierto) return undefined;
    function alTecla(e) {
      if (e.key === 'Escape') cerrarDrawer();
    }
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [drawerAbierto, cerrarDrawer]);

  // Se muestra tanto a invitados (carrito en localStorage) como a alumnos
  // logueados — solo se oculta para profesor/admin, que no compran cursos.
  if (user && user.rol !== 'alumno') return null;

  function irAlCheckout() {
    cerrarDrawer();
    navigate('/carrito');
  }

  function irALaTienda() {
    cerrarDrawer();
    navigate('/tienda');
  }

  return (
    <>
      {/* Backdrop: atenúa el resto de la página y cierra el panel al
          tocarlo afuera, como cualquier drawer. */}
      <div
        onClick={cerrarDrawer}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 90,
          opacity: drawerAbierto ? 1 : 0, pointerEvents: drawerAbierto ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
        aria-hidden="true"
      />

      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(380px, 100vw)',
          background: '#fff', zIndex: 91, boxShadow: '-8px 0 30px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          transform: drawerAbierto ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
        }}
        aria-hidden={!drawerAbierto}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <strong style={{ fontSize: '1.05rem' }}>Tu carrito</strong>
          <button
            onClick={cerrarDrawer}
            style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, color: 'var(--color-text)' }}
            aria-label="Cerrar carrito"
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, marginTop: 20 }}>
              <p className="text-muted">Todavía no agregaste ningún curso al carrito.</p>
              <button className="btn btn-outline btn-sm" onClick={irALaTienda}>Ir a la tienda</button>
            </div>
          )}

          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                background: 'var(--color-bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.imagen_url ? (
                  <img
                    src={item.imagen_url.startsWith('/uploads') ? `${API_ORIGIN}${item.imagen_url}` : item.imagen_url}
                    alt={item.titulo}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Icon name="book" size={22} style={{ color: 'var(--color-text-muted)' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.titulo}
                </p>
                <p className="text-muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>{item.precio_original ? <><s className="text-muted" style={{ fontWeight: 400, marginRight: 6 }}>{formatPrecio(item.precio_original)}</s>{formatPrecio(item.precio)} <span className="badge badge-danger">-{item.descuento_pct}%</span></> : formatPrecio(item.precio)}</p>
              </div>
              <button
                onClick={() => quitar(item.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-danger)', padding: 4 }}
                aria-label={`Quitar ${item.titulo} del carrito`}
                title="Quitar"
              >
                <Icon name="trash" size={17} />
              </button>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700 }}>Subtotal</span>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{formatPrecio(subtotal)}</span>
            </div>
            <button className="btn btn-accent" style={{ width: '100%' }} onClick={irAlCheckout}>
              Finalizar compra
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
