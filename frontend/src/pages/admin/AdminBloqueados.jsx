import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Formulario para bloquear una IP a mano (además de las que se bloquean
// solas por fuerza bruta — ver README "Seguridad de cuentas").
function FormBloquearIp({ onCreado }) {
  const [ip, setIp] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await api.post('/admin/ips-bloqueadas', { ip: ip.trim(), motivo: motivo.trim() });
      setIp('');
      setMotivo('');
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card">
      <h3>Bloquear una IP a mano</h3>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>IP</label>
          <input placeholder="Ej: 203.0.113.9" value={ip} onChange={(e) => setIp(e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 260, flex: 1 }}>
          <label>Motivo</label>
          <input placeholder="Ej: intentos sospechosos, pedido del cliente…" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Bloqueando…' : 'Bloquear IP'}</button>
      </form>
    </div>
  );
}

function TabIps({ ips, loading, recargar }) {
  async function desbloquear(item) {
    if (!window.confirm(`¿Desbloquear la IP "${item.ip}"? Va a poder volver a intentar loguearse normalmente.`)) return;
    await api.delete(`/admin/ips-bloqueadas/${item.id}`);
    recargar();
  }

  return (
    <div>
      <FormBloquearIp onCreado={recargar} />

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <h3>IPs bloqueadas</h3>
        {loading ? (
          <p className="text-muted">Cargando…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>IP</th>
                <th>Motivo</th>
                <th>Bloqueada por</th>
                <th>Cuándo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ips.map((i) => (
                <tr key={i.id}>
                  <td><code>{i.ip}</code></td>
                  <td>{i.motivo}</td>
                  <td className="text-muted">{i.bloqueado_por_nombre || 'Automático (fuerza bruta)'}</td>
                  <td className="text-muted">{formatearFecha(i.created_at)}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => desbloquear(i)}>Desbloquear</button>
                  </td>
                </tr>
              ))}
              {ips.length === 0 && (
                <tr><td colSpan={5} className="text-muted">No hay ninguna IP bloqueada ahora mismo.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TabUsuarios({ usuarios, loading }) {
  const bloqueados = usuarios.filter((u) => u.bloqueado);

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <h3>Cuentas bloqueadas</h3>
      <p className="text-muted" style={{ fontSize: '0.9rem' }}>
        Para bloquear o desbloquear una cuenta puntual, o para desactivarla (algo distinto de bloquearla — ver
        README), andá a "Usuarios". Acá es solo un vistazo rápido de quién está bloqueado ahora mismo.
      </p>
      {loading ? (
        <p className="text-muted">Cargando…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Motivo</th>
              <th>Cuándo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {bloqueados.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre} {u.apellido}</td>
                <td>{u.email}</td>
                <td>{u.bloqueado_motivo || '—'}</td>
                <td className="text-muted">{formatearFecha(u.bloqueado_en)}</td>
                <td>
                  <Link className="btn btn-outline btn-sm" to="/admin-panel/usuarios">Ir a Usuarios</Link>
                </td>
              </tr>
            ))}
            {bloqueados.length === 0 && (
              <tr><td colSpan={5} className="text-muted">No hay ninguna cuenta bloqueada ahora mismo.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

// "Bloqueados": vista centralizada de la parte de seguridad de cuentas que
// no vive en "Usuarios" — las IPs bloqueadas (a mano o solas, por el
// sistema de 3 tramos de fuerza bruta del login) y un vistazo rápido de
// qué cuentas están bloqueadas. Ver README "Seguridad de cuentas" para el
// mecanismo completo.
export default function AdminBloqueados() {
  const [tab, setTab] = useState('ips');
  const [ips, setIps] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function cargar() {
    return Promise.all([
      api.get('/admin/ips-bloqueadas').then((d) => setIps(d.ips)),
      api.get('/admin/users?rol=todos').then((d) => setUsuarios(d.users)),
    ]).catch((err) => setError(err.message));
  }

  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  return (
    <div>
      <h1>Bloqueados</h1>
      <p className="text-muted">
        Acá se ven las IPs bloqueadas (a mano o automáticamente, por demasiados intentos fallidos de login seguidos
        con la misma IP + email) y un resumen de las cuentas bloqueadas.
      </p>

      <div style={{ display: 'flex', gap: 6, marginTop: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
        <button className={`btn btn-sm ${tab === 'ips' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('ips')}>IPs bloqueadas</button>
        <button className={`btn btn-sm ${tab === 'usuarios' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('usuarios')}>Cuentas bloqueadas</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      <div style={{ marginTop: 20 }}>
        {tab === 'ips' ? (
          <TabIps ips={ips} loading={loading} recargar={cargar} />
        ) : (
          <TabUsuarios usuarios={usuarios} loading={loading} />
        )}
      </div>
    </div>
  );
}
