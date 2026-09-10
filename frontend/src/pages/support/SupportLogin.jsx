import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupportAuth } from '../../context/SupportAuthContext';
import PasswordInput from '../../components/PasswordInput';

// Login separado, mismo patrón que AdminLogin.jsx: usa el mismo endpoint
// (/api/auth/login, cualquier cuenta es "un usuario más") pero acá
// verificamos el rol antes de dejar pasar — si alguien entra con una
// cuenta que no es de soporte, lo rechazamos y cerramos la sesión que se
// acababa de crear.
export default function SupportLogin() {
  const { login, logout } = useSupportAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const user = await login(form.email, form.password);
      if (user.rol !== 'soporte') {
        logout();
        throw new Error('Esta cuenta no tiene permisos de soporte.');
      }
      navigate('/soporte', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-dark-bg)',
      }}
    >
      <div className="card" style={{ width: 360, background: '#152537' }}>
        <span className="badge">Panel de soporte</span>
        <h2 style={{ color: '#fff', marginTop: 8 }}>Ingresar</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label style={{ color: '#fff' }}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="field">
            <label style={{ color: '#fff' }}>Contraseña</label>
            <PasswordInput
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              dark
              required
            />
          </div>
          <button type="submit" className="btn btn-accent" disabled={cargando} style={{ width: '100%' }}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>
          Las cuentas de soporte las crea un administrador desde /admin-panel/soporte.
        </p>
      </div>
    </div>
  );
}
