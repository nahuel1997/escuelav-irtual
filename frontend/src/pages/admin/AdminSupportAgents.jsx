import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// Alta de cuentas de soporte — mismo patrón que AdminTeachers.jsx (única
// forma de crear estas cuentas; no hay registro público). Reutiliza el
// mismo endpoint genérico de siempre (POST /api/admin/users, ya
// parametrizado por rol) con rol: "soporte".
export default function AdminSupportAgents() {
  const [agentes, setAgentes] = useState([]);
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '' });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function cargar() {
    return api.get('/admin/users?rol=soporte').then((d) => setAgentes(d.users));
  }

  useEffect(() => { cargar(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setCreando(true);
    setError('');
    setOk('');
    try {
      await api.post('/admin/users', { ...form, rol: 'soporte' });
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
      <h1>Agentes de soporte</h1>
      <p className="text-muted">
        Cuentas que pueden entrar al chat en vivo desde <code>/soporte</code>. Cualquier agente ve y puede responder
        cualquier chat abierto (cola compartida, no hay asignación exclusiva).
      </p>

      <div className="grid grid-2" style={{ alignItems: 'start', gap: 24, marginTop: 16 }}>
        <div className="card">
          <h3>Nuevo agente de soporte</h3>
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
            <button className="btn btn-primary" disabled={creando}>{creando ? 'Creando…' : 'Crear agente'}</button>
          </form>
        </div>

        <div className="card">
          <h3>Agentes actuales</h3>
          <table>
            <thead><tr><th>Nombre</th><th>Email</th></tr></thead>
            <tbody>
              {agentes.map((a) => (
                <tr key={a.id}><td>{a.nombre} {a.apellido}</td><td>{a.email}</td></tr>
              ))}
              {agentes.length === 0 && <tr><td colSpan={2} className="text-muted">Sin agentes de soporte todavía.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
