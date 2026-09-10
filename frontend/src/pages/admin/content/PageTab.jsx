import CampoField from './CampoField';

// Sub-pestaña genérica para una página pública (Home, Contacto, Tienda,
// etc.): renderiza todos sus campos definidos en config/content.js. Es la
// misma para todas las páginas — lo que cambia es qué campos trae cada una.
export default function PageTab({ pagina, valores, botones, guardarCampo, subirImagen }) {
  return (
    <div>
      <h2>{pagina.label}</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
        {pagina.campos.map((campo) => (
          <CampoField
            key={campo.clave}
            campo={campo}
            valor={valores[campo.clave]}
            botones={botones}
            onGuardar={(valor) => guardarCampo(campo.clave, campo.tipo, valor)}
            onSubirImagen={(file) => subirImagen(campo.clave, file)}
          />
        ))}
      </div>
    </div>
  );
}
