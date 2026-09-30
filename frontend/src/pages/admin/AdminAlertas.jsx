import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Formulario de envío: elegir uno o varios alumnos/profesores (con
// búsqueda y los dos atajos "todos los alumnos"/"todos los profesores",
// para no tener que tildar de a uno cuando el aviso es masivo) más el
// mensaje de texto libre.
function FormEnviar({ usuarios, onEnviada }) {
  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(q));
  }, [usuarios, busqueda]);

  function toggle(id) {
    setSeleccionados((sel) => (sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]));
  }

  function seleccionarTodosDe(rol) {
    const ids = usuarios.filter((u) => u.rol === rol).map((u) => u.id);
    setSeleccionados((sel) => Array.from(new Set([...sel, ...ids])));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/admin/alertas', { userIds: seleccionados, mensaje: mensaje.trim() });
      setSeleccionados([]);
      setMensaje('');
      onEnviada();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card">
      <h3>Nueva alerta</h3>
      <p className="text-muted" style={{ fontSize: '0.9rem' }}>
        Le va a aparecer como pop-up la primera vez que entre a la app, y después va a quedar disponible en su
        pestaña "Alertas" para volver a leerla.
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Mensaje</label>
          <textarea rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} required />
        </div>

        <div className="field">
          <label>Destinatarios ({seleccionados.length} elegido{seleccionados.length === 1 ? '' : 's'})</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input placeholder="Buscar por nombre o email…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => seleccionarTodosDe('alumno')}>+ Todos los alumnos</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => seleccionarTodosDe('profesor')}>+ Todos los profesores</button>
            {seleccionados.length > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSeleccionados([])}>Vaciar selección</button>
            )}
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, padding: 8 }}>
            {filtrados.map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={seleccionados.includes(u.id)} onChange={() => toggle(u.id)} />
                {u.nombre} {u.apellido} <span className="text-muted">({u.email}, {u.rol})</span>
              </label>
            ))}
            {filtrados.length === 0 && <p className="text-muted" style={{ margin: 4 }}>No hay alumnos ni profesores que coincidan.</p>}
          </div>
        </div>

        <button className="btn btn-primary" disabled={enviando || seleccionados.length === 0 || !mensaje.trim()}>
          {enviando ? 'Enviando…' : 'Enviar alerta'}
        </button>
      </form>
    </div>
  );
}

// "Alertas": mensajes de texto libre a uno o varios alumnos/profesores —
// ver README "Alertas" para el mecanismo completo del pop-up.
export default function AdminAlertas() {
  const [usuarios, setUsuarios] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensajeOk, setMensajeOk] = useState('');

  function cargar() {
    return Promise.all([
      api.get('/admin/users?rol=todos').then((d) => setUsuarios(d.users.filter((u) => ['alumno', 'profesor'].includes(u.rol)))),
      api.get('/admin/alertas').then((d) => setAlertas(d.alertas)),
    ]).catch((err) => setError(err.message));
  }

  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  function alEnviar() {
    setMensajeOk('Alerta enviada.');
    setTimeout(() => setMensajeOk(''), 4000);
    cargar();
  }

  return (
    <div>
      <h1>Alertas</h1>
      <p className="text-muted">
        Mandale un mensaje de texto libre a uno o varios alumnos/profesores — le aparece como pop-up al entrar
        (una sola vez) y queda disponible en su propia pestaña "Alertas" para volver a leerlo.
      </p>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
      {mensajeOk && <div className="alert alert-success" style={{ marginTop: 16 }}>{mensajeOk}</div>}

      {loading ? (
        <div className="spinner-msg">Cargando…</div>
      ) : (
        <>
          <div style={{ marginTop: 16 }}>
            <FormEnviar usuarios={usuarios} onEnviada={alEnviar} />
          </div>

          <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
            <h3>Historial</h3>
            <table>
              <thead>
                <tr>
                  <th>Mensaje</th>
                  <th>Destinatario</th>
                  <th>Enviada</th>
                  <th>Vista</th>
                  <th>Recibido</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => (
                  <tr key={a.id}>
                    <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{a.mensaje}</td>
                    <td>{a.nombre} {a.apellido} <span className="text-muted">({a.email})</span></td>
                    <td className="text-muted">{formatearFecha(a.created_at)}</td>
                    <td>
                      <span className={`badge ${a.mostrado_en ? 'badge-success' : 'badge-warning'}`}>
                        {a.mostrado_en ? `Sí, ${formatearFecha(a.mostrado_en)}` : 'Todavía no'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${a.recibido_en ? 'badge-success' : 'badge-warning'}`}>
                        {a.recibido_en ? `Sí, ${formatearFecha(a.recibido_en)}` : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
                {alertas.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">Todavía no se mandó ninguna alerta.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
