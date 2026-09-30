import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha as formatearFecha } from '../../utils/fecha';

// Pestaña "Bloqueos" de APIs: IPs o usuarios de API bloqueados, a mano o
// (solo IPs) automáticamente por fuerza bruta. El usuario de API nunca se
// bloquea solo: si no, cualquiera que sepa su nombre le cortaría la
// integración a un sistema legítimo.
export function TabBloqueosApi() {
  const [bloqueados, setBloqueados] = useState([]);
  const [form, setForm] = useState({ tipo: 'ip', valor: '', motivo: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api.get('/admin/api-clients/bloqueados').then((d) => setBloqueados(d.bloqueados)).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function bloquear(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await api.post('/admin/api-clients/bloqueados', form);
      setForm({ ...form, valor: '', motivo: '' });
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function desbloquear(b) {
    if (!window.confirm(`¿Desbloquear ${b.tipo === 'ip' ? 'la IP' : 'el usuario'} "${b.valor}"?`)) return;
    await api.delete(`/admin/api-clients/bloqueados/${b.id}`);
    cargar();
  }

  return (
    <div>
      <div className="card">
        <h3>Bloquear a mano</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={bloquear} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="ip">IP</option>
              <option value="usuario">Usuario de API</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
            <label>{form.tipo === 'ip' ? 'IP' : 'Usuario'}</label>
            <input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 240, flex: 1 }}>
            <label>Motivo</label>
            <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required />
          </div>
          <button className="btn btn-danger" disabled={guardando}>{guardando ? 'Bloqueando…' : 'Bloquear'}</button>
        </form>
      </div>

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <h3>Bloqueados ahora</h3>
        <table>
          <thead>
            <tr><th>Tipo</th><th>Valor</th><th>Motivo</th><th>Por</th><th>Cuándo</th><th></th></tr>
          </thead>
          <tbody>
            {bloqueados.map((b) => (
              <tr key={b.id}>
                <td><span className="badge">{b.tipo === 'ip' ? 'IP' : 'Usuario'}</span></td>
                <td><code>{b.valor}</code></td>
                <td>{b.motivo}</td>
                <td className="text-muted">{b.bloqueado_por_nombre || 'Automático (fuerza bruta)'}</td>
                <td className="text-muted">{formatearFecha(b.created_at)}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => desbloquear(b)}>Desbloquear</button></td>
              </tr>
            ))}
            {bloqueados.length === 0 && <tr><td colSpan={6} className="text-muted">No hay nada bloqueado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaError({ error, onGuardado }) {
  const [mensaje, setMensaje] = useState(error.mensaje);
  const [estado, setEstado] = useState('');

  async function guardar() {
    setEstado('guardando');
    try {
      await api.put(`/admin/api-clients/errores/${error.codigo}`, { mensaje });
      setEstado('ok');
      onGuardado();
      setTimeout(() => setEstado(''), 2000);
    } catch (err) {
      setEstado(err.message);
    }
  }

  return (
    <tr>
      <td><code>{error.codigo}</code><div className="text-muted" style={{ fontSize: '0.8rem' }}>{error.descripcion}</div></td>
      <td><span className="badge">{error.http_status}</span></td>
      <td style={{ minWidth: 320 }}>
        <textarea rows={2} value={mensaje} onChange={(e) => setMensaje(e.target.value)} style={{ width: '100%' }} />
        {estado && estado !== 'guardando' && estado !== 'ok' && <div className="alert alert-error" style={{ margin: '4px 0 0' }}>{estado}</div>}
      </td>
      <td>
        <button className="btn btn-primary btn-sm" disabled={estado === 'guardando' || mensaje === error.mensaje} onClick={guardar}>
          {estado === 'ok' ? 'Guardado ✓' : 'Guardar'}
        </button>
      </td>
    </tr>
  );
}

// Pestaña "Mensajes de error": el texto de cada error que devuelve la API
// a los sistemas externos. El código y el status HTTP no se tocan (los
// sistemas externos se guían por eso), solo el texto.
export function TabErroresApi() {
  const [errores, setErrores] = useState([]);
  const cargar = () => api.get('/admin/api-clients/errores').then((d) => setErrores(d.errores));
  useEffect(() => { cargar(); }, []);

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <h3>Mensajes de error de la API</h3>
      <p className="text-muted" style={{ fontSize: '0.9rem' }}>
        Cada respuesta de error lleva <code>{'{ error, codigo }'}</code>. En "Demasiados intentos", <code>{'{espera}'}</code> se
        reemplaza por el tiempo que falta.
      </p>
      <table>
        <thead><tr><th>Código</th><th>HTTP</th><th>Mensaje</th><th></th></tr></thead>
        <tbody>
          {errores.map((e) => <FilaError key={e.codigo} error={e} onGuardado={cargar} />)}
        </tbody>
      </table>
    </div>
  );
}
