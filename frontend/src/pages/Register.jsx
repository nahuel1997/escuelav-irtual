import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useContent, resolveButton } from '../hooks/useContent';
import { useSeo } from '../hooks/useSeo';
import PasswordInput from '../components/PasswordInput';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { values: content, buttons } = useContent();
  useSeo(content, 'registro', 'Crear cuenta');
  const botonCrear = resolveButton(buttons, content, 'registro.boton_crear');
  // El registro público solo crea cuentas de alumno. Las cuentas de
  // profesor (y de admin) las crea un administrador desde el panel.
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await register(form);
      navigate('/panel', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="section" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: 460 }}>
        <h1>Crear cuenta</h1>
        <form onSubmit={handleSubmit} className="card">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" value={form.nombre} onChange={handleChange} required />
            </div>
            <div className="field">
              <label htmlFor="apellido">Apellido</label>
              <input id="apellido" name="apellido" value={form.apellido} onChange={handleChange} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña (mínimo 6 caracteres)</label>
            <PasswordInput
              id="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={cargando}
            style={{ width: '100%', ...(botonCrear ? { background: botonCrear.color_fondo, color: botonCrear.color_texto } : {}) }}
          >
            {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="text-muted" style={{ marginTop: 16 }}>
          ¿Ya tenés cuenta? <Link to="/ingresar">Ingresá acá</Link>
        </p>
      </div>
    </section>
  );
}
