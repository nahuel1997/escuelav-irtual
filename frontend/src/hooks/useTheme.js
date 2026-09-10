import { useEffect } from 'react';

// Aplica los colores de marca elegidos en Generales (/admin-panel/contenido)
// como variables CSS en :root. global.css ya define estas mismas variables
// con sus valores por defecto (--color-primary, --color-accent,
// --color-dark-bg, --color-dark-text) y todo lo que las usa — botones sin
// una "Opción" de color asignada, la clase .section-dark que pinta el
// Footer y el cierre oscuro de Home, etc. — se actualiza solo, sin tocar
// esos componentes.
//
// Mismo patrón que useFonts(): si el admin no cargó un color para alguna
// clave, no tocamos esa variable y queda el valor por defecto del CSS.
export function useTheme(valores) {
  const primario = valores['general.color_primario'];
  const acento = valores['general.color_acento'];
  const fondoOscuro = valores['general.color_fondo_oscuro'];
  const textoOscuro = valores['general.color_texto_oscuro'];

  useEffect(() => {
    const root = document.documentElement.style;
    if (primario) root.setProperty('--color-primary', primario);
    if (acento) root.setProperty('--color-accent', acento);
    if (fondoOscuro) root.setProperty('--color-dark-bg', fondoOscuro);
    if (textoOscuro) root.setProperty('--color-dark-text', textoOscuro);
  }, [primario, acento, fondoOscuro, textoOscuro]);
}
