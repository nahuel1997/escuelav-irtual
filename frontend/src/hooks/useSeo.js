import { useEffect } from 'react';

// Aplica el título de pestaña y la meta descripción de una página pública,
// leyendo `<pagina>.seo.titulo` / `<pagina>.seo.descripcion` de
// `valores` (lo que devuelve useContent()), con fallback al sufijo y a la
// descripción por defecto cargados en "Generales".
export function useSeo(valores, pagina, tituloFallback) {
  useEffect(() => {
    const sufijo = valores['general.seo.sufijo'] || 'Escuela Online';
    const tituloPagina = valores[`${pagina}.seo.titulo`] || tituloFallback;
    document.title = tituloPagina ? `${tituloPagina} — ${sufijo}` : sufijo;

    const descripcion = valores[`${pagina}.seo.descripcion`] || valores['general.seo.descripcion_default'];
    if (descripcion) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = descripcion;
    }
  }, [valores, pagina, tituloFallback]);
}
