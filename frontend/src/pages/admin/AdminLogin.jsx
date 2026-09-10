import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import PasswordInput from '../../components/PasswordInput';

// Login separado del login general del sitio. Usa el mismo endpoint
// (/api/auth/login) porque el usuario admin es un usuario más, pero acá
// verificamos el rol antes de dejarlo pasar: si alguien entra con una
// cuenta de alumno/profesor por este formulario, lo rechazamos y cerramos
// la sesión que se acababa de crear.
//
// Usa useAdminAuth (sesión propia, clave 'admin_token' en localStorage) en
// vez del useAuth público: así el login de admin no pisa una sesión de
// alumno/profesor que ya esté activa en el mismo navegador, y viceversa.
export default function AdminLogin() {
  const { login, logout } = useAdminAuth();
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
      if (user.rol !== 'admin') {
        logout();
        throw new Error('Esta cuenta no tiene permisos de administrador.');
      }
      navigate('/admin-panel', { replace: true });
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
        <span className="badge">Panel de administración</span>
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
          Demo: admin@escuela.demo / 123456
        </p>
      </div>
    </div>
  );
}
