import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

function formatearFecha(iso) {
  return formatFecha(iso, { second: '2-digit' });
}

// Registro de errores reales del sistema (5xx), capturados automáticamente
// por el errorHandler central — ver backend/src/middlewares/error.middleware.js.
// A propósito no incluye errores 4xx (permisos, validaciones de negocio):
// esos pasan todo el tiempo en el uso normal y no son "errores de la app".
// Paginado de a 20 (backend/src/models/errorLog.model.js), para no traer
// una tabla larguísima entera si hubo un problema real seguido.
export default function AdminErrors() {
  const [errores, setErrores] = useState([]);
  const [filtro, setFiltro] = useState({ desde: '', hasta: '' });
  const [pagina, setPagina] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limpiando, setLimpiando] = useState(false);
  const [error, setError] = useState('');

  function cargar(f, p) {
    setLoading(true);
    const params = new URLSearchParams();
    if (f.desde) params.set('desde', f.desde);
    if (f.hasta) params.set('hasta', f.hasta);
    params.set('page', p);
    return api
      .get(`/admin/errores?${params.toString()}`)
      .then((d) => {
        setErrores(d.errores);
        setTotal(d.total);
        setTotalPages(d.totalPages);
        setPagina(d.page);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(filtro, 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltrar(e) {
    e.preventDefault();
    cargar(filtro, 1);
  }

  function irAPagina(p) {
    if (p < 1 || p > totalPages || p === pagina) return;
    cargar(filtro, p);
  }

  async function limpiar() {
    if (!window.confirm('¿Borrar todos los errores registrados? Esta acción no se puede deshacer.')) return;
    setLimpiando(true);
    setError('');
    try {
      await api.delete('/admin/errores');
      await cargar(filtro, 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLimpiando(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Errores</h1>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Fallas reales de la aplicación (errores 5xx), capturadas automáticamente.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={limpiar} disabled={limpiando || total === 0} style={{ color: 'var(--color-danger)' }}>
          {limpiando ? 'Borrando…' : 'Limpiar registro'}
        </button>
      </div>

      <form onSubmit={handleFiltrar} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Desde</label>
          <input type="date" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Hasta</label>
          <input type="date" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} />
        </div>
        <button className="btn btn-primary btn-sm">Filtrar</button>
      </form>

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
                  <th>Status</th>
                  <th>Mensaje</th>
                  <th>Ruta</th>
                  <th>Método</th>
                </tr>
              </thead>
              <tbody>
                {errores.map((e) => (
                  <tr key={e.id}>
                    <td>{formatearFecha(e.created_at)}</td>
                    <td><span className="badge badge-danger">{e.status}</span></td>
                    <td>{e.mensaje}</td>
                    <td>{e.ruta || '—'}</td>
                    <td>{e.metodo || '—'}</td>
                  </tr>
                ))}
                {errores.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">Sin errores registrados en el rango elegido.</td></tr>
                )}
              </tbody>
            </table>

            {total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>{total} error{total === 1 ? '' : 'es'} en total — página {pagina} de {totalPages}</span>
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
