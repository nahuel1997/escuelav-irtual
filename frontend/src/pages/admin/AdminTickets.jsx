import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';
import TicketHilo from '../../components/TicketHilo';
import { ESTADOS_TICKET, PRIORIDADES_TICKET } from '../../config/estadosTicket';

function Tablero({ datos, onFiltrar }) {
  if (!datos) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {Object.entries(ESTADOS_TICKET).map(([k, v]) => (
        <button key={k} className="card" style={{ margin: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => onFiltrar({ estado: k })}>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>{v.label}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{datos.porEstado[k] || 0}</div>
        </button>
      ))}
      <button className="card" style={{ margin: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => onFiltrar({ asignado: 'sin' })}>
        <div className="text-muted" style={{ fontSize: '0.8rem' }}>Sin asignar (activos)</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: datos.sinAsignar ? 'var(--color-danger)' : undefined }}>{datos.sinAsignar}</div>
      </button>
    </div>
  );
}

function Etiquetas({ etiquetas, recargar }) {
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#1c3d5a');
  const [error, setError] = useState('');

  async function crear(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tickets/gestion/etiquetas', { nombre, color });
      setNombre('');
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrar(et) {
    if (!window.confirm(`¿Borrar la etiqueta "${et.nombre}"? Se saca de todos los tickets.`)) return;
    await api.delete(`/tickets/gestion/etiquetas/${et.id}`);
    recargar();
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Etiquetas</h3>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {etiquetas.map((et) => (
          <span key={et.id} className="badge" style={{ background: et.color, color: '#fff', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {et.nombre}
            <button type="button" onClick={() => borrar(et)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }} aria-label={`Borrar ${et.nombre}`}>×</button>
          </span>
        ))}
        {etiquetas.length === 0 && <span className="text-muted">Todavía no hay etiquetas.</span>}
      </div>
      <form onSubmit={crear} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nueva etiqueta</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} required />
        </div>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 38 }} />
        <button className="btn btn-outline btn-sm">Crear</button>
      </form>
    </div>
  );
}

function DetalleGestion({ id, agentes, etiquetas, onCambio, onCerrar }) {
  const [ticket, setTicket] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [interno, setInterno] = useState(false);
  const [adjuntos, setAdjuntos] = useState([]);
  const [aprobacion, setAprobacion] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    api.get(`/tickets/${id}`).then((d) => setTicket(d.ticket)).catch((e) => setError(e.message));
  }, [id]);

  async function actualizar(patch) {
    setError('');
    try {
      const { ticket: t } = await api.put(`/tickets/gestion/${id}`, patch);
      setTicket(t);
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  async function responder(e) {
    e.preventDefault();
    setError('');
    try {
      const form = new FormData();
      form.append('mensaje', mensaje.trim());
      form.append('interno', String(interno));
      adjuntos.forEach((a) => form.append('adjuntos', a));
      const { ticket: t } = await api.postForm(`/tickets/${id}/mensajes`, form);
      setTicket(t);
      setMensaje('');
      setAdjuntos([]);
      e.target.reset();
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  async function pedirAprobacion(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await api.post(`/tickets/gestion/${id}/aprobaciones`, { detalle: aprobacion.trim() });
      setAprobacion('');
      setOk(r.mailEnviado ? 'Pedido de aprobación enviado por mail.' : 'Pedido creado, pero el mail no salió (revisá Errores de mails).');
      setTimeout(() => setOk(''), 5000);
      api.get(`/tickets/${id}`).then((d) => setTicket(d.ticket));
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ticket) return <div className="card">{error ? <div className="alert alert-error">{error}</div> : 'Cargando…'}</div>;
  const idsEtiquetas = ticket.etiquetas.map((e) => e.id);

  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>{ticket.numero} · {ticket.asunto}</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            {ticket.nombre} {ticket.apellido} ({ticket.email}, {ticket.usuario_rol}) · {ticket.categoria || 'Sin tema'} · abierto {formatFecha(ticket.created_at)}
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onCerrar}>Cerrar panel</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      {ok && <div className="alert alert-success" style={{ marginTop: 12 }}>{ok}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Estado</label>
          <select value={ticket.estado} onChange={(e) => actualizar({ estado: e.target.value })}>
            {Object.entries(ESTADOS_TICKET).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Prioridad</label>
          <select value={ticket.prioridad} onChange={(e) => actualizar({ prioridad: e.target.value })}>
            {Object.entries(PRIORIDADES_TICKET).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Asignado a</label>
          <select value={ticket.asignado_a || ''} onChange={(e) => actualizar({ asignado_a: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sin asignar</option>
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre} {a.apellido} ({a.rol})</option>)}
          </select>
        </div>
      </div>

      {etiquetas.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {etiquetas.map((et) => {
            const activa = idsEtiquetas.includes(et.id);
            return (
              <button
                key={et.id}
                type="button"
                className="badge"
                onClick={() => actualizar({ etiquetas: activa ? idsEtiquetas.filter((x) => x !== et.id) : [...idsEtiquetas, et.id] })}
                style={{ cursor: 'pointer', border: `1px solid ${et.color}`, background: activa ? et.color : 'transparent', color: activa ? '#fff' : et.color }}
              >
                {et.nombre}
              </button>
            );
          })}
        </div>
      )}

      <TicketHilo ticket={ticket} />

      {ticket.aprobaciones.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <strong>Aprobaciones pedidas</strong>
          {ticket.aprobaciones.map((ap) => (
            <div key={ap.id} className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
              <span className={`badge ${ap.estado === 'aprobado' ? 'badge-success' : ap.estado === 'rechazado' ? 'badge-danger' : 'badge-warning'}`}>{ap.estado}</span>{' '}
              {ap.detalle} {ap.comentario ? `— "${ap.comentario}"` : ''} · {formatFecha(ap.created_at)}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={responder} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Responder</label>
          <textarea rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} required />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" multiple onChange={(e) => setAdjuntos(Array.from(e.target.files || []).slice(0, 5))} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} /> Nota interna (el usuario no la ve)
          </label>
          <button className="btn btn-primary btn-sm">{interno ? 'Guardar nota' : 'Enviar respuesta'}</button>
        </div>
      </form>

      <form onSubmit={pedirAprobacion} style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        <div className="field">
          <label>Pedir aprobación por mail (link sin login, vence en 7 días)</label>
          <textarea rows={2} value={aprobacion} onChange={(e) => setAprobacion(e.target.value)} placeholder="Ej: reemitir el certificado con el nombre corregido" />
        </div>
        <button className="btn btn-outline btn-sm" disabled={!aprobacion.trim()}>Enviar pedido de aprobación</button>
      </form>
    </div>
  );
}

// Bandeja de tickets del equipo (admin y agentes de soporte): tablero por
// estado, filtros, detalle con hilo, asignación, etiquetas, notas internas
// y pedido de aprobación por mail.
export default function AdminTickets() {
  const [tickets, setTickets] = useState([]);
  const [tablero, setTablero] = useState(null);
  const [agentes, setAgentes] = useState([]);
  const [etiquetas, setEtiquetas] = useState([]);
  const [filtro, setFiltro] = useState({ estado: '', asignado: '', etiqueta: '', prioridad: '', q: '' });
  const [abierto, setAbierto] = useState(null);
  const [verEtiquetas, setVerEtiquetas] = useState(false);
  const [error, setError] = useState('');

  function cargar(f = filtro) {
    const params = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    return Promise.all([
      api.get(`/tickets/gestion?${params.toString()}`).then((d) => setTickets(d.tickets)),
      api.get('/tickets/gestion/tablero').then(setTablero),
    ]).catch((e) => setError(e.message));
  }
  const cargarEtiquetas = () => api.get('/tickets/gestion/etiquetas').then((d) => setEtiquetas(d.etiquetas));

  useEffect(() => {
    cargar();
    cargarEtiquetas();
    api.get('/tickets/gestion/agentes').then((d) => setAgentes(d.agentes));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function filtrar(parcial) {
    const f = { estado: '', asignado: '', etiqueta: '', prioridad: '', q: '', ...parcial };
    setFiltro(f);
    cargar(f);
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Tickets de soporte</h1>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Consultas de alumnos y profesores con seguimiento.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setVerEtiquetas((v) => !v)}>{verEtiquetas ? 'Ocultar etiquetas' : 'Etiquetas'}</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 16 }}><Tablero datos={tablero} onFiltrar={filtrar} /></div>
      {verEtiquetas && <div style={{ marginTop: 16 }}><Etiquetas etiquetas={etiquetas} recargar={cargarEtiquetas} /></div>}

      <form
        className="card"
        onSubmit={(e) => { e.preventDefault(); cargar(filtro); }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16 }}
      >
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Estado</label>
          <select value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS_TICKET).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Asignado</label>
          <select value={filtro.asignado} onChange={(e) => setFiltro({ ...filtro, asignado: e.target.value })}>
            <option value="">Todos</option>
            <option value="yo">Asignados a mí</option>
            <option value="sin">Sin asignar</option>
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Prioridad</label>
          <select value={filtro.prioridad} onChange={(e) => setFiltro({ ...filtro, prioridad: e.target.value })}>
            <option value="">Todas</option>
            {Object.entries(PRIORIDADES_TICKET).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Etiqueta</label>
          <select value={filtro.etiqueta} onChange={(e) => setFiltro({ ...filtro, etiqueta: e.target.value })}>
            <option value="">Todas</option>
            {etiquetas.map((et) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <label>Buscar</label>
          <input value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} placeholder="Asunto, email o T-000123" />
        </div>
        <button className="btn btn-primary btn-sm">Filtrar</button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: abierto ? 'minmax(260px, 1fr) minmax(0, 1.6fr)' : '1fr', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div className="card" style={{ margin: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Ticket</th><th>Estado</th>{!abierto && <><th>Prioridad</th><th>Usuario</th><th>Asignado</th><th>Actualizado</th></>}</tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => setAbierto(t.id)} style={{ cursor: 'pointer', background: abierto === t.id ? 'var(--color-bg-alt)' : undefined }}>
                  <td>
                    <strong>{t.numero}</strong> {t.asunto}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {t.etiquetas.map((et) => <span key={et.id} className="badge" style={{ background: et.color, color: '#fff', fontSize: '0.7rem' }}>{et.nombre}</span>)}
                    </div>
                  </td>
                  <td><span className={`badge ${ESTADOS_TICKET[t.estado]?.clase || ''}`}>{ESTADOS_TICKET[t.estado]?.label || t.estado}</span></td>
                  {!abierto && (
                    <>
                      <td><span className={`badge ${PRIORIDADES_TICKET[t.prioridad]?.clase || ''}`}>{PRIORIDADES_TICKET[t.prioridad]?.label}</span></td>
                      <td>{t.nombre} {t.apellido}<div className="text-muted" style={{ fontSize: '0.8rem' }}>{t.email}</div></td>
                      <td>{t.asignado_nombre ? `${t.asignado_nombre} ${t.asignado_apellido}` : <span className="text-muted">—</span>}</td>
                      <td className="text-muted">{formatFecha(t.updated_at)}</td>
                    </>
                  )}
                </tr>
              ))}
              {tickets.length === 0 && <tr><td colSpan={6} className="text-muted">No hay tickets con ese filtro.</td></tr>}
            </tbody>
          </table>
        </div>
        {abierto && (
          <DetalleGestion
            key={abierto}
            id={abierto}
            agentes={agentes}
            etiquetas={etiquetas}
            onCambio={() => cargar()}
            onCerrar={() => setAbierto(null)}
          />
        )}
      </div>
    </div>
  );
}
