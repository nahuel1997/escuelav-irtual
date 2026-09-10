import { useEffect } from 'react';
import { API_ORIGIN } from '../api/client';

// Actualiza el favicon del sitio público con el que se cargó en Generales
// (general.favicon). El <link rel="icon"> de index.html es estático (apunta
// a /favicon.svg), así que si el admin todavía no subió uno propio no
// tocamos nada y queda el que ya está en el HTML.
export function useFavicon(valores) {
  const favicon = valores['general.favicon'];

  useEffect(() => {
    if (!favicon) return;
    const href = favicon.startsWith('http') ? favicon : `${API_ORIGIN}${favicon}`;

    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    // Sin "type" fijo: dejamos que el navegador lo infiera de la extensión
    // real del archivo subido (puede ser .png o .svg, ver TIPOS_IMAGEN_PERMITIDOS
    // en backend/src/middlewares/upload.middleware.js).
    link.removeAttribute('type');
    link.href = href;
  }, [favicon]);
}
