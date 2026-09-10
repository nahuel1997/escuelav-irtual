import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, API_ORIGIN } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CurriculumOverview from '../components/CurriculumOverview';
import CurriculumEditor from '../components/CurriculumEditor';

export default function Classroom() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // "Contenido del curso" (unidades/capítulos) es la pestaña por defecto:
  // es lo primero que se quiere ver al entrar al classroom. "Tareas" (lo
  // que ya existía antes de esto) queda al lado, sin perder nada.
  const [tab, setTab] = useState('contenido');

  async function cargarTareas() {
    const { assignments } = await api.get(`/classroom/courses/${courseId}/assignments`);
    setAssignments(assignments);
  }

  useEffect(() => {
    Promise.all([api.get(`/courses/${courseId}`, { auth: false }), cargarTareas()])
      .then(([c]) => setCourse(c.course))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  if (loading) return <div className="spinner-msg">Cargando classroom…</div>;
  if (error) return <div className="container section"><div className="alert alert-error">{error}</div></div>;

  return (
    <section className="section">
      <div className="container">
        <span className="badge">Classroom</span>
        <h1>{course?.titulo}</h1>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, borderBottom: '1px solid var(--color-border)' }}>
          {['contenido', 'tareas'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 4px',
                fontWeight: 600, color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
            >
              {t === 'contenido' ? 'Contenido del curso' : 'Tareas'}
            </button>
          ))}
        </div>

        {tab === 'contenido' ? (
          user.rol === 'profesor' ? <CurriculumEditor courseId={courseId} /> : <CurriculumOverview courseId={courseId} />
        ) : (
          user.rol === 'profesor' ? (
            <TeacherView courseId={courseId} assignments={assignments} onCreated={cargarTareas} />
          ) : (
            <StudentView assignments={assignments} onSubmitted={cargarTareas} />
          )
        )}
      </div>
    </section>
  );
}

function TeacherView({ courseId, assignments, onCreated }) {
  const [form, setForm] = useState({ titulo: '', descripcion: '', fecha_entrega: '' });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  async function crearTarea(e) {
    e.preventDefault();
    setCreando(true);
    setError('');
    try {
      await api.post(`/classroom/courses/${courseId}/assignments`, form);
      setForm({ titulo: '', descripcion: '', fecha_entrega: '' });
      await onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function verEntregas(assignmentId) {
    if (abierta === assignmentId) {
      setAbierta(null);
      return;
    }
    const { submissions } = await api.get(`/classroom/assignments/${assignmentId}/submissions`);
    setSubmissions(submissions);
    setAbierta(assignmentId);
  }

  return (
    <>
      <div className="card" style={{ marginTop: 24, maxWidth: 560 }}>
        <h3>Nueva tarea</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={crearTarea}>
          <div className="field">
            <label>Título</label>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          </div>
          <div className="field">
            <label>Descripción / consigna</label>
            <textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
          </div>
          <div className="field">
            <label>Fecha de entrega (opcional)</label>
            <input type="date" value={form.fecha_entrega} onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })} />
          </div>
          <button className="btn btn-primary" disabled={creando}>{creando ? 'Creando…' : 'Publicar tarea'}</button>
        </form>
      </div>

      <h3 style={{ marginTop: 32 }}>Tareas publicadas</h3>
      {assignments.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 16 }}>
          <h3>{a.titulo}</h3>
          <p className="text-muted">{a.descripcion}</p>
          {a.fecha_entrega && <p className="text-muted">Entrega: {a.fecha_entrega}</p>}
          <button className="btn btn-outline btn-sm" onClick={() => verEntregas(a.id)}>
            {abierta === a.id ? 'Ocultar entregas' : 'Ver entregas'}
          </button>

          {abierta === a.id && <SubmissionsTable submissions={submissions} />}
        </div>
      ))}
      {assignments.length === 0 && <p className="text-muted">Todavía no publicaste tareas.</p>}

      <StudentsPanel courseId={courseId} />
    </>
  );
}

function StudentsPanel({ courseId }) {
  const [students, setStudents] = useState([]);
  const [marcando, setMarcando] = useState(null);

  function cargar() {
    return api.get(`/classroom/courses/${courseId}/students`).then((d) => setStudents(d.students));
  }

  useEffect(() => { cargar(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function marcarCompletado(userId) {
    setMarcando(userId);
    try {
      await api.put(`/classroom/courses/${courseId}/students/${userId}/complete`);
      await cargar();
    } finally {
      setMarcando(null);
    }
  }

  return (
    <>
      <h3 style={{ marginTop: 32 }}>Alumnos inscriptos</h3>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Alumno</th><th>Email</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.nombre} {s.apellido}</td>
                <td>{s.email}</td>
                <td>
                  <span className={`badge ${s.completado_at ? 'badge-success' : ''}`}>
                    {s.completado_at ? 'Curso completado' : 'Cursando'}
                  </span>
                </td>
                <td>
                  {!s.completado_at && (
                    <button className="btn btn-outline btn-sm" disabled={marcando === s.id} onClick={() => marcarCompletado(s.id)}>
                      {marcando === s.id ? '...' : 'Marcar completado'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={4} className="text-muted">Todavía no hay alumnos inscriptos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SubmissionsTable({ submissions }) {
  const [grades, setGrades] = useState({});
  const [guardando, setGuardando] = useState(null);
  const [items, setItems] = useState(submissions);

  useEffect(() => setItems(submissions), [submissions]);

  async function calificar(id) {
    setGuardando(id);
    try {
      const datos = grades[id] || {};
      const { submission } = await api.put(`/classroom/submissions/${id}/grade`, {
        calificacion: datos.calificacion ? Number(datos.calificacion) : null,
        feedback_profesor: datos.feedback_profesor || '',
      });
      setItems(items.map((s) => (s.id === id ? submission : s)));
    } finally {
      setGuardando(null);
    }
  }

  if (items.length === 0) return <p className="text-muted" style={{ marginTop: 12 }}>Todavía nadie entregó esta tarea.</p>;

  return (
    <table style={{ marginTop: 16 }}>
      <thead>
        <tr>
          <th>Alumno</th>
          <th>Archivo</th>
          <th>Estado</th>
          <th>Calificación</th>
          <th>Feedback</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((s) => (
          <tr key={s.id}>
            <td>{s.alumno_nombre} {s.alumno_apellido}</td>
            <td><a href={`${API_ORIGIN}${s.archivo_path}`} target="_blank" rel="noreferrer">{s.archivo_nombre_original || 'descargar'}</a></td>
            <td><span className={`badge ${s.estado === 'revisado' ? 'badge-success' : 'badge-warning'}`}>{s.estado}</span></td>
            <td>
              <input
                style={{ width: 60 }}
                defaultValue={s.calificacion ?? ''}
                onChange={(e) => setGrades({ ...grades, [s.id]: { ...grades[s.id], calificacion: e.target.value } })}
              />
            </td>
            <td>
              <input
                defaultValue={s.feedback_profesor ?? ''}
                onChange={(e) => setGrades({ ...grades, [s.id]: { ...grades[s.id], feedback_profesor: e.target.value } })}
              />
            </td>
            <td>
              <button className="btn btn-primary btn-sm" disabled={guardando === s.id} onClick={() => calificar(s.id)}>
                {guardando === s.id ? '...' : 'Guardar'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StudentView({ assignments, onSubmitted }) {
  return (
    <div style={{ marginTop: 24 }}>
      {assignments.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 16 }}>
          <h3>{a.titulo}</h3>
          <p className="text-muted">{a.descripcion}</p>
          {a.fecha_entrega && <p className="text-muted">Entrega: {a.fecha_entrega}</p>}
          <SubmissionBox assignment={a} onSubmitted={onSubmitted} />
        </div>
      ))}
      {assignments.length === 0 && <p className="text-muted">Todavía no hay tareas publicadas en este curso.</p>}
    </div>
  );
}

function SubmissionBox({ assignment, onSubmitted }) {
  const [file, setFile] = useState(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const entrega = assignment.mi_entrega;

  async function entregar(e) {
    e.preventDefault();
    if (!file) return setError('Elegí un archivo para entregar');
    setEnviando(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('comentario', comentario);
      await api.postForm(`/classroom/assignments/${assignment.id}/submissions`, formData);
      await onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (entrega) {
    return (
      <div>
        <span className={`badge ${entrega.estado === 'revisado' ? 'badge-success' : 'badge-warning'}`}>
          {entrega.estado === 'revisado' ? 'Revisado' : 'Entregado, pendiente de revisión'}
        </span>
        <p style={{ marginTop: 8 }}>
          Archivo entregado: <a href={`${API_ORIGIN}${entrega.archivo_path}`} target="_blank" rel="noreferrer">{entrega.archivo_nombre_original}</a>
        </p>
        {entrega.estado === 'revisado' && (
          <>
            {entrega.calificacion != null && <p><strong>Calificación:</strong> {entrega.calificacion}</p>}
            {entrega.feedback_profesor && <p><strong>Feedback:</strong> {entrega.feedback_profesor}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={entregar} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
      {error && <div className="alert alert-error">{error}</div>}
      <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
      <textarea placeholder="Comentario opcional para el profesor" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <button className="btn btn-primary btn-sm" disabled={enviando}>{enviando ? 'Enviando…' : 'Entregar tarea'}</button>
    </form>
  );
}
