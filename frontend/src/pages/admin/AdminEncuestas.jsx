import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const TIPOS = { escala: 'Escala 1 a 5', si_no: 'Sí / No', texto: 'Texto libre' };

// Admin → Encuestas: las preguntas de la encuesta de satisfacción que los
// alumnos responden por cada curso. Los resultados están en Reportes.
export default function AdminEncuestas() {
  const [preguntas, setPreguntas] = useState([]);
  const [nueva, setNueva] = useState({ texto: '', tipo: 'escala' });
  const [error, setError] = useState('');

  const cargar = () => api.get('/admin/encuestas/preguntas').then((d) => setPreguntas(d.preguntas));
  useEffect(() => { cargar(); }, []);

  async function accion(fn) {
    setError('');
    try {
      await fn();
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1 style={{ margin: 0 }}>Encuesta de satisfacción</h1>
      <p className="text-muted" style={{ margin: '4px 0 0' }}>Cada alumno la responde una vez por curso (desde "Encuestas"). Los resultados están en Reportes → Encuestas.</p>
      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      <form className="card" style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
        onSubmit={(e) => { e.preventDefault(); accion(async () => { await api.post('/admin/encuestas/preguntas', { ...nueva, orden: preguntas.length + 1 }); setNueva({ texto: '', tipo: 'escala' }); }); }}>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 260 }}><label>Nueva pregunta</label><input value={nueva.texto} onChange={(e) => setNueva({ ...nueva, texto: e.target.value })} maxLength={300} required /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Tipo</label><select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="btn btn-primary btn-sm">Agregar</button>
      </form>
      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Orden</th><th>Pregunta</th><th>Tipo</th><th>Activa</th><th></th></tr></thead>
          <tbody>
            {preguntas.map((p) => (
              <tr key={p.id}>
                <td>{p.orden}</td>
                <td>{p.texto}</td>
                <td>{TIPOS[p.tipo]}</td>
                <td><input type="checkbox" checked={p.activa} onChange={(e) => accion(() => api.put(`/admin/encuestas/preguntas/${p.id}`, { activa: e.target.checked }))} aria-label="Activa" /></td>
                <td><button className="btn btn-outline btn-sm" onClick={() => window.confirm('¿Borrar la pregunta?') && accion(() => api.delete(`/admin/encuestas/preguntas/${p.id}`))}>Borrar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Una pregunta que ya tiene respuestas no se puede borrar ni cambiar de tipo: desactivala.</p>
      </div>
    </div>
  );
}
