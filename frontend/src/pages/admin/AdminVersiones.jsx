import { useEffect, useState } from 'react';
import { api, guardarBlob } from '../../api/client';

const VACIA = { version: '', titulo: '', fecha: new Date().toISOString().slice(0, 10), cambios: '' };

// Admin → Versiones: registro de cambios de la plataforma (lo ven los
// usuarios en "Novedades") y PDF.
export default function AdminVersiones() {
  const [versiones, setVersiones] = useState([]);
  const [form, setForm] = useState(VACIA);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/admin/versiones').then((d) => setVersiones(d.versiones)).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function guardar(e) {
    e.preventDefault();
    setError('');
    try {
      if (editando) await api.put(`/admin/versiones/${editando}`, form);
      else await api.post('/admin/versiones', form);
      setForm(VACIA);
      setEditando(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrar(v) {
    if (!window.confirm(`¿Borrar la versión ${v.version}?`)) return;
    await api.delete(`/admin/versiones/${v.id}`);
    cargar();
  }

  async function pdf() {
    try {
      guardarBlob(await api.getBlob('/admin/versiones/pdf'), 'versiones.pdf');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Versiones</h1>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Registro de cambios. Los alumnos y profesores lo ven en "Novedades".</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={pdf}>Descargar PDF</button>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <form className="card" onSubmit={guardar} style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>{editando ? 'Editar versión' : 'Nueva versión'}</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="field" style={{ width: 140 }}><label>Versión</label><input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.4.0" required /></div>
          <div className="field" style={{ width: 170 }}><label>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Título</label><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
        </div>
        <div className="field"><label>Cambios (uno por línea)</label><textarea rows={5} value={form.cambios} onChange={(e) => setForm({ ...form, cambios: e.target.value })} required /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary">{editando ? 'Guardar cambios' : 'Agregar versión'}</button>
          {editando && <button type="button" className="btn btn-outline" onClick={() => { setEditando(null); setForm(VACIA); }}>Cancelar</button>}
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {versiones.map((v) => (
          <div key={v.id} className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div><strong>{v.version}</strong> — {v.titulo} <span className="text-muted">· {new Date(`${String(v.fecha).slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR')}</span></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => { setEditando(v.id); setForm({ version: v.version, titulo: v.titulo, fecha: String(v.fecha).slice(0, 10), cambios: v.cambios }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button>
                <button className="btn btn-outline btn-sm" onClick={() => borrar(v)}>Borrar</button>
              </div>
            </div>
            <ul style={{ margin: '8px 0 0' }}>{String(v.cambios).split('\n').map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        ))}
        {versiones.length === 0 && <p className="text-muted">Todavía no cargaste ninguna versión.</p>}
      </div>
    </div>
  );
}
