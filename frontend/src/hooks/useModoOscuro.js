import { useCallback, useEffect, useState } from 'react';
import { useEstadoPublico } from './useEstadoPublico';

const CLAVE = 'modo_oscuro';

function leerPreferencia() {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

// Preferencia compartida entre todos los componentes que usan el hook (el
// Layout la aplica, la barra superior la cambia).
let preferenciaGlobal = leerPreferencia();
const oyentes = new Set();

function setPreferenciaGlobal(valor) {
  preferenciaGlobal = valor;
  try { localStorage.setItem(CLAVE, valor ? '1' : '0'); } catch { /* sin storage */ }
  oyentes.forEach((fn) => fn(valor));
}

// Modo oscuro por inversión de colores (ver .modo-oscuro en global.css).
// El admin decide si está disponible, si arranca prendido y la intensidad;
// cada persona lo prende o apaga para sí (se recuerda en el navegador).
export function useModoOscuro() {
  const estado = useEstadoPublico();
  const cfg = (estado && estado.modo_oscuro) || { habilitado: false };
  const [preferencia, setPreferencia] = useState(preferenciaGlobal);

  useEffect(() => {
    oyentes.add(setPreferencia);
    return () => oyentes.delete(setPreferencia);
  }, []);

  const activo = Boolean(cfg.habilitado) && (preferencia === null ? Boolean(cfg.porDefectoActivo) : preferencia);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('modo-oscuro', activo);
    if (activo) {
      html.style.setProperty('--mo-intensidad', String((cfg.intensidad || 90) / 100));
      html.style.setProperty('--mo-contraste', String((cfg.contraste || 95) / 100));
    }
  }, [activo, cfg.intensidad, cfg.contraste]);

  const alternar = useCallback(() => setPreferenciaGlobal(!activo), [activo]);

  return { disponible: Boolean(cfg.habilitado), activo, alternar };
}
