import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_ORIGIN } from '../../api/client';
import { ESTADOS_CURSO, ESTADO_CURSO_INFO } from '../../config/estadosCurso';

const vacio = { titulo: '', descripcion: '', precio: '', categoria: '', profesor_id: '', imagen_url: '', estado: 'subido' };

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [editando, setEditando] = useState(null); // id del curso en edición, o 'nuevo'
  const [form, setForm] = useState(vacio);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function cargar() {
    return Promise.all([
      api.get('/admin/courses'),
      api.get('/admin/users?rol=profesor'),
      api.get('/courses/categories', { auth: false }),
    ]).then(([c, p, cat]) => {
      setCourses(c.courses);
      setProfesores(p.users);
      setCategorias(cat.categorias);
    });
  }

  useEffect(() => { cargar(); }, []);

  function abrirNuevo() {
    setForm(vacio);
    setEditando('nuevo');
    setError('');
  }

  function abrirEdicion(curso) {
    setForm({
      titulo: curso.titulo,
      descripcion: curso.descripcion,
      precio: curso.precio,
      categoria: curso.categoria || '',
      profesor_id: curso.profesor_id || '',
      imagen_url: curso.imagen_url || '',
      estado: curso.estado || 'subido',
    });
    setEditando(curso.id);
    setError('');
  }

  async function handleImagen(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSubiendoImagen(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('imagen', file);
      const { url } = await api.postForm('/admin/upload-imagen', formData);
      setForm((f) => ({ ...f, imagen_url: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendoImagen(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const payload = { ...form, precio: Number(form.precio) || 0 };
      if (editando === 'nuevo') {
        await api.post('/admin/courses', payload);
      } else {
        await api.put(`/admin/courses/${editando}`, payload);
      }
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // La categoría de un curso viejo puede no estar en la lista fija actual
  // (se agregó recién — antes era texto libre). Si pasa, la agregamos como
  // opción extra para no perderla/pisarla sin querer al guardar otra cosa.
  const opcionesCategoria = form.categoria && !categorias.includes(form.categoria)
    ? [form.categoria, ...categorias]
    : categorias;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Cursos</h1>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo curso</button>
      </div>

      {editando && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{editando === 'nuevo' ? 'Nuevo curso' : 'Editar curso'}</h3>
            {editando !== 'nuevo' && (
              // Antes había que cancelar este form y buscar el botón
              // "Contenido" en la fila del curso, en la tabla de más abajo
              // — acceso directo desde acá, sin tener que ir y volver.
              <Link to={`/admin-panel/cursos/${editando}/temario`} className="btn btn-outline btn-sm">
                Editar contenido del curso →
              </Link>
            )}
          </div>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label>Título</label>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Precio</label>
              <input type="number" min="0" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
            </div>
            <div className="field">
              <label>Categoría</label>
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="">Sin categoría</option>
                {opcionesCategoria.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Profesor a cargo</label>
              <select value={form.profesor_id} onChange={(e) => setForm({ ...form, profesor_id: e.target.value })} required>
                <option value="">Elegir profesor…</option>
                {profesores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                ))}
              </select>
              {profesores.length === 0 && (
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Todavía no hay profesores creados.</p>
              )}
            </div>
            <div className="field">
              <label>Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_CURSO.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
              <p className="text-muted" style={{ fontSize: '0.78rem', margin: '4px 0 0' }}>
                {form.estado === 'subido' && 'Visible en la tienda y se puede comprar.'}
                {form.estado === 'en_revision' && 'No aparece en la tienda ni se puede comprar todavía.'}
                {form.estado === 'cancelado' && 'No se puede comprar más, pero quien ya lo compró sigue con acceso.'}
                {form.estado === 'fuera_sistema' && 'No lo ve nadie — ni en la tienda ni quien ya lo había comprado.'}
              </p>
            </div>
          </div>
          <div className="field">
            <label>Imagen de portada</label>
            <input type="file" accept="image/*" onChange={handleImagen} />
            {subiendoImagen && <p className="text-muted" style={{ fontSize: '0.8rem' }}>Subiendo imagen…</p>}
            {form.imagen_url && (
              <img src={`${API_ORIGIN}${form.imagen_url}`} alt="Portada del curso" style={{ maxWidth: 200, borderRadius: 8, marginTop: 6 }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" className="btn btn-outline" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Curso</th><th>Categoría</th><th>Precio</th><th>Profesor</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {courses.map((c) => {
              const profesor = profesores.find((p) => p.id === c.profesor_id);
              const estadoInfo = ESTADO_CURSO_INFO[c.estado] || ESTADO_CURSO_INFO.subido;
              return (
                <tr key={c.id}>
                  <td>{c.titulo}</td>
                  <td>{c.categoria || '—'}</td>
                  <td>${c.precio}</td>
                  <td>{profesor ? `${profesor.nombre} ${profesor.apellido}` : '—'}</td>
                  <td><span className={`badge ${estadoInfo.badge}`}>{estadoInfo.label}</span></td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => abrirEdicion(c)}>Editar</button>
                    <Link to={`/admin-panel/cursos/${c.id}/temario`} className="btn btn-outline btn-sm">Contenido</Link>
                  </td>
                </tr>
              );
            })}
            {courses.length === 0 && <tr><td colSpan={6} className="text-muted">Todavía no hay cursos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
