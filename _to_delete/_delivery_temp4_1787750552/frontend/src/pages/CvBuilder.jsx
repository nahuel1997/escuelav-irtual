import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const vacioExperiencia = { puesto: '', empresa: '', periodo: '', descripcion: '' };
const vacioEducacion = { titulo: '', institucion: '', periodo: '' };
const vacioIdioma = { idioma: '', nivel: '' };

// Creador de CV: toma toda la información que el usuario carga a mano y,
// opcionalmente, la completa con los cursos/logros que ya tiene en la
// plataforma. Genera un PDF en el backend (pdfkit) y lo descarga.
//
// Persistencia: si hay sesión iniciada, el perfil (datos personales +
// experiencia + educación + habilidades + idiomas) se precarga acá al
// entrar (GET /cv/perfil) y se guarda solo cada vez que se genera un PDF
// (ver cv.controller.js::generate) — no hace falta un botón de "Guardar"
// aparte, cada descarga actualiza el perfil guardado.
export default function CvBuilder() {
  const { user } = useAuth();
  const [datosPersonales, setDatosPersonales] = useState({
    nombreCompleto: '', email: '', telefono: '', ubicacion: '', linkedin: '', resumenProfesional: '',
  });
  const [experiencia, setExperiencia] = useState([{ ...vacioExperiencia }]);
  const [educacion, setEducacion] = useState([{ ...vacioEducacion }]);
  const [habilidadesTexto, setHabilidadesTexto] = useState('');
  const [idiomas, setIdiomas] = useState([{ ...vacioIdioma }]);
  const [incluirCursos, setIncluirCursos] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [cargandoPerfil, setCargandoPerfil] = useState(!!user);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
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
      .catch(() => {})
      .finally(() => setCargandoPerfil(false));
  }, [user]);

  function actualizarLista(setter, lista, index, campo, valor) {
    const copia = [...lista];
    copia[index] = { ...copia[index], [campo]: valor };
    setter(copia);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGenerando(true);
    setError('');
    try {
      const blob = await api.blob('/cv/generate', {
        body: {
          datosPersonales,
          experiencia: experiencia.filter((x) => x.puesto || x.empresa),
          educacion: educacion.filter((x) => x.titulo || x.institucion),
          habilidades: habilidadesTexto.split(',').map((h) => h.trim()).filter(Boolean),
          idiomas: idiomas.filter((x) => x.idioma),
          incluirCursosPlataforma: incluirCursos,
        },
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cv-${(datosPersonales.nombreCompleto || 'usuario').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h1>Creador de CV</h1>
        <p className="text-muted">
          Completá tus datos y descargá tu currículum en PDF.
          {user && ' Tus datos se guardan solos cada vez que descargás el CV, así no tenés que volver a cargarlos la próxima vez.'}
        </p>

        {cargandoPerfil && <p className="text-muted">Cargando tus datos guardados…</p>}

        <form onSubmit={handleSubmit} className="card">
          {error && <div className="alert alert-error">{error}</div>}

          <h3>Datos personales</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Nombre completo</label>
              <input value={datosPersonales.nombreCompleto} onChange={(e) => setDatosPersonales({ ...datosPersonales, nombreCompleto: e.target.value })} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={datosPersonales.email} onChange={(e) => setDatosPersonales({ ...datosPersonales, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={datosPersonales.telefono} onChange={(e) => setDatosPersonales({ ...datosPersonales, telefono: e.target.value })} />
            </div>
            <div className="field">
              <label>Ubicación</label>
              <input value={datosPersonales.ubicacion} onChange={(e) => setDatosPersonales({ ...datosPersonales, ubicacion: e.target.value })} />
            </div>
            <div className="field">
              <label>LinkedIn (opcional)</label>
              <input value={datosPersonales.linkedin} onChange={(e) => setDatosPersonales({ ...datosPersonales, linkedin: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Resumen profesional</label>
            <textarea rows={3} value={datosPersonales.resumenProfesional} onChange={(e) => setDatosPersonales({ ...datosPersonales, resumenProfesional: e.target.value })} />
          </div>

          <h3 style={{ marginTop: 24 }}>Experiencia laboral</h3>
          {experiencia.map((exp, i) => (
            <div key={i} className="grid grid-2" style={{ gap: 12, marginBottom: 8 }}>
              <input placeholder="Puesto" value={exp.puesto} onChange={(e) => actualizarLista(setExperiencia, experiencia, i, 'puesto', e.target.value)} />
              <input placeholder="Empresa" value={exp.empresa} onChange={(e) => actualizarLista(setExperiencia, experiencia, i, 'empresa', e.target.value)} />
              <input placeholder="Período (ej: 2022 - 2024)" value={exp.periodo} onChange={(e) => actualizarLista(setExperiencia, experiencia, i, 'periodo', e.target.value)} />
              <input placeholder="Descripción breve" value={exp.descripcion} onChange={(e) => actualizarLista(setExperiencia, experiencia, i, 'descripcion', e.target.value)} />
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setExperiencia([...experiencia, { ...vacioExperiencia }])}>
            + Agregar experiencia
          </button>

          <h3 style={{ marginTop: 24 }}>Educación</h3>
          {educacion.map((ed, i) => (
            <div key={i} className="grid grid-2" style={{ gap: 12, marginBottom: 8 }}>
              <input placeholder="Título / carrera" value={ed.titulo} onChange={(e) => actualizarLista(setEducacion, educacion, i, 'titulo', e.target.value)} />
              <input placeholder="Institución" value={ed.institucion} onChange={(e) => actualizarLista(setEducacion, educacion, i, 'institucion', e.target.value)} />
              <input placeholder="Período" value={ed.periodo} onChange={(e) => actualizarLista(setEducacion, educacion, i, 'periodo', e.target.value)} />
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEducacion([...educacion, { ...vacioEducacion }])}>
            + Agregar educación
          </button>

          <h3 style={{ marginTop: 24 }}>Habilidades</h3>
          <div className="field">
            <label>Separadas por coma</label>
            <input placeholder="JavaScript, Trabajo en equipo, Excel avanzado" value={habilidadesTexto} onChange={(e) => setHabilidadesTexto(e.target.value)} />
          </div>

          <h3 style={{ marginTop: 24 }}>Idiomas</h3>
          {idiomas.map((idi, i) => (
            <div key={i} className="grid grid-2" style={{ gap: 12, marginBottom: 8 }}>
              <input placeholder="Idioma" value={idi.idioma} onChange={(e) => actualizarLista(setIdiomas, idiomas, i, 'idioma', e.target.value)} />
              <input placeholder="Nivel" value={idi.nivel} onChange={(e) => actualizarLista(setIdiomas, idiomas, i, 'nivel', e.target.value)} />
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setIdiomas([...idiomas, { ...vacioIdioma }])}>
            + Agregar idioma
          </button>

          <div className="field" style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="incluirCursos" checked={incluirCursos} onChange={(e) => setIncluirCursos(e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="incluirCursos" style={{ margin: 0 }}>Incluir mis cursos y logros de la plataforma</label>
          </div>

          <button type="submit" className="btn btn-accent" disabled={generando} style={{ marginTop: 16 }}>
            {generando ? 'Generando PDF…' : 'Descargar mi CV en PDF'}
          </button>
        </form>
      </div>
    </section>
  );
}
