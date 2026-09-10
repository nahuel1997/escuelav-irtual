// Contexto del carrito de compras. Solo tiene sentido para el sitio
// público (alumno comprando cursos), así que se monta junto a AuthProvider
// en main.jsx, no en el panel de admin.
//
// Dos modos, según haya sesión o no:
//   - Logueado: el carrito vive en la base de datos (ver
//     backend/src/models/cart.model.js) — este contexto solo cachea en
//     memoria lo que ya devolvió la API.
//   - Invitado (sin sesión): no hay a quién asociarle un carrito en el
//     server, así que se guarda como una lista de ids de curso en
//     localStorage. Los datos de cada curso (título, precio, imagen) se
//     piden al catálogo público (GET /courses/:id) para poder mostrarlos
//     igual que un carrito real. Apenas el invitado inicia sesión, esos
//     ids se agregan al carrito de su cuenta uno por uno (mejor esfuerzo:
//     si alguno ya no está disponible o ya lo tenía comprado, se ignora
//     sin romper el resto) y se borran de localStorage — el carrito
//     "sigue" a la cuenta sin que el alumno pierda lo que había juntado
//     antes de loguearse.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const GUEST_KEY = 'carrito_invitado_ids';

function leerIdsInvitado() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch (_e) {
    return [];
  }
}

function guardarIdsInvitado(ids) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(ids));
  } catch (_e) {
    // localStorage lleno/deshabilitado: el carrito de invitado no persiste
    // entre visitas, pero no rompe la sesión actual.
  }
}

// Trae los datos completos de cada curso por id (el catálogo público ya
// filtra los que no están "subido", así que un curso que se dio de baja
// mientras estaba en el carrito de invitado simplemente desaparece solo).
async function cargarCursosPorId(ids) {
  if (ids.length === 0) return [];
  const resultados = await Promise.all(
    ids.map((id) => api.get(`/courses/${id}`, { auth: false }).then((d) => d.course).catch(() => null))
  );
  return resultados.filter((c) => c && c.estado === 'subido');
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  // Estado del panel lateral (CartDrawer.jsx), a propósito acá y no en un
  // useState local del componente: el ícono del carrito vive en el Navbar,
  // pero el panel se monta una sola vez en Layout.jsx para poder abrirse
  // desde cualquier página — necesitan compartir el mismo estado "abierto".
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const abrirDrawer = useCallback(() => setDrawerAbierto(true), []);
  const cerrarDrawer = useCallback(() => setDrawerAbierto(false), []);
  const toggleDrawer = useCallback(() => setDrawerAbierto((v) => !v), []);

  const refrescar = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        setItems(await cargarCursosPorId(leerIdsInvitado()));
        return;
      }
      const { items: nuevos } = await api.get('/cart', { tokenKey: 'token' });
      setItems(nuevos);
    } catch (_e) {
      // Best effort: si falla (ej: sesión vencida), simplemente no se
      // actualiza el carrito — no tiene sentido romper la navegación por
      // esto.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  // Fusión del carrito de invitado apenas hay sesión — ver comentario del
  // archivo. Corre una sola vez por login real (si ya no queda nada en
  // localStorage, no hace ninguna llamada de más).
  useEffect(() => {
    if (!user) return;
    const idsInvitado = leerIdsInvitado();
    if (idsInvitado.length === 0) return;
    (async () => {
      for (const courseId of idsInvitado) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await api.post('/cart/items', { course_id: courseId }, { tokenKey: 'token' });
        } catch (_e) {
          // Ya inscripto, ya en el carrito, o el curso dejó de estar
          // disponible — se ignora ese ítem puntual y se sigue con el resto.
        }
      }
      guardarIdsInvitado([]);
      refrescar();
    })();
    // Solo debe correr cuando cambia el usuario (login/logout), no en cada
    // render de refrescar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function agregar(courseId) {
    if (!user) {
      const ids = leerIdsInvitado();
      if (!ids.includes(courseId)) {
        const nuevos = [...ids, courseId];
        guardarIdsInvitado(nuevos);
        setItems(await cargarCursosPorId(nuevos));
      }
      return;
    }
    const { items: nuevos } = await api.post('/cart/items', { course_id: courseId }, { tokenKey: 'token' });
    setItems(nuevos);
  }

  async function quitar(courseId) {
    if (!user) {
      const nuevos = leerIdsInvitado().filter((id) => id !== courseId);
      guardarIdsInvitado(nuevos);
      setItems(await cargarCursosPorId(nuevos));
      return;
    }
    const { items: nuevos } = await api.delete(`/cart/items/${courseId}`, { tokenKey: 'token' });
    setItems(nuevos);
  }

  // El checkout de verdad siempre necesita una cuenta (hay que saber a
  // quién inscribir) — quien llama a esto (Cart.jsx) ya se encarga de
  // mandar a /ingresar en vez de invocar checkout() si todavía no hay
  // sesión, mismo criterio que "Comprar ahora" en CourseDetail.jsx.
  //
  // `metodoPago` es opcional. Sin él: pago simulado de siempre, el backend
  // ya inscribió al llegar la respuesta, así que acá vaciamos el carrito
  // en el estado local. Con un método real: la respuesta trae
  // `{ redirect: true, redirectUrl }` — todavía no se inscribió nada (eso
  // pasa recién cuando el alumno confirma el pago en la pasarela), así que
  // el carrito local NO se vacía acá; quien llama (Cart.jsx) es quien
  // redirige el navegador a `redirectUrl`.
  async function checkout(metodoPago) {
    const body = metodoPago ? { metodo_pago: metodoPago } : {};
    const resultado = await api.post('/cart/checkout', body, { tokenKey: 'token' });
    if (!resultado.redirect) setItems([]);
    return resultado;
  }

  return (
    <CartContext.Provider value={{
      items, loading, refrescar, agregar, quitar, checkout,
      drawerAbierto, abrirDrawer, cerrarDrawer, toggleDrawer,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de un <CartProvider>');
  return ctx;
}
