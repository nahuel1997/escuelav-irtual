import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { formatFecha } from '../../../utils/fecha';

const ESTADOS = ['enviado', 'fallido', 'pendiente'];

// Mismo estilo que .field input en global.css, para inputs sueltos que no
// están dentro de un <div className="field"> con label.
const estiloInput = {
  fontFamily: 'inherit', fontSize: '0.95rem', padding: '10px 12px',
  border: '1.5px solid var(--color-border)', borderRadius: 8, background: '#fff', color: 'var(--color-text)',
};

// Registro de todos los mails que la plataforma intentó mandar
// (transaccionales y de campaña) — la forma de confirmar que un mail
// realmente se disparó sin tener que abrir una casilla real.
export default function RegistroTab() {
  const [envios, setEnvios] = useState([]);
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  function cargar() {
    setCargando(true);
    const params = new URLSearchParams();
    if (tipo) params.set('tipo', tipo);
    if (estado) params.set('estado', estado);
    return api.get(`/admin/mails/registro?${params.toString()}`)
      .then(({ envios }) => setEnvios(envios))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [tipo, estado]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input style={{ ...estiloInput, width: 220 }} placeholder="Filtrar por tipo (ej: bienvenida)" value={tipo} onChange={(e) => setTipo(e.target.value)} />
        <select style={{ ...estiloInput, width: 180 }} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {cargando ? (
        <div className="spinner-msg">Cargando…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Destinatario</th>
                <th>Tipo</th>
                <th>Asunto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {envios.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatFecha(e.created_at)}</td>
                  <td style={{ fontSize: '0.82rem' }}>{e.destinatario}</td>
                  <td><code style={{ fontSize: '0.75rem' }}>{e.tipo}</code></td>
                  <td style={{ fontSize: '0.82rem' }}>{e.asunto}</td>
                  <td><EstadoBadge estado={e.estado} /></td>
                  <td>{e.preview_url && <a href={e.preview_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>ver</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {envios.length === 0 && <p className="text-muted" style={{ marginTop: 12 }}>Todavía no hay envíos registrados.</p>}
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado }) {
  const cfg = {
    enviado: { color: '#1a8a4a', bg: 'rgba(26,138,74,0.15)' },
    fallido: { color: '#c0392b', bg: 'rgba(192,57,43,0.15)' },
    pendiente: { color: '#e0972d', bg: 'rgba(224,151,45,0.15)' },
  }[estado] || { color: '#8b97a5', bg: 'rgba(139,151,165,0.15)' };

  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {estado}
    </span>
  );
}
