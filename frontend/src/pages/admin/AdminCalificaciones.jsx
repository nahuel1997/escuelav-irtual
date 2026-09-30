import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import ArchivoPrivado from '../../components/ArchivoPrivado';

function Detalle({ id, onCambio }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ criterio: 'General', puntaje: 5, comentario: '', fecha: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');
  const cargar = () => api.get(`/admin/calificaciones/${id}`).then(setD);
  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function calificar(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/admin/calificaciones/${id}`, { ...form, puntaje: Number(form.puntaje) });
      setForm({ ...form, comentario: '' });
      cargar();
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  async function subir(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('adjuntos', f));
    try {
      await api.postForm(`/admin/calificaciones/${id}/adjuntos`, fd);
      e.target.value = '';
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!d) return <p className="text-muted">Cargando…</p>;
  return (
    <div className="card" style={{ margin: 0 }}>
      <h2 style={{ marginTop: 0 }}>{d.profesor.nombre} {d.profesor.apellido}</h2>
      <p className="text-muted">Solo lo ve la administración.</p>
      {Object.keys(d.promedios).length > 0 && <p>{Object.entries(d.promedios).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={calificar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}><label>Criterio</label><select value={form.criterio} onChange={(e) => setForm({ ...form, criterio: e.target.value })}>{d.criterios.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Puntaje</label><select value={form.puntaje} onChange={(e) => setForm({ ...form, puntaje: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}><label>Comentario</label><input value={form.comentario} onChange={(e) => setForm({ ...form, comentario: e.target.value })} /></div>
        <button className="btn btn-primary btn-sm">Guardar</button>
      </form>
      <table style={{ marginTop: 12 }}><tbody>
        {d.calificaciones.map((c) => (
          <tr key={c.id}>
            <td>{String(c.fecha).slice(0, 10)}</td><td>{c.criterio}</td><td><strong>{c.puntaje}</strong>/5</td><td>{c.comentario || '—'}</td><td className="text-muted">{c.admin_nombre}</td>
            <td><button className="btn btn-outline btn-sm" onClick={async () => { await api.delete(`/admin/calificaciones/${id}/${c.id}`); cargar(); onCambio(); }} aria-label="Borrar calificación">×</button></td>
          </tr>
        ))}
      </tbody></table>
      <h3>Adjuntos</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {d.adjuntos.map((a) => (
          <span key={a.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <ArchivoPrivado ruta={`/admin/calificaciones/${id}/adjuntos/${a.id}`} nombre={a.nombre_original} mime={a.mime} />
            <button className="btn btn-outline btn-sm" onClick={async () => { await api.delete(`/admin/calificaciones/${id}/adjuntos/${a.id}`); cargar(); }} aria-label="Borrar adjunto">×</button>
          </span>
        ))}
        <input type="file" multiple onChange={subir} />
      </div>
    </div>
  );
}

// Admin → Calificaciones internas de profesores (portado de las
// calificaciones de consultores de DBA24), cruzadas con la encuesta de los alumnos.
export default function AdminCalificaciones() {
  const [data, setData] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const cargar = () => api.get('/admin/calificaciones').then(setData);
  useEffect(() => { cargar(); }, []);
  return (
    <div>
      <h1 style={{ margin: 0 }}>Calificaciones internas</h1>
      <div style={{ display: 'grid', gridTemplateColumns: abierto ? 'minmax(280px, 1fr) minmax(0, 1.5fr)' : '1fr', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div className="card" style={{ margin: 0, overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Profesor</th><th>Interna</th><th>Encuesta</th><th>Alumnos</th></tr></thead>
            <tbody>
              {data?.profesores.map((p) => (
                <tr key={p.id} onClick={() => setAbierto(p.id)} style={{ cursor: 'pointer', background: abierto === p.id ? 'var(--color-bg-alt)' : undefined }}>
                  <td>{p.profesor}</td><td>{p.calificacionInterna ?? '—'}</td><td>{p.encuestaAlumnos ?? '—'}</td><td>{p.alumnos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {abierto && <Detalle key={abierto} id={abierto} onCambio={cargar} />}
      </div>
    </div>
  );
}
