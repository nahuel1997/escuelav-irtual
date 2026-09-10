import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

const ESTADO_LABEL = {
  programada: 'Programada',
  en_vivo: 'En vivo',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};
const ESTADO_BADGE = {
  programada: 'badge',
  en_vivo: 'badge-success',
  finalizada: '',
  cancelada: 'badge-danger',
};

const FORM_VACIO = { course_id: '', titulo: '', descripcion: '', fecha: '', hora: '', duracion_minutos: 60, profesor_ids: [] };

// Panel del admin para armar clases en vivo: agendar (con profesor/es y
// mail automático a alumnos inscriptos + profesores asignados), editar
// mientras siga "programada", y cancelar. Iniciar/finalizar la
// transmisión es del profesor asignado (ver LiveClasses.jsx del lado
// alumno/profesor) — el admin acá solo arma y da de baja.
export default function AdminLiveClasses() {
  const [clases, setClases] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState(null); // null = form de "nueva"
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');
  const [ok, setOk] = useState('');

  function cargarClases() {
    return api.get('/admin/clases-en-vivo').then((d) => setClases(d.clases));
  }

  useEffect(() => {
    Promise.all([
      cargarClases(),
      api.get('/admin/courses').then((d) => setCursos(d.courses)),
      api.get('/admin/users?rol=profesor').then((d) => setProfesores(d.users)),
    ])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleProfesor(id) {
    setForm((f) => ({
      ...f,
      profesor_ids: f.profesor_ids.includes(id) ? f.profesor_ids.filter((p) => p !== id) : [...f.profesor_ids, id],
    }));
  }

  function empezarEdicion(clase, profesoresAsignados) {
    const fechaObj = new Date(clase.scheduled_at);
    setEditandoId(clase.id);
    setForm({
      course_id: String(clase.course_id),
      titulo: clase.titulo,
      descripcion: clase.descripcion || '',
      fecha: fechaObj.toISOString().slice(0, 10),
      hora: fechaObj.toISOString().slice(11, 16),
      duracion_minutos: clase.duracion_minutos,
      profesor_ids: profesoresAsignados.map((p) => p.id),
    });
    setFormError('');
    setOk('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function abrirEdicion(clase) {
    try {
      const d = await api.get(`/admin/clases-en-vivo/${clase.id}`);
      empezarEdicion(d.clase, d.profesores);
    } catch (err) {
      setError(err.message);
    }
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setOk('');
    if (!form.course_id) return setFormError('Elegí un curso');
    if (!form.titulo.trim()) return setFormError('Ponele un título a la clase');
    if (!form.fecha || !form.hora) return setFormError('Completá fecha y hora');
    if (form.profesor_ids.length === 0) return setFormError('Asigná al menos un profesor');

    setGuardando(true);
    try {
      const scheduled_at = new Date(`${form.fecha}T${form.hora}`).toISOString();
      const payload = {
        course_id: Number(form.course_id),
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        scheduled_at,
        duracion_minutos: Number(form.duracion_minutos) || 60,
        profesor_ids: form.profesor_ids,
      };

      if (editandoId) {
        await api.put(`/admin/clases-en-vivo/${editandoId}`, payload);
        setOk('Clase actualizada.');
      } else {
        await api.post('/admin/clases-en-vivo', payload);
        setOk('Clase agendada. Se avisó por mail a los alumnos inscriptos y a los profesores asignados.');
      }
      cancelarEdicion();
      await cargarClases();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function cancelarClase(id) {
    try {
      await api.put(`/admin/clases-en-vivo/${id}/cancelar`);
      await cargarClases();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div>
      <h1 style={{ margin: 0 }}>Clases en vivo</h1>
      <p className="text-muted" style={{ margin: '4px 0 0' }}>
        Agendá clases en vivo (Jitsi Meet) para un curso. Los alumnos inscriptos y los profesores asignados reciben un mail cuando se agenda o se cancela.
      </p>

      <div className="card" style={{ marginTop: 16, maxWidth: 640 }}>
        <h3 style={{ marginTop: 0 }}>{editandoId ? 'Editar clase' : 'Agendar nueva clase'}</h3>
        {formError && <div className="alert alert-error">{formError}</div>}
        {ok && !formError && <div className="alert alert-success">{ok}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Curso</label>
            <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} required>
              <option value="">Elegí un curso</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Título de la clase</label>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          </div>

          <div className="field">
            <label>Descripción (opcional)</label>
            <textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Hora</label>
              <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Duración (min)</label>
              <input type="number" min="10" step="5" value={form.duracion_minutos} onChange={(e) => setForm({ ...form, duracion_minutos: e.target.value })} required />
            </div>
          </div>

          <div className="field">
            <label>Profesor/es a cargo (podés elegir más de uno)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              {profesores.length === 0 && <p className="text-muted" style={{ margin: 0 }}>No hay profesores cargados todavía.</p>}
              {profesores.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', fontWeight: 400 }}>
                  <input type="checkbox" checked={form.profesor_ids.includes(p.id)} onChange={() => toggleProfesor(p.id)} />
                  {p.nombre} {p.apellido}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agendar clase'}
            </button>
            {editandoId && (
              <button type="button" className="btn btn-outline" onClick={cancelarEdicion}>Cancelar edición</button>
            )}
          </div>
        </form>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Clase</th>
              <th>Curso</th>
              <th>Fecha</th>
              <th>Duración</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clases.map((c) => (
              <tr key={c.id}>
                <td>{c.titulo}</td>
                <td>{c.curso_titulo}</td>
                <td>{formatFecha(c.scheduled_at)}</td>
                <td>{c.duracion_minutos} min</td>
                <td><span className={`badge ${ESTADO_BADGE[c.estado] || ''}`}>{ESTADO_LABEL[c.estado] || c.estado}</span></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  {c.estado === 'programada' && (
                    <>
                      <button className="btn btn-outline btn-sm" onClick={() => abrirEdicion(c)}>Editar</button>
                      <button className="btn btn-outline btn-sm" onClick={() => cancelarClase(c.id)}>Cancelar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {clases.length === 0 && (
              <tr><td colSpan={6} className="text-muted">Todavía no agendaste ninguna clase en vivo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
