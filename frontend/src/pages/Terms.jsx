import { useContent } from '../hooks/useContent';
import { useSeo } from '../hooks/useSeo';

// Términos y condiciones — contenido estático de ejemplo. Reemplazar por el
// texto legal real antes de ir a producción. El título/meta SEO sí son
// editables desde /admin-panel/contenido.
export default function Terms() {
  const { values: content } = useContent();
  useSeo(content, 'terminos', 'Términos y condiciones');

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 800 }}>
        <h1>Términos y condiciones</h1>
        <p className="text-muted">Última actualización: agosto de 2026.</p>

        <h3>1. Sobre la plataforma</h3>
        <p>
          Escuela Online ofrece cursos y contenidos educativos a través de una
          plataforma web, incluyendo un espacio de classroom para la entrega
          de tareas y seguimiento por parte de los profesores.
        </p>

        <h3>2. Cuentas de usuario</h3>
        <p>
          Cada usuario es responsable de mantener la confidencialidad de su
          contraseña y de toda la actividad realizada desde su cuenta.
        </p>

        <h3>3. Compra de cursos</h3>
        <p>
          Actualmente la compra de cursos se procesa de forma simulada como
          parte de la etapa de desarrollo de la plataforma. No se realizan
          cobros reales hasta que se integre una pasarela de pago definitiva.
        </p>

        <h3>4. Entregas y classroom</h3>
        <p>
          Los archivos entregados en el classroom son revisados por el
          profesor a cargo del curso correspondiente. La plataforma no se
          responsabiliza por la pérdida de archivos debido a fallas de
          conexión al momento de la entrega.
        </p>

        <h3>5. Propiedad intelectual</h3>
        <p>
          El contenido de los cursos pertenece a sus respectivos autores y no
          puede redistribuirse sin autorización.
        </p>

        <h3>6. Modificaciones</h3>
        <p>
          Estos términos pueden actualizarse. Se notificará a los usuarios ante
          cambios relevantes.
        </p>
      </div>
    </section>
  );
}
