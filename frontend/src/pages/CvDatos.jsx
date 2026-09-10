import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import CvDatosForm, { vacioExperiencia, vacioEducacion, vacioIdioma } from '../components/CvDatosForm';

// "Mis datos de CV": pantalla aparte del Creador de CV (/cv) para ver y
// editar el perfil guardado sin necesidad de generar un PDF ni un CV para
// IA — antes de esto la única forma de persistir estos datos era
// descargar un CV desde /cv (ver CvBuilder.jsx). Usa el mismo formulario
// compartido (CvDatosForm) y guarda con PUT /cv/perfil (ver
// cv.controller.js::guardarPerfil). Requiere estar logueado: la ruta ya
// está protegida por PrivateRoute en App.jsx.
export default function CvDatos() {
  const [datosPersonales, setDatosPersonales] = useState({
    nombreCompleto: '', email: '', telefono: '', ubicacion: '', linkedin: '', resumenProfesional: '',
  });
  const [experiencia, setExperiencia] = useState([{ ...vacioExperiencia }]);
  const [educacion, setEducacion] = useState([{ ...vacioEducacion }]);
  const [habilidadesTexto, setHabilidadesTexto] = useState('');
  const [idiomas, setIdiomas] = useState([{ ...vacioIdioma }]);
  const [incluirCursos, setIncluirCursos] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    api.get('/cv/perfil')
      .then(({ perfil }) => {
        if (!perfil) return;
        setDatosPersonales({
          nombreCompleto: perfil.nombre_completo || '',
          email: perfil.email || '',
          telefono: perfil.telefono || '',
          ubicacion: perfil.ubicacion || '',
          linkedin: perfil.linkedin || '',
          resumenProfesional: perfil.resumen_profesional || '',
        });
        if (perfil.experiencia?.length) setExperiencia(perfil.experiencia);
        if (perfil.educacion?.length) setEducacion(perfil.educacion);
        if (perfil.habilidades?.length) setHabilidadesTexto(perfil.habilidades.join(', '));
        if (perfil.idiomas?.length) setIdiomas(perfil.idiomas);
        setIncluirCursos(perfil.incluirCursosPlataforma !== false);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setGuardadoOk(false);
    try {
      await api.put('/cv/perfil', {
        datosPersonales,
        experiencia: experiencia.filter((x) => x.puesto || x.empresa),
        educacion: educacion.filter((x) => x.titulo || x.institucion),
        habilidades: habilidadesTexto.split(',').map((h) => h.trim()).filter(Boolean),
        idiomas: idiomas.filter((x) => x.idioma),
        incluirCursosPlataforma: incluirCursos,
      });
      setGuardadoOk(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h1>Mis datos de CV</h1>
        <p className="text-muted">
          Estos son los datos que usa el Creador de CV para autocompletar tu currículum. Editalos y guardalos acá
          cuando quieras, sin necesidad de generar un PDF.
        </p>
        <p className="text-muted" style={{ marginTop: -8 }}>
          <Link to="/cv">← Ir al Creador de CV</Link>
        </p>

        {cargando && <p className="text-muted">Cargando tus datos guardados…</p>}

        {!cargando && (
          <form onSubmit={handleSubmit} className="card">
            {error && <div className="alert alert-error">{error}</div>}
            {guardadoOk && <div className="alert alert-success">Tus datos se guardaron correctamente.</div>}

            <CvDatosForm
              datosPersonales={datosPersonales} setDatosPersonales={setDatosPersonales}
              experiencia={experiencia} setExperiencia={setExperiencia}
              educacion={educacion} setEducacion={setEducacion}
              habilidadesTexto={habilidadesTexto} setHabilidadesTexto={setHabilidadesTexto}
              idiomas={idiomas} setIdiomas={setIdiomas}
            />

            <div className="field" style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="incluirCursos" checked={incluirCursos} onChange={(e) => setIncluirCursos(e.target.checked)} style={{ width: 'auto' }} />
              <label htmlFor="incluirCursos" style={{ margin: 0 }}>Incluir mis cursos y logros de la plataforma al generar el CV</label>
            </div>

            <button type="submit" className="btn btn-accent" disabled={guardando} style={{ marginTop: 16 }}>
              {guardando ? 'Guardando…' : 'Guardar mis datos'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
