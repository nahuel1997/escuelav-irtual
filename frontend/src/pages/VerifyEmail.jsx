import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Pantalla para ingresar el código de 6 dígitos que llega por mail al
// registrarse. No es un gate de acceso (el usuario ya está logueado desde
// que se registró, ver auth.controller.js) — es un paso aparte, accesible
// desde el banner de "validá tu cuenta" en /panel.
export default function VerifyEmail() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [mensajeReenvio, setMensajeReenvio] = useState('');

  if (user?.email_verificado) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="alert alert-success">Tu cuenta ya está validada.</div>
          <Link to="/panel" className="btn btn-primary">Ir a mi panel</Link>
        </div>
      </section>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/auth/verify-email', { codigo }, { tokenKey: 'token' });
      const { user: actualizado } = await api.get('/auth/me', { tokenKey: 'token' });
      setUser(actualizado);
      setOk(true);
      setTimeout(() => navigate('/panel'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar() {
    setReenviando(true);
    setError('');
    setMensajeReenvio('');
    try {
      await api.post('/auth/resend-verification', {}, { tokenKey: 'token' });
      setMensajeReenvio('Te mandamos un código nuevo.');
    } catch (err) {
      setError(err.message);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 420 }}>
        <h1>Validá tu cuenta</h1>
        <p className="text-muted">Te mandamos un código de 6 dígitos a {user?.email}. Ingresalo acá abajo.</p>

        {error && <div className="alert alert-error">{error}</div>}
        {ok && <div className="alert alert-success">¡Cuenta validada! Redirigiendo…</div>}
        {mensajeReenvio && <div className="alert alert-success">{mensajeReenvio}</div>}

        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="codigo">Código</label>
            <input
              id="codigo"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              style={{ fontSize: '1.4rem', letterSpacing: 6, textAlign: 'center' }}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={enviando || codigo.length !== 6}>
            {enviando ? 'Validando…' : 'Validar cuenta'}
          </button>
        </form>

        <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={handleReenviar} disabled={reenviando}>
          {reenviando ? 'Enviando…' : 'Reenviar código'}
        </button>
      </div>
    </section>
  );
}
