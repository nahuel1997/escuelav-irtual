import { Fragment, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';
import ArchivoPrivado from '../../components/ArchivoPrivado';

function Paginador({ page, totalPages, onIr }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onIr(page - 1)}>← Anterior</button>
      <span className="text-muted">Página {page} de {totalPages}</span>
      <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => onIr(page + 1)}>Siguiente →</button>
    </div>
  );
}

function DetalleError({ id, onCerrar, onBorrado }) {
  const [e, setE] = useState(null);
  useEffect(() => { api.get(`/admin/errores/app/${id}`).then((d) => setE(d.error)); }, [id]);

  async function borrar() {
    if (!window.confirm('¿Borrar este error del registro? Si vuelve a pasar, aparece de nuevo.')) return;
    await api.delete(`/admin/errores/app/${id}`);
    onBorrado();
  }

  return (
    <div role="dialog" onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 900, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '5vh 16px', overflowY: 'auto' }}>
      <div className="card" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 900, width: '100%' }}>
        {!e ? 'Cargando…' : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ margin: 0, wordBreak: 'break-word' }}>{e.mensaje}</h2>
              <button className="btn btn-outline btn-sm" onClick={onCerrar}>Cerrar</button>
            </div>
            <table style={{ marginTop: 12 }}>
              <tbody>
                <tr><th>Origen</th><td>{e.origen === 'navegador' ? 'Navegador' : 'Servidor'}{e.contexto ? ` · ${e.contexto}` : ''}</td></tr>
                <tr><th>Veces</th><td>{e.veces}</td></tr>
                <tr><th>Primera vez</th><td>{formatFecha(e.primera_vez)}</td></tr>
                <tr><th>Última vez</th><td>{formatFecha(e.ultima_vez)}</td></tr>
                <tr><th>URL</th><td>{e.metodo} {e.url || '—'}</td></tr>
                <tr><th>Usuario (última vez)</th><td>{e.usuario_nombre ? `${e.usuario_nombre} (${e.rol})` : '—'}</td></tr>
                <tr><th>Navegador</th><td style={{ fontSize: '0.8rem' }}>{e.navegador || '—'}</td></tr>
                {e.detalle && <tr><th>Detalle</th><td><code style={{ whiteSpace: 'pre-wrap' }}>{typeof e.detalle === 'string' ? e.detalle : JSON.stringify(e.detalle, null, 2)}</code></td></tr>}
              </tbody>
            </table>
            {e.stack && <pre style={{ background: '#0f1720', color: '#d6e2ee', padding: 12, borderRadius: 8, overflowX: 'auto', fontSize: '0.78rem', marginTop: 12 }}>{e.stack}</pre>}
            <button className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)', marginTop: 8 }} onClick={borrar}>Borrar del registro</button>
          </>
        )}
      </div>
    </div>
  );
}

function TabApp() {
  const [filtro, setFiltro] = useState({ origen: '', q: '', desde: '', hasta: '' });
  const [data, setData] = useState({ errores: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(null);

  function cargar(f = filtro, page = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    return api.get(`/admin/errores/app?${params.toString()}`).then(setData).finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function limpiarTodo() {
    if (!window.confirm('¿Borrar TODO el registro de errores de la app? No se puede deshacer.')) return;
    await api.delete('/admin/errores/app');
    cargar();
  }

  return (
    <div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); cargar(filtro); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Origen</label>
          <select value={filtro.origen} onChange={(e) => setFiltro({ ...filtro, origen: e.target.value })}>
            <option value="">Todos</option>
            <option value="servidor">Servidor</option>
            <option value="navegador">Navegador</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <label>Buscar</label>
          <input value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} placeholder="Mensaje o URL" />
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
        <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)' }} onClick={limpiarTodo} disabled={!data.total}>Limpiar todo</button>
      </form>

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        {loading ? <p className="text-muted">Cargando…</p> : (
          <>
            <p className="text-muted" style={{ marginTop: 0 }}>{data.total} error{data.total === 1 ? '' : 'es'} distinto{data.total === 1 ? '' : 's'} (los repetidos se agrupan)</p>
            <table>
              <thead><tr><th>Última vez</th><th>Origen</th><th>Mensaje</th><th>Veces</th><th>URL</th><th>Usuario</th></tr></thead>
              <tbody>
                {data.errores.map((e) => (
                  <tr key={e.id} onClick={() => setAbierto(e.id)} style={{ cursor: 'pointer' }}>
                    <td className="text-muted">{formatFecha(e.ultima_vez)}</td>
                    <td><span className={`badge ${e.origen === 'navegador' ? 'badge-warning' : 'badge-danger'}`}>{e.origen}</span></td>
                    <td style={{ maxWidth: 380, wordBreak: 'break-word' }}>{e.mensaje}</td>
                    <td><strong>{e.veces}</strong></td>
                    <td className="text-muted" style={{ fontSize: '0.82rem' }}>{e.metodo} {e.url || '—'}</td>
                    <td className="text-muted" style={{ fontSize: '0.82rem' }}>{e.usuario_nombre ? `${e.usuario_nombre} (${e.rol})` : '—'}</td>
                  </tr>
                ))}
                {data.errores.length === 0 && <tr><td colSpan={6} className="text-muted">Sin errores registrados. 🎉</td></tr>}
              </tbody>
            </table>
            <Paginador page={data.page} totalPages={data.totalPages} onIr={(p) => cargar(filtro, p)} />
          </>
        )}
      </div>
      {abierto && <DetalleError id={abierto} onCerrar={() => setAbierto(null)} onBorrado={() => { setAbierto(null); cargar(); }} />}
    </div>
  );
}

function TabMails() {
  const [errores, setErrores] = useState(null);
  useEffect(() => { api.get('/admin/errores/mails').then((d) => setErrores(d.errores)); }, []);
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <p className="text-muted" style={{ marginTop: 0 }}>Envíos que fallaron (el registro completo de mails está en Mails → Registro).</p>
      {!errores ? 'Cargando…' : (
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Destinatario</th><th>Asunto</th><th>Error</th></tr></thead>
          <tbody>
            {errores.map((e) => (
              <tr key={e.id}>
                <td className="text-muted">{formatFecha(e.created_at)}</td>
                <td><span className="badge">{e.tipo}</span></td>
                <td>{e.destinatario}</td>
                <td>{e.asunto}</td>
                <td style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{e.error_detalle}</td>
              </tr>
            ))}
            {errores.length === 0 && <tr><td colSpan={5} className="text-muted">Ningún mail falló.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

const ESTADOS_REPORTE = {
  nuevo: { label: 'Nuevo', clase: 'badge-danger' },
  en_revision: { label: 'En revisión', clase: 'badge-warning' },
  resuelto: { label: 'Resuelto', clase: 'badge-success' },
  descartado: { label: 'Descartado', clase: '' },
};

function DetalleReporte({ id, onCambio }) {
  const [r, setR] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  useEffect(() => {
    api.get(`/admin/reportes-error/${id}`).then((d) => { setR(d.reporte); setRespuesta(d.reporte.respuesta || ''); });
  }, [id]);

  async function cambiar(estado) {
    const { reporte } = await api.put(`/admin/reportes-error/${id}/estado`, { estado, respuesta });
    setR(reporte);
    onCambio();
  }

  if (!r) return <tr><td colSpan={6}>Cargando…</td></tr>;
  return (
    <tr>
      <td colSpan={6} style={{ background: 'var(--color-bg-alt)' }}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{r.descripcion}</p>
        <p className="text-muted" style={{ fontSize: '0.82rem' }}>Pantalla: {r.pagina || '—'} · {r.navegador}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {r.adjuntos.map((a) => <ArchivoPrivado key={a.id} ruta={`/admin/reportes-error/adjuntos/${a.id}`} nombre={a.nombre_original} mime={a.mime} />)}
        </div>
        <div className="field">
          <label>Respuesta para el usuario (la ve en "Reportar error")</label>
          <textarea rows={2} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(ESTADOS_REPORTE).map(([k, v]) => (
            <button key={k} className={`btn btn-sm ${r.estado === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => cambiar(k)}>{v.label}</button>
          ))}
        </div>
      </td>
    </tr>
  );
}

function TabAlertados({ onCambio }) {
  const [estado, setEstado] = useState('');
  const [reportes, setReportes] = useState(null);
  const [abierto, setAbierto] = useState(null);

  const cargar = (e = estado) => api.get(`/admin/reportes-error${e ? `?estado=${e}` : ''}`).then((d) => setReportes(d.reportes));
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['', 'Todos'], ...Object.entries(ESTADOS_REPORTE).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button key={k} className={`btn btn-sm ${estado === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setEstado(k); cargar(k); }}>{label}</button>
        ))}
      </div>
      {!reportes ? 'Cargando…' : (
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Usuario</th><th>Título</th><th>Capturas</th><th>Estado</th></tr></thead>
          <tbody>
            {reportes.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => setAbierto(abierto === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
                  <td>{r.id}</td>
                  <td className="text-muted">{formatFecha(r.created_at)}</td>
                  <td>{r.nombre} {r.apellido} <span className="text-muted">({r.rol})</span></td>
                  <td>{r.titulo}</td>
                  <td>{Number(r.adjuntos) || '—'}</td>
                  <td><span className={`badge ${ESTADOS_REPORTE[r.estado]?.clase || ''}`}>{ESTADOS_REPORTE[r.estado]?.label || r.estado}</span></td>
                </tr>
                {abierto === r.id && <DetalleReporte id={r.id} onCambio={() => { cargar(); onCambio(); }} />}
              </Fragment>
            ))}
            {reportes.length === 0 && <tr><td colSpan={6} className="text-muted">No hay reportes.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Fallas 5xx (registro histórico, previo al registro agrupado).
function TabFallas() {
  const [data, setData] = useState({ errores: [], page: 1, totalPages: 1, total: 0 });
  const cargar = (p = 1) => api.get(`/admin/errores?page=${p}`).then(setData);
  useEffect(() => { cargar(); }, []);
  async function limpiar() {
    if (!window.confirm('¿Borrar todo el registro de fallas 5xx?')) return;
    await api.delete('/admin/errores');
    cargar();
  }
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="text-muted" style={{ margin: 0 }}>Respuestas 5xx de la API, una por ocurrencia.</p>
        <button className="btn btn-outline btn-sm" onClick={limpiar} disabled={!data.total}>Limpiar</button>
      </div>
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>Fecha</th><th>Status</th><th>Mensaje</th><th>Ruta</th></tr></thead>
        <tbody>
          {data.errores.map((e) => (
            <tr key={e.id}>
              <td className="text-muted">{formatFecha(e.created_at)}</td>
              <td><span className="badge badge-danger">{e.status}</span></td>
              <td>{e.mensaje}</td>
              <td className="text-muted">{e.metodo} {e.ruta}</td>
            </tr>
          ))}
          {data.errores.length === 0 && <tr><td colSpan={4} className="text-muted">Sin fallas registradas.</td></tr>}
        </tbody>
      </table>
      <Paginador page={data.page} totalPages={data.totalPages} onIr={cargar} />
    </div>
  );
}

// Admin → Errores: errores de la app (servidor + navegador, agrupados),
// errores de mails, "Errores alertados" (reportes de los usuarios) y el
// registro histórico de fallas 5xx.
export default function AdminErrors() {
  const [tab, setTab] = useState('app');
  const [nuevos, setNuevos] = useState(0);
  const cargarNuevos = () => api.get('/admin/reportes-error/resumen').then((d) => setNuevos(d.nuevos)).catch(() => {});
  useEffect(() => { cargarNuevos(); }, []);

  const tabs = [
    ['app', 'Errores de la app'],
    ['mails', 'Errores de mails'],
    ['alertados', `Errores alertados${nuevos ? ` (${nuevos})` : ''}`],
    ['fallas', 'Fallas 5xx'],
  ];

  return (
    <div>
      <h1 style={{ margin: 0 }}>Errores</h1>
      <p className="text-muted" style={{ margin: '4px 0 0' }}>Todo lo que falló, del servidor, del navegador de los usuarios y de los mails, más lo que reportan los propios usuarios.</p>
      <div style={{ display: 'flex', gap: 6, marginTop: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {tabs.map(([k, label]) => (
          <button key={k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        {tab === 'app' && <TabApp />}
        {tab === 'mails' && <TabMails />}
        {tab === 'alertados' && <TabAlertados onCambio={cargarNuevos} />}
        {tab === 'fallas' && <TabFallas />}
      </div>
    </div>
  );
}
