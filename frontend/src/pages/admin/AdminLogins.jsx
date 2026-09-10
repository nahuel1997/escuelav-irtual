import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { formatFecha as formatearFecha } from '../../utils/fecha';

function formatearDuracion(inicio, fin) {
  if (!fin) return null;
  const minutos = Math.round((new Date(fin) - new Date(inicio)) / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${horas} h ${resto} min`;
}

function formatearUbicacion(l) {
  if (l.pais === 'Red local') return 'Red local (desarrollo)';
  if (!l.pais && !l.provincia) return l.ip ? 'Sin resolver' : '—';
  return [l.provincia, l.pais].filter(Boolean).join(', ');
}

// Historial de sesiones de cada usuario: de dónde y cuándo se conectó
// (ip + país/provincia, resueltos por geolocalización — ver
// geo.service.js del backend, mejor esfuerzo: puede no resolver si la IP
// es local/privada o si el servicio externo no responde), y permite al
// admin forzar el cierre de cualquier sesión que siga abierta.
//
// "Fin" distingue tres estados: el usuario cerró sesión él mismo
// (logout_at), el admin la forzó desde acá (revoked_at) o sigue abierta.
// Si alguien cierra la pestaña sin desloguearse sin que el admin la cierre
// a mano, queda "Sesión activa" hasta que el token expire solo — es una
// limitación honesta de JWT, no un bug (ver auth.middleware.js).
export default function AdminLogins() {
  const [searchParams] = useSearchParams();
  const [usuarios, setUsuarios] = useState([]);
  const [logins, setLogins] = useState([]);
  const [filtro, setFiltro] = useState({ userId: searchParams.get('userId') || '', desde: '', hasta: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cerrando, setCerrando] = useState(null);

  useEffect(() => {
    api.get('/admin/users?rol=todos').then((d) => setUsuarios(d.users));
    cargar(filtro);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function cargar(f) {
    setLoading(true);
    const params = new URLSearchParams();
    if (f.userId) params.set('userId', f.userId);
    if (f.desde) params.set('desde', f.desde);
    if (f.hasta) params.set('hasta', f.hasta);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api
      .get(`/admin/logins${query}`)
      .then((d) => setLogins(d.logins))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function handleFiltrar(e) {
    e.preventDefault();
    cargar(filtro);
  }

  async function cerrarSesion(id) {
    setCerrando(id);
    setError('');
    try {
      const { sesion } = await api.post(`/admin/logins/${id}/cerrar`, {});
      setLogins((lista) => lista.map((l) => (l.id === id ? { ...l, revoked_at: sesion.revoked_at } : l)));
    } catch (err) {
      setError(err.message);
    } finally {
      setCerrando(null);
    }
  }

  return (
    <div>
      <h1>Sesiones</h1>
      <p className="text-muted">Historial de conexiones de cada usuario, de dónde se conectaron y cuáles siguen activas.</p>

      <form onSubmit={handleFiltrar} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Usuario</label>
          <select value={filtro.userId} onChange={(e) => setFiltro({ ...filtro, userId: e.target.value })}>
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} {u.apellido} ({u.rol})</option>
            ))}
          </select>
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
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Duración</th>
                <th>IP</th>
                <th>Ubicación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((l) => {
                const duracion = formatearDuracion(l.login_at, l.logout_at || l.revoked_at);
                const activa = !l.logout_at && !l.revoked_at;
                return (
                  <tr key={l.id}>
                    <td>{l.nombre} {l.apellido} <span className="text-muted">({l.email})</span></td>
                    <td><span className="badge">{l.rol}</span></td>
                    <td>{formatearFecha(l.login_at)}</td>
                    <td>
                      {activa ? (
                        <span className="badge badge-success">Sesión activa</span>
                      ) : l.revoked_at ? (
                        <span title={formatearFecha(l.revoked_at)} className="badge badge-warning">Cerrada por el admin</span>
                      ) : (
                        formatearFecha(l.logout_at)
                      )}
                    </td>
                    <td>{duracion || '—'}</td>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>{l.ip || '—'}</td>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>{formatearUbicacion(l)}</td>
                    <td>
                      {activa && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={cerrando === l.id}
                          onClick={() => cerrarSesion(l.id)}
                        >
                          {cerrando === l.id ? 'Cerrando…' : 'Cerrar sesión'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {logins.length === 0 && (
                <tr><td colSpan={8} className="text-muted">No hay conexiones que coincidan con el filtro.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
