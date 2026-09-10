// Contexto de autenticación del sitio PÚBLICO (alumno/profesor). Guarda el
// usuario logueado y el token, persistiendo el token en localStorage (clave
// 'token') para no perder la sesión al refrescar la página.
//
// Convive con AdminAuthContext (clave 'admin_token'), que es la sesión del
// panel de administración. Son independientes: todas las llamadas de este
// archivo pasan tokenKey: 'token' explícitamente para no depender de en qué
// URL está parado el usuario en el momento — si no lo hiciéramos, y el
// usuario tuviera abierto el panel de admin (ruta /admin-panel/...), el
// selector de token por-ruta del cliente HTTP (ver api/client.js) elegiría
// 'admin_token' para este pedido y rompería la sesión pública.
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me', { tokenKey: 'token' })
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user } = await api.post('/auth/login', { email, password }, { auth: false });
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  }

  async function register(datos) {
    const { token, user } = await api.post('/auth/register', datos, { auth: false });
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  }

  function logout() {
    // Avisamos al backend para que cierre el registro de esta sesión en
    // login_logs (queda con hora de inicio y de fin). Es best-effort: si
    // falla (sin conexión, token ya vencido) igual cerramos la sesión
    // localmente, no tiene sentido bloquear el logout por esto.
    api.post('/auth/logout', {}, { tokenKey: 'token' }).catch(() => {});
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
  return ctx;
}
