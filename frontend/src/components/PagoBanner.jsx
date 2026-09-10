import { useSearchParams } from 'react-router-dom';

// Banner de resultado de un pago real: el backend redirige acá con
// ?pago=ok|pendiente|rechazado después de que el alumno vuelve de Mercado
// Pago/PayPal (ver backend/src/controllers/payments.controller.js::retorno)
// — no hay una "página de retorno" separada, el backend manda directo a
// /mis-cursos o /tienda con este query param, así que estas dos páginas
// son las que lo leen y muestran el resultado.
const MENSAJES = {
  ok: { tipo: 'success', texto: '¡Pago confirmado! Ya podés entrar a tus cursos.' },
  pendiente: { tipo: 'info', texto: 'Tu pago está siendo procesado. Te vamos a avisar por mail apenas se confirme.' },
  rechazado: { tipo: 'error', texto: 'El pago no se pudo completar. Podés intentar de nuevo cuando quieras.' },
};

export default function PagoBanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pago = searchParams.get('pago');
  const info = pago && MENSAJES[pago];
  if (!info) return null;

  function cerrar() {
    const nuevos = new URLSearchParams(searchParams);
    nuevos.delete('pago');
    setSearchParams(nuevos, { replace: true });
  }

  return (
    <div className={`alert alert-${info.tipo}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span>{info.texto}</span>
      <button type="button" className="btn btn-outline btn-sm" onClick={cerrar}>Cerrar</button>
    </div>
  );
}
