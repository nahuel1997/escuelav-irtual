const NOMBRE = { mercadopago: 'Mercado Pago', paypal: 'PayPal' };

// Un botón por cada método real configurado — nunca un radio "elegí uno y
// después confirmá": clickear el botón ES la acción, redirige directo a la
// pasarela (ver Cart.jsx/CourseDetail.jsx). No incluye "pago simulado"
// como opción a propósito (ver useMetodosPago.js).
export default function MetodoPagoSelector({ metodos, onElegir, disabled }) {
  if (metodos.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {metodos.map((metodo) => (
        <button
          key={metodo}
          type="button"
          className="btn btn-accent"
          disabled={disabled}
          onClick={() => onElegir(metodo)}
        >
          Pagar con {NOMBRE[metodo] || metodo}
        </button>
      ))}
    </div>
  );
}
