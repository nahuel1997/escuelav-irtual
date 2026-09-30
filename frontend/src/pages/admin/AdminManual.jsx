import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import TextoManual from '../../components/TextoManual';

const ROLES = { admin: 'Admin', alumno: 'Alumnos', profesor: 'Profesores', soporte: 'Soporte' };
const VACIA = { rol: 'alumno', titulo: '', contenido: '', orden: 0 };

// Admin → Manual: el manual de uso de cada rol, editable. Los alumnos,
// profesores y agentes ven el suyo en "Manual".
export default function AdminManual() {
  const [secciones, setSecciones] = useState([]);
  const [rol, setRol] = useState('admin');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/admin/manual').then((d) => setSecciones(d.secciones));
  useEffect(() => { cargar(); }, []);

  async function guardar(e) {
    e.preventDefault();
    setError('');
    try {
      if (form.id) await api.put(`/admin/manual/${form.id}`, form);
      else await api.post('/admin/manual', form);
      setForm(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrar(s) {
    if (!window.confirm(`¿Borrar "${s.titulo}"?`)) return;
    await api.delete(`/admin/manual/${s.id}`);
    cargar();
  }

  const delRol = secciones.filter((s) => s.rol === rol);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Manual</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({ ...VACIA, rol, orden: delRol.length ? Math.max(...delRol.map((s) => s.orden)) + 1 : 0 })}>+ Sección</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
        {Object.entries(ROLES).map(([k, v]) => <button key={k} className={`btn btn-sm ${rol === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRol(k)}>{v}</button>)}
      </div>

      {form && (
        <form className="card" onSubmit={guardar} style={{ marginTop: 16 }}>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 140 }}><label>Para</label><select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Título</label><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div className="field" style={{ width: 90 }}><label>Orden</label><input type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div>
          </div>
          <div className="field"><label>Contenido (un párrafo por línea)</label><textarea rows={6} value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} required /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary">Guardar</button>
            <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {delRol.map((s) => (
          <div key={s.id} className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ margin: 0 }}>{s.titulo}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ id: s.id, rol: s.rol, titulo: s.titulo, contenido: s.contenido, orden: s.orden })}>Editar</button>
                <button className="btn btn-outline btn-sm" onClick={() => borrar(s)}>Borrar</button>
              </div>
            </div>
            <div style={{ marginTop: 8 }}><TextoManual texto={s.contenido} /></div>
          </div>
        ))}
        {delRol.length === 0 && <p className="text-muted">Sin secciones para este rol.</p>}
      </div>
    </div>
  );
}
