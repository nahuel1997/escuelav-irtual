import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useContent, resolveButton } from '../hooks/useContent';
import { useSeo } from '../hooks/useSeo';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { values: content, buttons } = useContent();
  useSeo(content, 'login', 'Ingresar');
  const botonIngresar = resolveButton(buttons, content, 'login.boton_ingresar');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const user = await login(form.email, form.password);
      // Las cuentas de soporte son para el panel /soporte, no para el
      // sitio público (mismo criterio que AdminLogin.jsx en el sentido
      // inverso): si alguien entra acá con una, la rechazamos y cerramos
      // la sesión que se acababa de crear, para no confundirla con una
      // cuenta de alumno/profesor.
      if (user.rol === 'soporte') {
        logout();
        throw new Error('Esta cuenta es de soporte — ingresá desde /soporte en cambio.');
      }
      const destino = location.state?.from?.pathname || '/panel';
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="section" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: 420 }}>
        <h1>Ingresar</h1>
        <form onSubmit={handleSubmit} className="card">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <PasswordInput
              id="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={cargando}
            style={{ width: '100%', ...(botonIngresar ? { background: botonIngresar.color_fondo, color: botonIngresar.color_texto } : {}) }}
          >
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="text-muted" style={{ marginTop: 16 }}>
          ¿No tenés cuenta? <Link to="/registrarme">Registrate acá</Link>
        </p>
        <p className="text-muted" style={{ fontSize: '0.8rem' }}>
          Demo: alumno@escuela.demo / profesora@escuela.demo — contraseña 123456
        </p>
      </div>
    </section>
  );
}
