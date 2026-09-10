import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha as formatearFecha } from '../../utils/fecha';

const ESTADO_LABEL = { pendiente: 'Pendiente', aceptada: 'Aceptado', rechazada: 'Rechazado', cancelada: 'Cancelado' };
const ESTADO_BADGE = { pendiente: 'badge-warning', aceptada: 'badge-success', rechazada: 'badge-danger', cancelada: 'badge-danger' };

// Registro de todos los turnos solicitados en la plataforma, para que el
// admin pueda auditar la actividad del calendario sin depender de cada
// alumno/profesor. Es de solo lectura: aceptar/rechazar/cancelar sigue
// siendo cosa de las partes involucradas (ver /calendario).
export default function AdminCalendar() {
  const [eventos, setEventos] = useState([]);
  const [estado, setEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function cargar(filtroEstado) {
    setLoading(true);
    const query = filtroEstado ? `?estado=${filtroEstado}` : '';
    return api
      .get(`/admin/calendario${query}`)
      .then((d) => setEventos(d.eventos))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(''); }, []);

  function handleFiltro(e) {
    const valor = e.target.value;
    setEstado(valor);
    cargar(valor);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Calendario — registro de turnos</h1>
        <select value={estado} onChange={handleFiltro} style={{ maxWidth: 220 }}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aceptada">Aceptados</option>
          <option value="rechazada">Rechazados</option>
          <option value="cancelada">Cancelados</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        {loading ? (
          <p className="text-muted">Cargando…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Profesor</th>
                <th>Curso</th>
                <th>Horario</th>
                <th>Motivo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td>{e.alumno_nombre} {e.alumno_apellido}</td>
                  <td>{e.profesor_nombre} {e.profesor_apellido}</td>
                  <td>{e.curso_titulo || '—'}</td>
                  <td>{formatearFecha(e.starts_at)} – {formatearFecha(e.ends_at)}</td>
                  <td>{e.motivo}</td>
                  <td><span className={`badge ${ESTADO_BADGE[e.estado] || ''}`}>{ESTADO_LABEL[e.estado] || e.estado}</span></td>
                </tr>
              ))}
              {eventos.length === 0 && (
                <tr><td colSpan={6} className="text-muted">No hay turnos que coincidan con el filtro.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
