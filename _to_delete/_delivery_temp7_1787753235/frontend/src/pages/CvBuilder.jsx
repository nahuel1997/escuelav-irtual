import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CvDatosForm, { vacioExperiencia, vacioEducacion, vacioIdioma } from '../components/CvDatosForm';

// Creador de CV: toma toda la información que el usuario carga a mano y,
// opcionalmente, la completa con los cursos/logros que ya tiene en la
// plataforma. Genera un PDF en el backend (pdfkit) y lo descarga.
//
// Persistencia: si hay sesión iniciada, el perfil (datos personales +
// experiencia + educación + habilidades + idiomas) se precarga acá al
// entrar (GET /cv/perfil) y se guarda solo cada vez que se genera un PDF
// (ver cv.controller.js::generate) — no hace falta un botón de "Guardar"
// aparte, cada descarga actualiza el perfil guardado. Si el usuario quiere
// editar/guardar esos datos SIN generar nada, tiene la pantalla aparte
// "Mis datos de CV" (/cv/datos, ver CvDatos.jsx) — acá abajo hay un link
// directo a esa pantalla.
//
// "Generar CV para IA": antes del botón de descargar el PDF hay una
// sección aparte para generar una versión en HTML pensada para pegar como
// contexto en ChatGPT/Claude/Gemini, con el nivel sugerido en IA aplicada
// a oficina y recomendaciones de contenido (ver POST /cv/generar-ia y
// services/cvAi/ del lado del backend). Las 3 plantillas HTML son
// editables por el admin desde /admin-panel/cv-ia — acá solo se elige el
// destino y se dispara la generación.
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

  // "CV para IA" (ChatGPT/Claude/Gemini): destinos que trae el catálogo
  // (solo los que el admin dejó activos desde /admin-panel/cv-ia — ver
  // AdminCvTemplates.jsx), y el estado de la generación puntual.
  const [generadoresIA, setGeneradoresIA] = useState([]);
  const [destinoIA, setDestinoIA] = useState('');
  const [generandoIA, setGenerandoIA] = useState(false);
  const [errorIA, setErrorIA] = useState('');
  const [ultimoHtmlIA, setUltimoHtmlIA] = useState(null);

  useEffect(() => {
    api.get('/cv/generadores-ia', { auth: false })
      .then(({ generadores }) => {
        setGeneradoresIA(generadores);
        if (generadores.length) setDestinoIA(generadores[0].clave);
      })
      .catch(() => {});
  }, []);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setGenerando(true);
    setError('');
    try {
      const blob = await api.blob('/cv/generate', { body: armarPayload() });
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

  // Arma el payload común a /cv/generate y /cv/generar-ia — mismo criterio
  // de filtrado (descarta filas de experiencia/educación/idiomas vacías)
  // que ya usaba handleSubmit.
  function armarPayload() {
    return {
      datosPersonales,
      experiencia: experiencia.filter((x) => x.puesto || x.empresa),
      educacion: educacion.filter((x) => x.titulo || x.institucion),
      habilidades: habilidadesTexto.split(',').map((h) => h.trim()).filter(Boolean),
      idiomas: idiomas.filter((x) => x.idioma),
      incluirCursosPlataforma: incluirCursos,
    };
  }

  // Genera el "CV para IA" del destino elegido: abre el HTML resultante en
  // una pestaña nueva (para leer/copiar/pegar en el chat, o imprimirlo
  // como PDF desde el propio navegador) y deja lista la descarga del
  // mismo HTML como archivo.
  async function handleGenerarIA() {
    setGenerandoIA(true);
    setErrorIA('');
    try {
      const { html } = await api.post('/cv/generar-ia', { ...armarPayload(), destino: destinoIA });
      setUltimoHtmlIA(html);
      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setErrorIA(err.message);
    } finally {
      setGenerandoIA(false);
    }
  }

  function descargarHtmlIA() {
    if (!ultimoHtmlIA) return;
    const blob = new Blob([ultimoHtmlIA], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cv-${(datosPersonales.nombreCompleto || 'usuario').replace(/\s+/g, '_')}-${destinoIA}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h1>Creador de CV</h1>
        <p className="text-muted">
          Completá tus datos y descargá tu currículum en PDF.
          {user && ' Tus datos se guardan solos cada vez que descargás el CV, así no tenés que volver a cargarlos la próxima vez.'}
        </p>
        {user && (
          <p className="text-muted" style={{ marginTop: -8 }}>
            <Link to="/cv/datos">Editar mis datos guardados →</Link>
          </p>
        )}

        {cargandoPerfil && <p className="text-muted">Cargando tus datos guardados…</p>}

        <form onSubmit={handleSubmit} className="card">
          {error && <div className="alert alert-error">{error}</div>}

          <CvDatosForm
            datosPersonales={datosPersonales} setDatosPersonales={setDatosPersonales}
            experiencia={experiencia} setExperiencia={setExperiencia}
            educacion={educacion} setEducacion={setEducacion}
            habilidadesTexto={habilidadesTexto} setHabilidadesTexto={setHabilidadesTexto}
            idiomas={idiomas} setIdiomas={setIdiomas}
          />

          <div className="field" style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="incluirCursos" checked={incluirCursos} onChange={(e) => setIncluirCursos(e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="incluirCursos" style={{ margin: 0 }}>Incluir mis cursos y logros de la plataforma</label>
          </div>

          {generadoresIA.length > 0 && (
            <div className="card" style={{ marginTop: 24, background: 'var(--color-bg-alt)' }}>
              <h3 style={{ marginTop: 0 }}>Generar CV para IA</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem' }}>
                Antes de imprimir tu CV, también podés generar una versión pensada para pegar como contexto en
                ChatGPT, Claude o Gemini — incluye tu nivel sugerido en IA aplicada a oficina (según los cursos que
                ya completaste) y contenido recomendado para seguir avanzando.
                {!user && ' Sin cuenta, el nivel arranca en el inicial y la recomendación es genérica.'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={destinoIA} onChange={(e) => setDestinoIA(e.target.value)} style={{ maxWidth: 220 }}>
                  {generadoresIA.map((g) => (
                    <option key={g.clave} value={g.clave}>{g.nombre}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-outline" disabled={generandoIA} onClick={handleGenerarIA}>
                  {generandoIA ? 'Generando…' : 'Generar y abrir'}
                </button>
                {ultimoHtmlIA && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={descargarHtmlIA}>
                    Descargar .html
                  </button>
                )}
              </div>
              {errorIA && <div className="alert alert-error" style={{ marginTop: 10 }}>{errorIA}</div>}
            </div>
          )}

          <button type="submit" className="btn btn-accent" disabled={generando} style={{ marginTop: 16 }}>
            {generando ? 'Generando PDF…' : 'Descargar mi CV en PDF'}
          </button>
        </form>
      </div>
    </section>
  );
}
