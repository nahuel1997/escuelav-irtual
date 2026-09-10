import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useMetodosPago } from '../hooks/useMetodosPago';
import MetodoPagoSelector from '../components/MetodoPagoSelector';

function formatPrecio(precio) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precio);
}

export default function Cart() {
  const { user } = useAuth();
  const { items, loading, quitar, checkout } = useCart();
  const { metodos } = useMetodosPago();
  const navigate = useNavigate();
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(null);

  const total = items.reduce((acc, i) => acc + Number(i.precio || 0), 0);

  async function handleCheckout(metodoPago) {
    setComprando(true);
    setError('');
    try {
      const resultado = await checkout(metodoPago);
      if (resultado.redirect) {
        window.location.href = resultado.redirectUrl;
        return; // se va de la SPA, no hace falta setComprando(false)
      }
      setOk(resultado);
      setComprando(false);
    } catch (err) {
      setError(err.message);
      setComprando(false);
    }
  }

  if (ok) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 640 }}>
          <div className="alert alert-success">¡Compra confirmada! Ya podés entrar a tus cursos.</div>
          {ok.yaInscriptos?.length > 0 && (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Ya estabas inscripto en: {ok.yaInscriptos.join(', ')} (no se te cobró de nuevo).
            </p>
          )}
          <Link to="/mis-cursos" className="btn btn-primary">Ir a mis cursos</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <h1>Mi carrito</h1>

        {loading && <div className="spinner-msg">Cargando…</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && items.length === 0 && (
          <>
            <p className="text-muted">Todavía no agregaste ningún curso al carrito.</p>
            <Link to="/tienda" className="btn btn-outline">Ir a la tienda</Link>
          </>
        )}

        {items.length > 0 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {items.map((item) => (
                <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' }}>
                  <div>
                    <strong>{item.titulo}</strong>
                    <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>{formatPrecio(item.precio)}</p>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => quitar(item.id)}>Quitar</button>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '1.2rem', marginTop: 20 }}><strong>Total: {formatPrecio(total)}</strong></p>

            {user ? (
              <>
                {metodos.length > 0 ? (
                  <MetodoPagoSelector metodos={metodos} onElegir={handleCheckout} disabled={comprando} />
                ) : (
                  <button className="btn btn-accent" onClick={() => handleCheckout()} disabled={comprando}>
                    {comprando ? 'Procesando pago…' : 'Finalizar compra'}
                  </button>
                )}
                {metodos.length === 0 && (
                  <p className="text-muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
                    * Pago simulado: por ahora no se realiza ningún cobro real.
                  </p>
                )}
              </>
            ) : (
              <>
                <button className="btn btn-accent" onClick={() => navigate('/ingresar', { state: { from: { pathname: '/carrito' } } })}>
                  Ingresá para finalizar la compra
                </button>
                <p className="text-muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
                  Tu carrito se guarda y pasa a tu cuenta apenas inicies sesión.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
