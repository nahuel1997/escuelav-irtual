import { useEffect, useState } from 'react';
import { api, API_URL } from '../../api/client';

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Banner con la contraseña en texto plano recién generada (al crear un
// acceso o al regenerarla) — es la ÚNICA vez que se puede ver: queda
// hasheada en la base, no hay forma de recuperarla después (mismo
// criterio que un token de GitHub/Stripe). Por eso el foco fuerte en
// copiarla ahora.
function BannerPassword({ username, password, onCerrar }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (_e) {
      // Sin permiso de portapapeles: el input queda igual seleccionable a mano.
    }
  }

  return (
    <div className="alert alert-success" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong>Contraseña de "{username}" — copiala ahora, no se vuelve a mostrar:</strong>
      <div style={{ display: 'flex', gap: 8 }}>
        <input readOnly value={password} onFocus={(e) => e.target.select()} style={{ flex: 1, fontFamily: 'monospace' }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar'}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

// Gestión de permisos de UN cliente: elegir tabla del catálogo, tildar
// columnas, guardar. También lista lo que ya tiene otorgado, con "Quitar"
// por tabla.
function PermisosCliente({ client, catalogo, onCambio }) {
  const [tablaElegida, setTablaElegida] = useState('');
  const [columnasElegidas, setColumnasElegidas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const tablaInfo = catalogo.find((t) => t.tabla === tablaElegida);

  function toggleColumna(col) {
    setColumnasElegidas((cs) => (cs.includes(col) ? cs.filter((c) => c !== col) : [...cs, col]));
  }

  async function guardar() {
    if (!tablaElegida || columnasElegidas.length === 0) return;
    setGuardando(true);
    setError('');
    try {
      await api.put(`/admin/api-clients/${client.id}/permisos/${tablaElegida}`, { columnas: columnasElegidas });
      setTablaElegida('');
      setColumnasElegidas([]);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(tabla) {
    await api.delete(`/admin/api-clients/${client.id}/permisos/${tabla}`);
    onCambio();
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--color-border)' }}>
      <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0 0 8px' }}>Tablas habilitadas</p>
      {client.permisos.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Todavía no tiene acceso a ninguna tabla.</p>}
      {client.permisos.map((p) => (
        <div key={p.tabla} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.85rem' }}>
          <code style={{ fontWeight: 600 }}>{p.tabla}</code>
          <span className="text-muted">({p.columnas.join(', ')})</span>
          <button className="btn btn-outline btn-sm" onClick={() => quitar(p.tabla)}>Quitar</button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
          <label>Agregar tabla</label>
          <select value={tablaElegida} onChange={(e) => { setTablaElegida(e.target.value); setColumnasElegidas([]); }}>
            <option value="">Elegir tabla…</option>
            {catalogo.map((t) => <option key={t.tabla} value={t.tabla}>{t.tabla}</option>)}
          </select>
        </div>
      </div>

      {tablaInfo && (
        <div style={{ marginTop: 8 }}>
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 6px' }}>Columnas a exponer:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {tablaInfo.columnas.map((col) => (
              <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={columnasElegidas.includes(col)} onChange={() => toggleColumna(col)} />
                {col}
              </label>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={guardando || columnasElegidas.length === 0} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Dar acceso'}
          </button>
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function TabAccesos({ clients, catalogo, recargar }) {
  const [username, setUsername] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [passwordNueva, setPasswordNueva] = useState(null); // { username, password }
  const [expandidoId, setExpandidoId] = useState(null);

  async function handleCrear(e) {
    e.preventDefault();
    setCreando(true);
    setError('');
    try {
      const { client, password } = await api.post('/admin/api-clients', { username, descripcion });
      setPasswordNueva({ username: client.username, password });
      setUsername('');
      setDescripcion('');
      await recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function regenerar(client) {
    const { password } = await api.post(`/admin/api-clients/${client.id}/regenerar`, {});
    setPasswordNueva({ username: client.username, password });
  }

  async function toggleActivo(client) {
    await api.put(`/admin/api-clients/${client.id}/activo`, { activo: !client.activo });
    recargar();
  }

  async function eliminar(client) {
    if (!window.confirm(`¿Borrar el acceso "${client.username}"? Se pierden sus permisos y su registro de uso — esta acción no se puede deshacer.`)) return;
    await api.delete(`/admin/api-clients/${client.id}`);
    if (expandidoId === client.id) setExpandidoId(null);
    recargar();
  }

  return (
    <div>
      {passwordNueva && (
        <div style={{ marginBottom: 16 }}>
          <BannerPassword username={passwordNueva.username} password={passwordNueva.password} onCerrar={() => setPasswordNueva(null)} />
        </div>
      )}

      <div className="card">
        <h3>Nuevo acceso</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleCrear} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <label>Usuario</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 240, flex: 1 }}>
            <label>Para qué es (opcional)</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: integración con el CRM" />
          </div>
          <button className="btn btn-primary" disabled={creando}>{creando ? 'Creando…' : 'Crear acceso'}</button>
        </form>
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {clients.map((c) => (
          <div key={c.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong>{c.username}</strong>
              <span className={`badge ${c.activo ? 'badge-success' : 'badge-danger'}`}>{c.activo ? 'Activo' : 'Desactivado'}</span>
              {c.descripcion && <span className="text-muted" style={{ fontSize: '0.85rem' }}>{c.descripcion}</span>}
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>{c.permisos.length} tabla(s) habilitada(s)</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setExpandidoId(expandidoId === c.id ? null : c.id)}>
                  {expandidoId === c.id ? 'Ocultar permisos' : 'Gestionar permisos'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => regenerar(c)}>Regenerar contraseña</button>
                <button className={`btn btn-sm ${c.activo ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggleActivo(c)}>
                  {c.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => eliminar(c)}>Borrar</button>
              </div>
            </div>
            {expandidoId === c.id && <PermisosCliente client={c} catalogo={catalogo} onCambio={recargar} />}
          </div>
        ))}
        {clients.length === 0 && <p className="text-muted">Todavía no creaste ningún acceso.</p>}
      </div>
    </div>
  );
}

function TabDetalleYUso({ clients }) {
  const [clientId, setClientId] = useState('');
  const [uso, setUso] = useState([]);
  const [loading, setLoading] = useState(false);

  const client = clients.find((c) => String(c.id) === String(clientId));

  useEffect(() => {
    if (!clientId) { setUso([]); return; }
    setLoading(true);
    api.get(`/admin/api-clients/${clientId}/uso`).then((d) => setUso(d.uso)).finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label>Usuario de API</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Elegir…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.username}</option>)}
        </select>
      </div>

      {client && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Cómo conectarse</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Autenticación: HTTP Basic Auth, con el usuario <code>{client.username}</code> y la contraseña que se le dio al
              crear (o regenerar) el acceso — acá no se puede volver a mostrar, si se perdió hay que regenerarla desde
              "Accesos".
            </p>
            {client.permisos.length === 0 ? (
              <p className="text-muted">Todavía no tiene acceso a ninguna tabla — asignale una desde "Accesos".</p>
            ) : (
              client.permisos.map((p) => (
                <div key={p.tabla} style={{ marginBottom: 12 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.9rem' }}>{p.tabla}</p>
                  <p className="text-muted" style={{ margin: '0 0 4px', fontSize: '0.85rem' }}>Columnas: {p.columnas.join(', ')}</p>
                  <pre style={{ background: 'var(--color-bg-alt)', padding: 10, borderRadius: 8, fontSize: '0.8rem', overflowX: 'auto', margin: 0 }}>
{`curl -u ${client.username}:<CONTRASEÑA> "${API_URL}/data/${p.tabla}?limit=50&offset=0"`}
                  </pre>
                </div>
              ))
            )}
          </div>

          <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
            <h3>Registro de uso</h3>
            {loading ? (
              <p className="text-muted">Cargando…</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Cuándo</th><th>Tabla</th><th>IP</th><th>Duración</th><th>Filas</th></tr>
                </thead>
                <tbody>
                  {uso.map((u) => (
                    <tr key={u.id}>
                      <td>{formatearFecha(u.creado_at)}</td>
                      <td><code>{u.tabla}</code></td>
                      <td className="text-muted">{u.ip || '—'}</td>
                      <td>{u.duracion_ms != null ? `${u.duracion_ms} ms` : '—'}</td>
                      <td>{u.filas_devueltas ?? '—'}</td>
                    </tr>
                  ))}
                  {uso.length === 0 && <tr><td colSpan={5} className="text-muted">Todavía no se usó este acceso.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// "APIs": accesos de solo lectura para sistemas externos, a tablas y
// columnas puntuales que elige el admin (nunca la tabla entera por
// defecto). Ver README para el detalle completo del diseño y sus
// trade-offs (por qué Basic Auth, por qué se bloquean ciertas columnas
// siempre, etc.).
export default function AdminApis() {
  const [tab, setTab] = useState('accesos');
  const [clients, setClients] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function cargar() {
    return Promise.all([
      api.get('/admin/api-clients').then((d) => setClients(d.clients)),
      api.get('/admin/api-clients/catalogo').then((d) => setCatalogo(d.catalogo)),
    ]).catch((err) => setError(err.message));
  }

  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  return (
    <div>
      <h1>APIs</h1>
      <p className="text-muted">
        Accesos de solo lectura para que sistemas externos consulten datos de la plataforma, tabla por tabla y columna
        por columna — nunca se expone nada que el admin no haya habilitado explícitamente, y algunas columnas
        (contraseñas, hashes, tokens) quedan bloqueadas siempre, sin excepción.
      </p>

      <div style={{ display: 'flex', gap: 6, marginTop: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
        <button className={`btn btn-sm ${tab === 'accesos' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('accesos')}>Accesos</button>
        <button className={`btn btn-sm ${tab === 'detalle' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('detalle')}>Detalle y uso</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <div className="spinner-msg">Cargando…</div>
        ) : tab === 'accesos' ? (
          <TabAccesos clients={clients} catalogo={catalogo} recargar={cargar} />
        ) : (
          <TabDetalleYUso clients={clients} />
        )}
      </div>
    </div>
  );
}
