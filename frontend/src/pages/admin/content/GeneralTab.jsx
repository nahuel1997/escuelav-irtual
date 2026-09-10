import CampoField from './CampoField';
import NavLinksManager from './NavLinksManager';
import ButtonOptionsManager from './ButtonOptionsManager';

// Pestaña "Generales": lo que no es de una página puntual — logo,
// tipografías, SEO por defecto, links extra de navegación, y el registro
// de estilos de botón reutilizables en el resto de las pestañas.
export default function GeneralTab({ pagina, valores, botones, guardarCampo, subirImagen, recargarBotones }) {
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

      <div style={{ marginTop: 32 }}>
        <h3>Links de menú y pie de página</h3>
        <p className="text-muted">
          Se suman al final de la navegación funcional del sitio (Inicio, Tienda, Mis cursos, etc., que
          depende del rol y no se puede tocar acá porque es lógica de la app).
        </p>
        <NavLinksManager />
      </div>

      <div style={{ marginTop: 32 }}>
        <h3>Registro de botones</h3>
        <p className="text-muted">
          Definí acá cada estilo de botón reutilizable ("Opción 1", "Opción 2"...): color de fondo, color
          de texto y link de destino. Después, en cada pestaña de página, elegís qué opción usa cada botón puntual.
        </p>
        <ButtonOptionsManager botones={botones} onCambio={recargarBotones} />
      </div>
    </div>
  );
}
