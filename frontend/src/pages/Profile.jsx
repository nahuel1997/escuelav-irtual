import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ nombre: user.nombre, apellido: user.apellido });
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setOk(false);
    try {
      const { user: actualizado } = await api.put('/users/profile', form);
      setUser(actualizado);
      setOk(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 480 }}>
        <h1>Mi perfil</h1>
        <form onSubmit={handleSubmit} className="card">
          {ok && <div className="alert alert-success">Perfil actualizado.</div>}
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label>Email</label>
            <input value={user.email} disabled />
          </div>
          <div className="field">
            <label>Rol</label>
            <input value={user.rol} disabled />
          </div>
          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="apellido">Apellido</label>
            <input id="apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </section>
  );
}
