import { Fragment, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha as formatearFecha } from '../../utils/fecha';

// Registro de solo lectura de todas las conversaciones del chat de
// soporte — responder es cosa del panel de soporte (/soporte), acá el
// admin solo supervisa: quién habló con quién, quién lo atendió, cuántos
// mensajes, y puede abrir la transcripción completa de cualquiera.
export default function AdminChats() {
  const [estado, setEstado] = useState('abierto');
  const [conversaciones, setConversaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);

  function cargar() {
    setLoading(true);
    return api.get(`/admin/chats?estado=${estado}`)
      .then((d) => setConversaciones(d.conversaciones))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  function verTranscripcion(id) {
    if (abierta === id) {
      setAbierta(null);
      return;
    }
    setAbierta(id);
    setCargandoMensajes(true);
    api.get(`/admin/chats/${id}/mensajes`)
      .then((d) => setMensajes(d.mensajes))
      .catch((err) => setError(err.message))
      .finally(() => setCargandoMensajes(false));
  }

  return (
    <div>
      <h1>Chats de soporte</h1>
      <p className="text-muted">Registro de todas las conversaciones del chat en vivo — solo lectura, para supervisión.</p>

      <div style={{ display: 'flex', gap: 6, marginTop: 16, marginBottom: 12 }}>
        <button className={`btn btn-sm ${estado === 'abierto' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEstado('abierto')}>Abiertos</button>
        <button className={`btn btn-sm ${estado === 'cerrado' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEstado('cerrado')}>Cerrados</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <p className="text-muted">Cargando…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Atendido por</th>
                <th>Mensajes</th>
                <th>Iniciado</th>
                <th>Última actividad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {conversaciones.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td>{c.usuario_nombre} {c.usuario_apellido} <span className="text-muted">({c.usuario_email})</span> <span className="badge">{c.usuario_rol}</span></td>
                    <td>{c.atendido_por_id ? `${c.atendido_por_nombre} ${c.atendido_por_apellido}` : <span className="text-muted">Sin responder aún</span>}</td>
                    <td>{Number(c.cantidad_mensajes)}</td>
                    <td>{formatearFecha(c.created_at)}</td>
                    <td>{formatearFecha(c.updated_at)}</td>
                    <td><button className="btn btn-outline btn-sm" onClick={() => verTranscripcion(c.id)}>{abierta === c.id ? 'Cerrar' : 'Ver'}</button></td>
                  </tr>
                  {abierta === c.id && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--color-bg-alt)' }}>
                        {cargandoMensajes ? (
                          <p className="text-muted">Cargando mensajes…</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0', maxHeight: 320, overflowY: 'auto' }}>
                            {mensajes.map((m) => (
                              <div key={m.id} style={{ fontSize: '0.85rem' }}>
                                <strong style={{ color: m.remitente_tipo === 'soporte' ? 'var(--color-primary)' : 'var(--color-text)' }}>
                                  {m.remitente_nombre}:
                                </strong>{' '}
                                {m.cuerpo}
                                <span className="text-muted" style={{ fontSize: '0.72rem', marginLeft: 6 }}>{formatearFecha(m.created_at)}</span>
                              </div>
                            ))}
                            {mensajes.length === 0 && <p className="text-muted">Sin mensajes.</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {conversaciones.length === 0 && (
                <tr><td colSpan={6} className="text-muted">No hay chats {estado === 'abierto' ? 'abiertos' : 'cerrados'} todavía.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
