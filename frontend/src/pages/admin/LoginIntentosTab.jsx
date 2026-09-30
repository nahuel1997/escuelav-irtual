import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha as formatearFecha } from '../../utils/fecha';

const RESULTADOS = {
  exitoso: { label: 'Exitoso', clase: 'badge-success' },
  fallido: { label: 'Contraseña incorrecta', clase: 'badge-warning' },
  espera: { label: 'En espera (fuerza bruta)', clase: 'badge-warning' },
  bloqueo_ip: { label: 'IP bloqueada ahora', clase: 'badge-danger' },
  ip_bloqueada: { label: 'Desde IP bloqueada', clase: 'badge-danger' },
  inactivo: { label: 'Cuenta desactivada', clase: 'badge-danger' },
  bloqueado: { label: 'Cuenta bloqueada', clase: 'badge-danger' },
};

// "Intentos de ingreso": todos los logins, también los fallidos — para ver
// quién está probando contraseñas y desde dónde (el "Historial de logueo"
// de DBA24). Las sesiones abiertas siguen en la otra pestaña.
export default function LoginIntentosTab() {
  const [filtro, setFiltro] = useState({ resultado: '', q: '', desde: '', hasta: '' });
  const [data, setData] = useState({ eventos: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function cargar(f, page = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    return api.get(`/admin/login-intentos?${params.toString()}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(filtro); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); cargar(filtro); }}
        className="card"
        style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
          <label>Resultado</label>
          <select value={filtro.resultado} onChange={(e) => setFiltro({ ...filtro, resultado: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220, flex: 1 }}>
          <label>Email o IP</label>
          <input value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} placeholder="Buscar…" />
        </div>
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
            <p className="text-muted" style={{ marginTop: 0 }}>{data.total} intento{data.total === 1 ? '' : 's'}</p>
            <table>
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Email intentado</th>
                  <th>Cuenta</th>
                  <th>Resultado</th>
                  <th>Detalle</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.eventos.map((e) => {
                  const r = RESULTADOS[e.resultado] || { label: e.resultado, clase: '' };
                  return (
                    <tr key={e.id}>
                      <td>{formatearFecha(e.created_at)}</td>
                      <td>{e.email || '—'}</td>
                      <td>{e.nombre ? `${e.nombre} ${e.apellido} (${e.rol})` : <span className="text-muted">Sin cuenta</span>}</td>
                      <td><span className={`badge ${r.clase}`}>{r.label}</span></td>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}>{e.detalle || '—'}</td>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}><code>{e.ip || '—'}</code></td>
                    </tr>
                  );
                })}
                {data.eventos.length === 0 && (
                  <tr><td colSpan={6} className="text-muted">No hay intentos que coincidan con el filtro.</td></tr>
                )}
              </tbody>
            </table>
            {data.totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                <button className="btn btn-outline btn-sm" disabled={data.page <= 1} onClick={() => cargar(filtro, data.page - 1)}>← Anterior</button>
                <span className="text-muted">Página {data.page} de {data.totalPages}</span>
                <button className="btn btn-outline btn-sm" disabled={data.page >= data.totalPages} onClick={() => cargar(filtro, data.page + 1)}>Siguiente →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
