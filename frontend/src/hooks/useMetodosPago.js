import { useEffect, useState } from 'react';
import { api } from '../api/client';

// Qué métodos de pago reales (Mercado Pago/PayPal) están configurados del
// lado del servidor (ver backend/src/services/payments.service.js). Si
// viene vacío, ni Cart.jsx ni CourseDetail.jsx muestran selector: siguen
// comprando en modo simulado como siempre, sin ningún cambio visual — el
// pago simulado nunca es una opción que el alumno "elige" a propósito
// cuando SÍ hay un método real disponible.
export function useMetodosPago() {
  const [metodos, setMetodos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments/metodos', { auth: false })
      .then((d) => setMetodos(d.metodos || []))
      .catch(() => setMetodos([])) // best effort: si falla, se sigue en modo simulado
      .finally(() => setLoading(false));
  }, []);

  return { metodos, loading };
}
