import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, API_ORIGIN } from '../api/client';
import VideoPlayer from '../components/VideoPlayer';
import ChapterTimeline from '../components/ChapterTimeline';
import CommentsBox from '../components/CommentsBox';
import CourseSidebar from '../components/CourseSidebar';

// Página de un capítulo: video + progreso, archivos de utilidad (si tiene),
// caja de comentarios, y navegación anterior/siguiente respetando el
// desbloqueo que calcula el backend (curriculum.service.js) según el modo
// de avance elegido por el profesor/admin para el curso.
export default function CourseChapter() {
  const { courseId, unitId, chapterId } = useParams();
  const navigate = useNavigate();

  const [detalle, setDetalle] = useState(null);
  const [unitData, setUnitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  const [error, setError] = useState('');
  const [marcando, setMarcando] = useState(false);
  // Último % reportado por el reproductor — se actualiza optimistamente
  // apenas responde el POST de progreso, sin esperar a un refetch completo.
  const [porcentajeLocal, setPorcentajeLocal] = useState(0);
  const ultimoEnviado = useRef(0);

  const cargar = useCallback(() => {
    setLoading(true);
    setBloqueado(false);
    setError('');
    return api.get(`/classroom/chapters/${chapterId}`)
      .then((d) => {
        setDetalle(d);
        setPorcentajeLocal(d.porcentaje_visto || 0);
        return api.get(`/classroom/units/${d.chapter.unit_id}`).then(setUnitData);
      })
      .catch((err) => {
        if (err.message.includes('desbloqueaste')) setBloqueado(true);
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [chapterId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleProgress(segundosActuales, duracionSegundos) {
    if (!duracionSegundos) return;
    const segundos = Math.floor(segundosActuales);
    // Evita mandar el mismo segundo dos veces seguidas si el reproductor
    // dispara eventos de más.
    if (segundos <= ultimoEnviado.current) return;
    ultimoEnviado.current = segundos;
    try {
      const { porcentaje_visto: pct } = await api.post(`/classroom/chapters/${chapterId}/progress`, {
        segundos_actuales: segundos,
        duracion_segundos: Math.floor(duracionSegundos),
      });
      setPorcentajeLocal(pct);
    } catch (_e) {
      // Best effort: un ping de progreso perdido no debería interrumpir la
      // reproducción del alumno.
    }
  }

  async function marcarVisto() {
    setMarcando(true);
    setError('');
    try {
      await api.post(`/classroom/chapters/${chapterId}/complete`);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setMarcando(false);
    }
  }

  if (loading) return <div className="spinner-msg">Cargando capítulo…</div>;

  if (bloqueado) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 640, textAlign: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>🔒</span>
          <h2>Todavía no desbloqueaste este capítulo</h2>
          <p className="text-muted">Completá los capítulos anteriores para poder verlo.</p>
          <Link to={`/classroom/${courseId}/unidades/${unitId}`} className="btn btn-outline" style={{ marginTop: 12 }}>
            Volver a la unidad
          </Link>
        </div>
      </section>
    );
  }

  if (error) return <div className="container section"><div className="alert alert-error">{error}</div></div>;

  const { chapter, unit, archivos, completado, anterior_id: anteriorId, siguiente_id: siguienteId, siguiente_desbloqueado: siguienteDesbloqueado, puede_marcar_visto: puedeMarcarVisto, exigir_80_porciento: exigir80 } = detalle;
  const basePath = `/classroom/${courseId}/unidades/${unitId}/capitulos/`;

  return (
    <section className="section">
      <div className="container-video">
      <div className="classroom-layout">
        <CourseSidebar courseId={courseId} currentUnitId={unitId} currentChapterId={chapterId} />
        <div className="classroom-main">
        <Link to={`/classroom/${courseId}/unidades/${unitId}`} className="text-muted" style={{ fontSize: '0.9rem' }}>
          ← {unit.titulo}
        </Link>
        <h1 style={{ marginTop: 8 }}>{chapter.titulo}</h1>

        <VideoPlayer videoUrl={chapter.video_url} onProgress={handleProgress} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>{porcentajeLocal}% visto</span>
          {completado ? (
            <span className="badge badge-success">✓ Visto</span>
          ) : (
            <button className="btn btn-primary btn-sm" disabled={!puedeMarcarVisto || marcando} onClick={marcarVisto}>
              {marcando ? 'Marcando…' : 'Marcar como visto'}
            </button>
          )}
        </div>
        {!completado && exigir80 && !puedeMarcarVisto && (
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Necesitás ver al menos el 80% del video para poder marcarlo como visto.
          </p>
        )}

        {archivos.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>Archivos de utilidad</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {archivos.map((f) => (
                <a
                  key={f.id}
                  href={f.archivo_path.startsWith('/uploads') ? `${API_ORIGIN}${f.archivo_path}` : f.archivo_path}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                >
                  📎 {f.archivo_nombre_original || 'Descargar archivo'}
                </a>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          {anteriorId ? (
            <button className="btn btn-outline" onClick={() => navigate(`${basePath}${anteriorId}`)}>← Anterior</button>
          ) : <span />}
          {siguienteId ? (
            <button
              className="btn btn-primary"
              disabled={!siguienteDesbloqueado}
              title={!siguienteDesbloqueado ? 'Marcá este capítulo como visto para continuar' : undefined}
              onClick={() => navigate(`${basePath}${siguienteId}`)}
            >
              Siguiente →
            </button>
          ) : (
            <Link to={`/classroom/${courseId}`} className="btn btn-primary">Volver al curso</Link>
          )}
        </div>

        {unitData && (
          <div className="card" style={{ marginTop: 24 }}>
            <ChapterTimeline
              capitulos={unitData.capitulos}
              currentChapterId={chapter.id}
              basePath={basePath}
              porcentaje={unitData.porcentaje_unidad}
            />
          </div>
        )}

        <CommentsBox chapterId={chapter.id} />
        </div>
      </div>
      </div>
    </section>
  );
}
