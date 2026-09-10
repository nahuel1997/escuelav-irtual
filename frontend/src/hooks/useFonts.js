import { useEffect } from 'react';
import { findHeadingFont, findBodyFont } from '../config/fonts';

// Carga (una sola vez, reutilizando el mismo <link>) las tipografías de
// Google Fonts elegidas en Generales, y las expone como variables CSS
// --font-heading / --font-body que ya están enganchadas en global.css.
// Se llama desde Layout.jsx (sitio público) — el panel de admin mantiene
// su propia tipografía fija a propósito, para sentirse un área aparte.
export function useFonts(valores) {
  const tituloId = valores['general.tipografia.titulos'];
  const textoId = valores['general.tipografia.texto'];

  useEffect(() => {
    const titulo = findHeadingFont(tituloId);
    const texto = findBodyFont(textoId);

    const linkId = 'fuentes-dinamicas';
    let link = document.getElementById(linkId);
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${titulo.google}&family=${texto.google}&display=swap`;

    document.documentElement.style.setProperty('--font-heading', titulo.family);
    document.documentElement.style.setProperty('--font-body', texto.family);
  }, [tituloId, textoId]);
}
