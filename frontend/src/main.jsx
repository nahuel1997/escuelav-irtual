import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import { SupportAuthProvider } from './context/SupportAuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Afuera de todo lo demás: si algo rompe el render (bug de un
        componente, error de contexto, lo que sea) el usuario ve una
        pantalla clara en vez de una pantalla en blanco. */}
    <ErrorBoundary>
      <BrowserRouter>
        {/* AuthProvider (sitio público, clave 'token'), AdminAuthProvider
            (panel de admin, clave 'admin_token') y SupportAuthProvider
            (panel de soporte, clave 'soporte_token') se montan los tres
            juntos, siempre, durante toda la vida de la app. Son
            independientes: cada uno guarda su propia sesión, así que se
            puede estar logueado como alumno/profesor Y como admin Y como
            soporte al mismo tiempo en el mismo navegador sin que uno pise
            a otro. CartProvider va adentro de AuthProvider porque necesita
            saber quién está logueado (el carrito es personal de cada
            cuenta). */}
        <AuthProvider>
          <CartProvider>
            <AdminAuthProvider>
              <SupportAuthProvider>
                <App />
              </SupportAuthProvider>
            </AdminAuthProvider>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
