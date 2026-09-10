import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { defaultsMap } from '../config/content';
import { setZonaHoraria } from '../utils/fecha';

// Trae TODO el contenido editable del sitio de un solo golpe (GET
// /api/content, público): los textos/imágenes/colores por clave, los
// links extra de menú/footer, y el registro de "opciones de botón". Se
// mezcla con los valores por defecto hardcodeados para que la página
// nunca se quede vacía si todavía no se cargó nada desde el admin.
export function useContent() {
  const [state, setState] = useState({ values: defaultsMap(), navLinks: [], buttons: [] });

  useEffect(() => {
    let cancelado = false;

    function cargar() {
      api
        .get('/content', { auth: false })
        .then(({ content: fromApi, navLinks, buttons }) => {
          if (cancelado) return;
          setState((prev) => {
            const values = { ...prev.values };
            Object.entries(fromApi || {}).forEach(([clave, valor]) => {
              if (valor) values[clave] = valor; // solo pisa si hay algo cargado
            });
            return { values, navLinks: navLinks || [], buttons: buttons || [] };
          });
        })
        .catch(() => {
          // si falla, nos quedamos con los valores que ya teníamos sin romper la página
        });
    }

    cargar();

    // El contenido lo edita el admin desde otra pestaña/sesión: sin esto,
    // una pestaña pública que ya estaba abierta no se enteraba de cambios
    // hasta que alguien la recargaba a mano (F5). Lo resolvemos liviano,
    // sin WebSocket: reconsultamos apenas la pestaña vuelve a estar visible
    // (volviste de otra pestaña/app) y, para el caso de dejarla abierta y
    // mirar sin cambiar de pestaña, con un poll de baja frecuencia mientras
    // sigue visible. GET /api/content es público y liviano, así que este
    // costo es despreciable.
    function alVolverVisible() {
      if (document.visibilityState === 'visible') cargar();
    }
    document.addEventListener('visibilitychange', alVolverVisible);
    window.addEventListener('focus', cargar);
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, 45000);

    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', alVolverVisible);
      window.removeEventListener('focus', cargar);
      clearInterval(intervalo);
    };
  }, []);

  // Mantiene utils/fecha.js al día con la zona horaria configurada por el
  // admin (ver comentario ahí de por qué es un módulo con estado global y
  // no una prop) — corre en CUALQUIER componente que llame a
  // useContent(), así que apenas carga la primera vez ya queda seteada.
  useEffect(() => {
    setZonaHoraria(state.values['general.zona_horaria']);
  }, [state.values]);

  return state;
}

// Resuelve qué "Opción N" de botón está asignada a una clave puntual
// (ej: "home.hero.boton_principal") contra el registro de buttons.
export function resolveButton(buttons, valores, clave) {
  const id = valores[clave];
  if (!id) return null;
  return buttons.find((b) => String(b.id) === String(id)) || null;
}
