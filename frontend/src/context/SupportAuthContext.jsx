// Contexto de autenticación PROPIO del panel de soporte (/soporte).
// Mismo patrón que AdminAuthContext (clave propia de localStorage,
// 'soporte_token', independiente de 'token' y 'admin_token') — así se
// puede tener sesión de alumno/profesor, de admin y de soporte abiertas
// al mismo tiempo en el mismo navegador sin que una pise a la otra. El
// cliente HTTP (api/client.js) decide con cuál token pegarle a la API
// mirando si la ruta actual empieza con /soporte.
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const SupportAuthContext = createContext(null);

export function SupportAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('soporte_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me', { tokenKey: 'soporte_token' })
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('soporte_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user } = await api.post('/auth/login', { email, password }, { auth: false });
    localStorage.setItem('soporte_token', token);
    setUser(user);
    return user;
  }

  function logout() {
    api.post('/auth/logout', {}, { tokenKey: 'soporte_token' }).catch(() => {});
    localStorage.removeItem('soporte_token');
    setUser(null);
  }

  return (
    <SupportAuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </SupportAuthContext.Provider>
  );
}

export function useSupportAuth() {
  const ctx = useContext(SupportAuthContext);
  if (!ctx) throw new Error('useSupportAuth debe usarse dentro de un <SupportAuthProvider>');
  return ctx;
}
