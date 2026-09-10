import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Página de aterrizaje de un launch de LTI: el backend ya validó todo
// (id_token firmado por el LMS, nonce, deployment) y nos mandó acá con un
// código de un solo uso en la URL — esta pantalla lo cambia por la sesión
// real (POST /lti/exchange) y entra directo al curso conectado, sin que
// el alumno tenga que loguearse a mano.
export default function LtiLanding() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      setError('Falta el código de acceso — volvé a entrar desde el LMS.');
      return;
    }
    api.post('/lti/exchange', { code }, { auth: false })
      .then(({ token, user, redirectTo }) => {
        localStorage.setItem('token', token);
        setUser(user);
        navigate(redirectTo || '/panel', { replace: true });
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 480, textAlign: 'center' }}>
        {!error ? (
          <>
            <h1>Entrando…</h1>
            <p className="text-muted">Estamos conectando tu sesión desde el LMS.</p>
          </>
        ) : (
          <>
            <h1>No pudimos completar el acceso</h1>
            <div className="alert alert-error">{error}</div>
          </>
        )}
      </div>
    </section>
  );
}
