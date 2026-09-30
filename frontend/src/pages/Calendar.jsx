import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { zonaActual } from '../utils/fecha';
import { useEstadoPublico } from '../hooks/useEstadoPublico';

// Próximos feriados (Admin → Configuración → Feriados): esos días no se
// pueden pedir turnos.
function ProximosFeriados() {
  const estado = useEstadoPublico();
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: zonaActual() }).format(new Date());
  const proximos = ((estado && estado.feriados && estado.feriados.dias) || []).filter((d) => d.fecha >= hoy).slice(0, 5);
  if (!proximos.length) return null;
  return (
    <div className="alert" style={{ background: 'var(--color-bg-alt)', margin: '12px 0' }}>
      <strong>Próximos feriados (sin turnos):</strong>{' '}
      {proximos.map((d) => `${new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} (${d.nombre})`).join(' · ')}
    </div>
  );
}

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptado',
  rechazada: 'Rechazado',
  cancelada: 'Cancelado',
};
const ESTADO_BADGE = {
  pendiente: 'badge-warning',
  aceptada: 'badge-success',
  rechazada: 'badge-danger',
  cancelada: 'badge-danger',
};

function EstadoBadge({ estado }) {
  return <span className={`badge ${ESTADO_BADGE[estado] || ''}`}>{ESTADO_LABEL[estado] || estado}</span>;
}

function formatearRango(startsAt, endsAt) {
  const inicio = new Date(startsAt);
  const fin = new Date(endsAt);
  const fecha = inicio.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zonaActual() });
  const hIni = inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: zonaActual() });
  const hFin = fin.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: zonaActual() });
  return `${fecha}, ${hIni} a ${hFin} hs`;
}

export default function Calendar() {
  const { user } = useAuth();

  return (
    <section className="section">
      <div className="container">
        <span className="badge">Calendario</span>
        <h1>Turnos con {user.rol === 'profesor' ? 'alumnos' : 'profesores'}</h1>
        <p className="text-muted">
          {user.rol === 'profesor'
            ? 'Acá vas a ver los turnos que te piden tus alumnos: podés aceptarlos o rechazarlos.'
            : 'Solicitá un horario con un profesor. Queda pendiente hasta que lo confirme.'}
        </p>

        <ProximosFeriados />
        {user.rol === 'profesor' ? <TeacherCalendar /> : <StudentCalendar />}
      </div>
    </section>
  );
}

// =============================================================================
// Vista del alumno: formulario para pedir un turno + lista de sus turnos.
// =============================================================================
function StudentCalendar() {
  const [profesores, setProfesores] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function cargarTodo() {
    const [{ profesores }, { courses }, { eventos }] = await Promise.all([
      api.get('/users/profesores'),
      api.get('/courses/mine'),
      api.get('/calendar/mis-turnos'),
    ]);
    setProfesores(profesores);
    setCursos(courses);
    setEventos(eventos);
  }

  useEffect(() => {
    cargarTodo()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function cancelar(id) {
    await api.put(`/calendar/turnos/${id}/cancelar`);
    await cargarTodo();
  }

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div className="grid grid-2" style={{ alignItems: 'start', gap: 24, marginTop: 24 }}>
      <SolicitarTurnoForm profesores={profesores} cursos={cursos} onCreado={cargarTodo} />

      <div>
        <h3>Mis turnos</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {eventos.length === 0 && <p className="text-muted">Todavía no solicitaste ningún turno.</p>}
        {eventos.map((e) => (
          <div key={e.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
              <div>
                <strong>Prof. {e.profesor_nombre} {e.profesor_apellido}</strong>
                {e.curso_titulo && <p className="text-muted" style={{ margin: '2px 0' }}>{e.curso_titulo}</p>}
                <p style={{ margin: '4px 0' }}>{formatearRango(e.starts_at, e.ends_at)}</p>
                <p className="text-muted" style={{ margin: 0 }}>{e.motivo}</p>
                {e.notas_profesor && (
                  <p style={{ marginTop: 6, fontSize: '0.9rem' }}><strong>Nota del profesor:</strong> {e.notas_profesor}</p>
                )}
              </div>
              <EstadoBadge estado={e.estado} />
            </div>
            {['pendiente', 'aceptada'].includes(e.estado) && (
              <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => cancelar(e.id)}>
                Cancelar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SolicitarTurnoForm({ profesores, cursos, onCreado }) {
  const [form, setForm] = useState({ profesor_id: '', course_id: '', motivo: '', fecha: '', hora_inicio: '', hora_fin: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    setOk('');
    try {
      if (!form.profesor_id) throw new Error('Elegí un profesor');
      if (!form.fecha || !form.hora_inicio || !form.hora_fin) throw new Error('Completá fecha, hora de inicio y hora de fin');

      const starts_at = new Date(`${form.fecha}T${form.hora_inicio}`).toISOString();
      const ends_at = new Date(`${form.fecha}T${form.hora_fin}`).toISOString();

      await api.post('/calendar/turnos', {
        profesor_id: Number(form.profesor_id),
        course_id: form.course_id ? Number(form.course_id) : null,
        motivo: form.motivo,
        starts_at,
        ends_at,
      });
      setOk('Turno solicitado. Te vamos a avisar cuando el profesor lo confirme.');
      setForm({ profesor_id: '', course_id: '', motivo: '', fecha: '', hora_inicio: '', hora_fin: '' });
      await onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card">
      <h3>Solicitar un turno</h3>
      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-success">{ok}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Profesor</label>
          <select value={form.profesor_id} onChange={(e) => setForm({ ...form, profesor_id: e.target.value })} required>
            <option value="">Elegí un profesor</option>
            {profesores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Curso relacionado (opcional)</label>
          <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
            <option value="">Sin curso asociado</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.titulo}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Motivo</label>
          <textarea rows={2} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required />
        </div>
        <div className="field">
          <label>Fecha</label>
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Desde</label>
            <input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Hasta</label>
            <input type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} required />
          </div>
        </div>
        <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Solicitar turno'}</button>
      </form>
    </div>
  );
}

// =============================================================================
// Vista del profesor: solicitudes pendientes (aceptar/rechazar) + agenda de
// turnos ya confirmados.
// =============================================================================
function TeacherCalendar() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(null);
  const [notas, setNotas] = useState({});

  function cargar() {
    return api.get('/calendar/mis-turnos').then((d) => setEventos(d.eventos));
  }

  useEffect(() => {
    cargar()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function resolver(id, accion) {
    setProcesando(id);
    setError('');
    try {
      await api.put(`/calendar/turnos/${id}/${accion}`, { notas_profesor: notas[id] || '' });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  }

  async function cancelar(id) {
    setProcesando(id);
    try {
      await api.put(`/calendar/turnos/${id}/cancelar`);
      await cargar();
    } finally {
      setProcesando(null);
    }
  }

  if (loading) return <div className="spinner-msg">Cargando…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const pendientes = eventos.filter((e) => e.estado === 'pendiente');
  const confirmados = eventos.filter((e) => e.estado === 'aceptada');
  const resueltos = eventos.filter((e) => ['rechazada', 'cancelada'].includes(e.estado));

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Solicitudes pendientes</h3>
      {pendientes.length === 0 && <p className="text-muted">No tenés solicitudes pendientes.</p>}
      {pendientes.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
            <div>
              <strong>{e.alumno_nombre} {e.alumno_apellido}</strong>
              {e.curso_titulo && <p className="text-muted" style={{ margin: '2px 0' }}>{e.curso_titulo}</p>}
              <p style={{ margin: '4px 0' }}>{formatearRango(e.starts_at, e.ends_at)}</p>
              <p className="text-muted" style={{ margin: 0 }}>{e.motivo}</p>
            </div>
            <EstadoBadge estado={e.estado} />
          </div>
          <input
            placeholder="Nota para el alumno (opcional)"
            style={{ marginTop: 10, width: '100%', maxWidth: 420 }}
            value={notas[e.id] || ''}
            onChange={(ev) => setNotas({ ...notas, [e.id]: ev.target.value })}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" disabled={procesando === e.id} onClick={() => resolver(e.id, 'aceptar')}>
              {procesando === e.id ? '...' : 'Aceptar'}
            </button>
            <button className="btn btn-outline btn-sm" disabled={procesando === e.id} onClick={() => resolver(e.id, 'rechazar')}>
              Rechazar
            </button>
          </div>
        </div>
      ))}

      <h3 style={{ marginTop: 32 }}>Mi agenda confirmada</h3>
      {confirmados.length === 0 && <p className="text-muted">No tenés turnos confirmados todavía.</p>}
      {confirmados.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
            <div>
              <strong>{e.alumno_nombre} {e.alumno_apellido}</strong>
              {e.curso_titulo && <p className="text-muted" style={{ margin: '2px 0' }}>{e.curso_titulo}</p>}
              <p style={{ margin: '4px 0' }}>{formatearRango(e.starts_at, e.ends_at)}</p>
              <p className="text-muted" style={{ margin: 0 }}>{e.motivo}</p>
            </div>
            <EstadoBadge estado={e.estado} />
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} disabled={procesando === e.id} onClick={() => cancelar(e.id)}>
            Cancelar
          </button>
        </div>
      ))}

      {resueltos.length > 0 && (
        <>
          <h3 style={{ marginTop: 32 }}>Historial</h3>
          {resueltos.map((e) => (
            <div key={e.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                <div>
                  <strong>{e.alumno_nombre} {e.alumno_apellido}</strong>
                  <p style={{ margin: '4px 0' }}>{formatearRango(e.starts_at, e.ends_at)}</p>
                </div>
                <EstadoBadge estado={e.estado} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
