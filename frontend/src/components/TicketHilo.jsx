import { formatFecha } from '../utils/fecha';
import ArchivoPrivado from './ArchivoPrivado';

// Hilo de mensajes de un ticket — lo usan tanto "Mis consultas" (usuario)
// como la bandeja del equipo. Las notas internas solo llegan del backend
// si quien mira es del equipo.
export default function TicketHilo({ ticket }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ticket.mensajes.map((m) => {
        if (m.sistema) {
          return (
            <div key={m.id} className="text-muted" style={{ fontSize: '0.82rem', textAlign: 'center' }}>
              {m.mensaje} · {formatFecha(m.created_at)}
            </div>
          );
        }
        const delDueno = m.user_id === ticket.user_id;
        return (
          <div
            key={m.id}
            className="card"
            style={{
              margin: 0,
              marginLeft: delDueno ? 0 : 40,
              marginRight: delDueno ? 40 : 0,
              background: m.interno ? '#fff8e6' : undefined,
              borderLeft: m.interno ? '4px solid #e0972d' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.85rem', marginBottom: 6 }}>
              <strong>
                {m.nombre ? `${m.nombre} ${m.apellido || ''}` : 'Equipo'}
                {!delDueno && <span className="text-muted"> · {m.autor_rol === 'admin' ? 'Administración' : 'Soporte'}</span>}
                {m.interno && <span className="badge" style={{ marginLeft: 6 }}>Nota interna</span>}
              </strong>
              <span className="text-muted">{formatFecha(m.created_at)}</span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.mensaje}</div>
            {m.adjuntos && m.adjuntos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {m.adjuntos.map((a) => (
                  <ArchivoPrivado key={a.id} ruta={`/tickets/adjuntos/${a.id}`} nombre={a.nombre_original} mime={a.mime} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
