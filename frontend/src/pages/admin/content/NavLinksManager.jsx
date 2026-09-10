import { useEffect, useState } from 'react';
import { api } from '../../../api/client';

// CRUD de links extra de menú/footer (además de la navegación funcional
// que vive en código — ver Navbar.jsx). Se puede agregar, editar y borrar.
export default function NavLinksManager() {
  const [links, setLinks] = useState([]);
  const [nuevo, setNuevo] = useState({ ubicacion: 'menu', texto: '', url: '' });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  function cargar() {
    return api.get('/admin/nav-links').then((d) => setLinks(d.links));
  }

  useEffect(() => { cargar(); }, []);

  async function crear(e) {
    e.preventDefault();
    setCreando(true);
    setError('');
    try {
      await api.post('/admin/nav-links', nuevo);
      setNuevo({ ubicacion: 'menu', texto: '', url: '' });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  function actualizarLocal(id, patch) {
    setLinks(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function guardarFila(link) {
    await api.put(`/admin/nav-links/${link.id}`, { texto: link.texto, url: link.url, ubicacion: link.ubicacion });
    await cargar();
  }

  async function borrar(id) {
    await api.delete(`/admin/nav-links/${id}`);
    await cargar();
  }

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={crear} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Ubicación</label>
          <select value={nuevo.ubicacion} onChange={(e) => setNuevo({ ...nuevo, ubicacion: e.target.value })}>
            <option value="menu">Menú (navbar)</option>
            <option value="footer">Pie de página</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Texto</label>
          <input value={nuevo.texto} onChange={(e) => setNuevo({ ...nuevo, texto: e.target.value })} required />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
          <label>Link (interno como /tienda, o https://...)</label>
          <input value={nuevo.url} onChange={(e) => setNuevo({ ...nuevo, url: e.target.value })} required />
        </div>
        <button className="btn btn-primary btn-sm" disabled={creando}>{creando ? '...' : 'Agregar link'}</button>
      </form>

      <table>
        <thead><tr><th>Ubicación</th><th>Texto</th><th>Link</th><th></th></tr></thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.id}>
              <td>
                <select value={l.ubicacion} onChange={(e) => actualizarLocal(l.id, { ubicacion: e.target.value })}>
                  <option value="menu">Menú</option>
                  <option value="footer">Footer</option>
                </select>
              </td>
              <td><input value={l.texto} onChange={(e) => actualizarLocal(l.id, { texto: e.target.value })} /></td>
              <td><input value={l.url} onChange={(e) => actualizarLocal(l.id, { url: e.target.value })} style={{ minWidth: 180 }} /></td>
              <td style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                <button className="btn btn-outline btn-sm" onClick={() => guardarFila(l)}>Guardar</button>
                <button className="btn btn-danger btn-sm" onClick={() => borrar(l.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {links.length === 0 && <tr><td colSpan={4} className="text-muted">Todavía no cargaste links extra.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
