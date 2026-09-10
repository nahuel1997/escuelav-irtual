import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

function formatPrecio(precio, moneda) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda || 'ARS', maximumFractionDigits: 2 }).format(precio);
}

const BADGE_ESTADO = {
  pendiente: 'badge-warning',
  aprobado: 'badge-success',
  rechazado: 'badge-danger',
  cancelado: 'badge-danger',
};

const NOMBRE_PROVIDER = { mercadopago: 'Mercado Pago', paypal: 'PayPal' };

// Órdenes de pago real (Mercado Pago/PayPal) — solo lectura, más la tasa
// de cambio manual USD que usa PayPal (nuestros precios están en ARS, ver
// backend/src/services/payments.service.js::convertirATotalUsd). El pago
// simulado de siempre NO genera fila acá — solo pasa por acá un pago con
// una pasarela real de verdad (ver checkout.service.js).
export default function AdminPagos() {
  const [ordenes, setOrdenes] = useState([]);
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tasa, setTasa] = useState('');
  const [tasaGuardada, setTasaGuardada] = useState('');
  const [guardandoTasa, setGuardandoTasa] = useState(false);
  const [tasaError, setTasaError] = useState('');
  const [tasaOk, setTasaOk] = useState(false);

  function cargar(f, p) {
    setLoading(true);
    const params = new URLSearchParams();
    if (f) params.set('estado', f);
    params.set('page', p);
    return api
      .get(`/admin/pagos?${params.toString()}`)
      .then((d) => {
        setOrdenes(d.ordenes);
        setTotal(d.total);
        setTotalPages(d.totalPages);
        setPagina(d.page);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar('', 1);
    api.get('/admin/pagos/tasa-cambio').then((d) => { setTasa(d.tasa); setTasaGuardada(d.tasa); });
  }, []);

  function handleFiltrar(nuevoEstado) {
    setEstado(nuevoEstado);
    cargar(nuevoEstado, 1);
  }

  function irAPagina(p) {
    if (p < 1 || p > totalPages || p === pagina) return;
    cargar(estado, p);
  }

  async function guardarTasa(e) {
    e.preventDefault();
    setGuardandoTasa(true);
    setTasaError('');
    setTasaOk(false);
    try {
      const res = await api.put('/admin/pagos/tasa-cambio', { valor: tasa });
      setTasaGuardada(res.tasa);
      setTasaOk(true);
    } catch (err) {
      setTasaError(err.message);
    } finally {
      setGuardandoTasa(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: 0 }}>Pagos</h1>
      <p className="text-muted" style={{ margin: '4px 0 0' }}>
        Órdenes de pago real (Mercado Pago/PayPal). El pago simulado no genera órdenes acá.
      </p>

      <div className="card" style={{ marginTop: 16, maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>Tasa de cambio USD (PayPal)</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: -8 }}>
          PayPal cobra en dólares — nuestros precios están en ARS. Cuántos pesos vale 1 dólar, para convertir el total de cada orden.
        </p>
        <form onSubmit={guardarTasa} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>1 USD = ? ARS</label>
            <input type="number" min="0.01" step="0.01" value={tasa} onChange={(e) => setTasa(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-sm" disabled={guardandoTasa || tasa === tasaGuardada}>
            {guardandoTasa ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
        {tasaError && <div className="alert alert-error" style={{ marginTop: 12 }}>{tasaError}</div>}
        {tasaOk && !tasaError && <div className="alert alert-success" style={{ marginTop: 12 }}>Tasa actualizada: 1 USD = {tasaGuardada} ARS.</div>}
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Estado</label>
          <select value={estado} onChange={(e) => handleFiltrar(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        {loading ? (
          <p className="text-muted">Cargando…</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Alumno</th>
                  <th>Pasarela</th>
                  <th>Cursos</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id}>
                    <td>{formatFecha(o.created_at)}</td>
                    <td>{o.nombre} {o.apellido}<br /><span className="text-muted" style={{ fontSize: '0.8rem' }}>{o.email}</span></td>
                    <td>{NOMBRE_PROVIDER[o.provider] || o.provider}</td>
                    <td>{o.items.map((i) => i.titulo).join(', ')}</td>
                    <td>{formatPrecio(o.total, o.moneda)}</td>
                    <td><span className={`badge ${BADGE_ESTADO[o.status] || ''}`}>{o.status}</span></td>
                  </tr>
                ))}
                {ordenes.length === 0 && (
                  <tr><td colSpan={6} className="text-muted">Sin órdenes de pago registradas todavía.</td></tr>
                )}
              </tbody>
            </table>

            {total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>{total} orden{total === 1 ? '' : 'es'} en total — página {pagina} de {totalPages}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" disabled={pagina <= 1} onClick={() => irAPagina(pagina - 1)}>← Anterior</button>
                  <button className="btn btn-outline btn-sm" disabled={pagina >= totalPages} onClick={() => irAPagina(pagina + 1)}>Siguiente →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
