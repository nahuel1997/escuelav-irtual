import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

const NOMBRE_PROVIDER = { mercadopago: 'Mercado Pago', paypal: 'PayPal' };

const BADGE_ESTADO = {
  pendiente: 'badge-warning',
  aprobado: 'badge-success',
  rechazado: 'badge-danger',
  cancelado: 'badge-danger',
};

function formatPrecio(precio, moneda) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda || 'ARS', maximumFractionDigits: 2 }).format(precio);
}

// "Test Pagos" — probar Mercado Pago/PayPal de punta a punta (crear la
// orden, ir a pagar de verdad a la pasarela, confirmar) como si fuera una
// compra manual, pero con un precio libre que pone el admin en vez de
// salir de un curso real. Usa las MISMAS rutas/credenciales que un pago
// real (backend/src/services/payments.service.js) — por eso, mientras
// backend/.env tenga cargadas credenciales de PRUEBA/sandbox de cada
// pasarela (la convención de este proyecto, ver README), acá no se cobra
// nada real. La orden queda marcada como "de prueba" del lado del backend
// así que, aunque el pago se confirme de verdad, no inscribe a nadie en
// ningún curso, no otorga logros ni manda el mail de confirmación de
// compra (ver testing.controller.js / checkout.service.js).
export default function AdminTestPagos() {
  const [metodos, setMetodos] = useState(null); // null = todavía no cargó
  const [titulo, setTitulo] = useState('Prueba manual desde el admin');
  const [precio, setPrecio] = useState('100');
  const [metodoElegido, setMetodoElegido] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const [ordenActual, setOrdenActual] = useState(null); // { id, status, provider, total, moneda, redirectUrl }
  const pollingRef = useRef(null);

  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  function cargarHistorial() {
    setCargandoHistorial(true);
    api.get('/admin/testing/pagos/ordenes')
      .then((d) => setHistorial(d.ordenes))
      .catch(() => {}) // no es crítico para poder seguir usando la herramienta
      .finally(() => setCargandoHistorial(false));
  }

  useEffect(() => {
    api.get('/admin/testing/pagos/metodos')
      .then((d) => {
        setMetodos(d.metodos);
        if (d.metodos.length > 0) setMetodoElegido(d.metodos[0]);
      })
      .catch((err) => setError(err.message));
    cargarHistorial();
    return () => clearInterval(pollingRef.current);
  }, []);

  function detenerPolling() {
    clearInterval(pollingRef.current);
    pollingRef.current = null;
  }

  function empezarPolling(ordenId) {
    detenerPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const { orden } = await api.get(`/payments/ordenes/${ordenId}`);
        setOrdenActual((prev) => (prev ? { ...prev, status: orden.status, total: orden.total } : prev));
        if (orden.status !== 'pendiente') {
          detenerPolling();
          cargarHistorial();
        }
      } catch {
        // si falla una consulta puntual no cortamos el polling, reintenta sola
      }
    }, 3000);
  }

  async function iniciar(e) {
    e.preventDefault();
    setError('');
    const numero = Number(precio);
    if (!titulo.trim()) { setError('Poné un título para identificar esta prueba.'); return; }
    if (!precio || Number.isNaN(numero) || numero <= 0) { setError('El precio tiene que ser un número mayor a 0.'); return; }
    if (!metodoElegido) { setError('Elegí un método de pago.'); return; }

    setCreando(true);
    detenerPolling();
    try {
      const { ordenId, redirectUrl } = await api.post('/admin/testing/pagos/orden', {
        titulo: titulo.trim(),
        precio: numero,
        metodo_pago: metodoElegido,
      });
      setOrdenActual({ id: ordenId, status: 'pendiente', provider: metodoElegido, total: numero, moneda: 'ARS', redirectUrl });
      window.open(redirectUrl, '_blank', 'noopener');
      empezarPolling(ordenId);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: 0 }}>Test Pagos</h1>
      <p className="text-muted" style={{ margin: '4px 0 0' }}>
        Probá Mercado Pago y PayPal de punta a punta como si fuera una compra manual: elegís el
        método, ponés cualquier precio, y hacés el pago real en la pasarela. No inscribe en ningún
        curso ni manda el mail de confirmación de compra — solo sirve para verificar que la
        integración (credenciales, checkout, confirmación) funciona.
      </p>

      <div className="alert alert-warning" style={{ marginTop: 16, maxWidth: 640 }}>
        Esto usa las credenciales reales cargadas en <code>backend/.env</code>
        {' '}(<code>MP_ACCESS_TOKEN</code> / <code>PAYPAL_CLIENT_ID</code>). Por convención de este
        proyecto tienen que ser credenciales de <strong>PRUEBA/sandbox</strong> de cada pasarela —
        así no se cobra nada real. Si cargaste credenciales de producción, esto haría un cobro de
        verdad por el monto que pongas.
      </div>

      {metodos !== null && metodos.length === 0 && (
        <div className="alert alert-error" style={{ marginTop: 16, maxWidth: 640 }}>
          No hay ningún método de pago real configurado todavía. Cargá <code>MP_ACCESS_TOKEN</code> y/o
          {' '}<code>PAYPAL_CLIENT_ID</code>/<code>PAYPAL_CLIENT_SECRET</code> en <code>backend/.env</code> y
          reiniciá el servidor.
        </div>
      )}

      <div className="card" style={{ marginTop: 16, maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Nueva prueba</h3>
        <form onSubmit={iniciar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Título (para identificarla en el historial)</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Precio (ARS)</label>
            <input type="number" min="1" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Método de pago</label>
            <select value={metodoElegido} onChange={(e) => setMetodoElegido(e.target.value)} disabled={!metodos || metodos.length === 0}>
              {(metodos || []).map((m) => (
                <option key={m} value={m}>{NOMBRE_PROVIDER[m] || m}</option>
              ))}
              {(!metodos || metodos.length === 0) && <option value="">Sin métodos disponibles</option>}
            </select>
          </div>
          <button className="btn btn-primary" disabled={creando || !metodos || metodos.length === 0}>
            {creando ? 'Iniciando…' : 'Iniciar pago de prueba'}
          </button>
        </form>
        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {ordenActual && (
        <div className="card" style={{ marginTop: 16, maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>Orden de prueba #{ordenActual.id}</h3>
          <p style={{ margin: '0 0 10px' }}>
            {NOMBRE_PROVIDER[ordenActual.provider] || ordenActual.provider} — {formatPrecio(ordenActual.total, ordenActual.moneda)}{' '}
            <span className={`badge ${BADGE_ESTADO[ordenActual.status] || ''}`}>{ordenActual.status}</span>
          </p>
          {ordenActual.status === 'pendiente' ? (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Se abrió el checkout real en una pestaña nueva. Completá el pago ahí (podés cerrar esa
              pestaña al terminar) — el estado de acá arriba se actualiza solo apenas se confirma.
              {' '}
              <a href={ordenActual.redirectUrl} target="_blank" rel="noopener noreferrer">Volver a abrir el checkout ↗</a>
            </p>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              {ordenActual.status === 'aprobado'
                ? 'Pago confirmado de verdad contra la pasarela — la integración funciona. No se creó ninguna inscripción ni se mandó mail (es una orden de prueba).'
                : 'La pasarela no aprobó el pago (podés reintentar con otra tarjeta/cuenta de prueba de la pasarela).'}
            </p>
          )}
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Historial de pruebas</h3>
        {cargandoHistorial ? (
          <p className="text-muted">Cargando…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Título</th>
                <th>Pasarela</th>
                <th>Precio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((o) => (
                <tr key={o.id}>
                  <td>{formatFecha(o.created_at)}</td>
                  <td>{o.items?.[0]?.titulo || '—'}</td>
                  <td>{NOMBRE_PROVIDER[o.provider] || o.provider}</td>
                  <td>{formatPrecio(o.total, o.moneda)}</td>
                  <td><span className={`badge ${BADGE_ESTADO[o.status] || ''}`}>{o.status}</span></td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr><td colSpan={5} className="text-muted">Todavía no corriste ninguna prueba.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
