import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// El registro público ya no permite crear cuentas de profesor: el admin
// es quien las da de alta acá.
export default function AdminTeachers() {
  const [profesores, setProfesores] = useState([]);
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '' });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function cargar() {
    return api.get('/admin/users?rol=profesor').then((d) => setProfesores(d.users));
  }

  useEffect(() => { cargar(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setCreando(true);
    setError('');
    setOk('');
    try {
      await api.post('/admin/users', { ...form, rol: 'profesor' });
      setOk(`Cuenta creada para ${form.nombre} ${form.apellido}.`);
      setForm({ nombre: '', apellido: '', email: '', password: '' });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div>
      <h1>Profesores</h1>

      <div className="grid grid-2" style={{ alignItems: 'start', gap: 24 }}>
        <div className="card">
          <h3>Nuevo profesor</h3>
          {error && <div className="alert alert-error">{error}</div>}
          {ok && <div className="alert alert-success">{ok}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="field">
              <label>Apellido</label>
              <input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Contraseña (mínimo 6 caracteres)</label>
              <input type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button className="btn btn-primary" disabled={creando}>{creando ? 'Creando…' : 'Crear profesor'}</button>
          </form>
        </div>

        <div className="card">
          <h3>Profesores actuales</h3>
          <table>
            <thead><tr><th>Nombre</th><th>Email</th></tr></thead>
            <tbody>
              {profesores.map((p) => (
                <tr key={p.id}><td>{p.nombre} {p.apellido}</td><td>{p.email}</td></tr>
              ))}
              {profesores.length === 0 && <tr><td colSpan={2} className="text-muted">Sin profesores todavía.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
