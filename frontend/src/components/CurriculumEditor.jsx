import { useEffect, useState } from 'react';
import { api, API_ORIGIN } from '../api/client';
import { formatFecha } from '../utils/fecha';
import Icon from './Icon';

const UNIDAD_VACIA = { titulo: '', introduccion: '', contenido: '' };
const CAPITULO_VACIO = { titulo: '', video_url: '' };

// Editor del temario para el profesor (o admin): crear/editar/borrar
// unidades y capítulos, subir archivos de utilidad, y elegir cómo se
// desbloquea el curso para los alumnos. Vive como pestaña "Contenido del
// curso" en Classroom.jsx, al lado de la de tareas.
export default function CurriculumEditor({ courseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardandoSettings, setGuardandoSettings] = useState(false);

  const [editandoUnidad, setEditandoUnidad] = useState(null); // id o 'nueva'
  const [unitForm, setUnitForm] = useState(UNIDAD_VACIA);

  const [nuevoCapituloDe, setNuevoCapituloDe] = useState(null); // unitId
  const [editandoCapitulo, setEditandoCapitulo] = useState(null); // chapterId

  function cargar() {
    return api.get(`/classroom/courses/${courseId}/curriculum`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardarSettings(cambios) {
    setGuardandoSettings(true);
    try {
      await api.put(`/classroom/courses/${courseId}/settings`, cambios);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoSettings(false);
    }
  }

  function abrirNuevaUnidad() {
    setUnitForm(UNIDAD_VACIA);
    setEditandoUnidad('nueva');
  }

  function abrirEdicionUnidad(unit) {
    setUnitForm({ titulo: unit.titulo, introduccion: unit.introduccion || '', contenido: unit.contenido || '' });
    setEditandoUnidad(unit.id);
  }

  async function guardarUnidad(e) {
    e.preventDefault();
    try {
      if (editandoUnidad === 'nueva') {
        await api.post(`/classroom/courses/${courseId}/units`, unitForm);
      } else {
        await api.put(`/classroom/units/${editandoUnidad}`, unitForm);
      }
      setEditandoUnidad(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrarUnidad(unitId) {
    try {
      await api.delete(`/classroom/units/${unitId}`);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="spinner-msg">Cargando temario…</div>;
  if (error && !data) return <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>;

  const { unidades, modo_avance: modoAvance, exigir_80_porciento: exigir80 } = data;

  return (
    <div style={{ marginTop: 24 }}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>Cómo avanzan los alumnos</h3>
        <div className="field">
          <label>Modo de avance</label>
          <select
            value={modoAvance}
            disabled={guardandoSettings}
            onChange={(e) => guardarSettings({ modo_avance: e.target.value })}
          >
            <option value="libre">Vista libre — puede ver cualquier capítulo</option>
            <option value="por_unidad">Por unidad — arranca cualquier unidad, dentro va en orden</option>
            <option value="continuo">Solo continuo — estrictamente en orden, capítulo a capítulo</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={exigir80}
            disabled={guardandoSettings}
            onChange={(e) => guardarSettings({ exigir_80_porciento: e.target.checked })}
          />
          Exigir haber visto el 80% del video para poder marcar un capítulo como visto
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        <h3 style={{ margin: 0 }}>Unidades</h3>
        <button className="btn btn-primary btn-sm" onClick={abrirNuevaUnidad}>+ Nueva unidad</button>
      </div>

      {editandoUnidad === 'nueva' && (
        <UnitForm form={unitForm} setForm={setUnitForm} onSubmit={guardarUnidad} onCancel={() => setEditandoUnidad(null)} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        {unidades.map((unit, i) => (
          <div key={unit.id} className="card">
            {editandoUnidad === unit.id ? (
              <UnitForm form={unitForm} setForm={setUnitForm} onSubmit={guardarUnidad} onCancel={() => setEditandoUnidad(null)} />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h4 style={{ margin: 0 }}>{i + 1}. {unit.titulo}</h4>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => abrirEdicionUnidad(unit)}>Editar</button>
                    <button className="btn btn-outline btn-sm" onClick={() => borrarUnidad(unit.id)} style={{ color: 'var(--color-danger)' }}>Borrar</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {unit.capitulos.map((cap, j) => (
                    <ChapterRow
                      key={cap.id}
                      numero={j + 1}
                      capitulo={cap}
                      editando={editandoCapitulo === cap.id}
                      onEditar={() => setEditandoCapitulo(cap.id)}
                      onCerrar={() => setEditandoCapitulo(null)}
                      onCambio={cargar}
                    />
                  ))}
                  {unit.capitulos.length === 0 && <p className="text-muted" style={{ margin: 0 }}>Todavía no tiene capítulos.</p>}
                </div>

                {nuevoCapituloDe === unit.id ? (
                  <ChapterForm
                    initial={CAPITULO_VACIO}
                    onCancel={() => setNuevoCapituloDe(null)}
                    onSubmit={async (form) => {
                      await api.post(`/classroom/units/${unit.id}/chapters`, form);
                      setNuevoCapituloDe(null);
                      await cargar();
                    }}
                  />
                ) : (
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => setNuevoCapituloDe(unit.id)}>
                    + Nuevo capítulo
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        {unidades.length === 0 && <p className="text-muted">Todavía no creaste ninguna unidad.</p>}
      </div>
    </div>
  );
}

function UnitForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="field">
        <label>Título de la unidad</label>
        <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
      </div>
      <div className="field">
        <label>Introducción (se muestra en la página de la unidad)</label>
        <textarea rows={2} value={form.introduccion} onChange={(e) => setForm({ ...form, introduccion: e.target.value })} />
      </div>
      <div className="field">
        <label>Qué vas a ver en esta unidad</label>
        <textarea rows={3} value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm">Guardar</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

// Fila de un capítulo dentro de la unidad, en modo lectura. Al editar,
// recién ahí pedimos el detalle completo (con el link del video y sus
// archivos) — la lista del temario no trae el link del video a propósito,
// para no exponérselo a un alumno que todavía no lo desbloqueó.
function ChapterRow({ numero, capitulo, editando, onEditar, onCerrar, onCambio }) {
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editando) return;
    api.get(`/classroom/chapters/${capitulo.id}`).then(setDetalle).catch((err) => setError(err.message));
  }, [editando, capitulo.id]);

  if (!editando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{numero}. {capitulo.titulo}</span>
        <button className="btn btn-outline btn-sm" onClick={onEditar}>Editar</button>
      </div>
    );
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!detalle) return <p className="text-muted">Cargando…</p>;

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
      <ChapterForm
        initial={{ titulo: detalle.chapter.titulo, video_url: detalle.chapter.video_url }}
        onCancel={onCerrar}
        onSubmit={async (form) => {
          await api.put(`/classroom/chapters/${capitulo.id}`, form);
          onCerrar();
          await onCambio();
        }}
        onDelete={async () => {
          await api.delete(`/classroom/chapters/${capitulo.id}`);
          onCerrar();
          await onCambio();
        }}
      />

      <ChapterFiles chapterId={capitulo.id} archivos={detalle.archivos} onCambio={async () => setDetalle(await api.get(`/classroom/chapters/${capitulo.id}`))} />

      <ChapterComments chapterId={capitulo.id} />
    </div>
  );
}

function ChapterForm({ initial, onSubmit, onCancel, onDelete }) {
  const [form, setForm] = useState(initial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label>Título del capítulo</label>
        <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
      </div>
      <div className="field">
        <label>Link del video (YouTube o Vimeo)</label>
        <input
          value={form.video_url}
          onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=... o https://vimeo.com/123456789/abcd1234ef"
          required
        />
        <p className="text-muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>
          Si el video de Vimeo es privado, pegá el link completo con el código que trae al final
          (vimeo.com/123456789/<strong>abcd1234ef</strong>) — sin esa parte no reproduce.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
        {onDelete && (
          <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)', marginLeft: 'auto' }} onClick={onDelete}>
            Borrar capítulo
          </button>
        )}
      </div>
    </form>
  );
}

function ChapterFiles({ chapterId, archivos, onCambio }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function subir(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSubiendo(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      await api.postForm(`/classroom/chapters/${chapterId}/files`, formData);
      await onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  }

  async function borrar(fileId) {
    try {
      await api.delete(`/classroom/chapter-files/${fileId}`);
      await onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
      <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.9rem' }}>Archivos de utilidad</p>
      {error && <div className="alert alert-error">{error}</div>}
      {archivos.map((f) => (
        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: 4 }}>
          <a href={`${API_ORIGIN}${f.archivo_path}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="paperclip" size={14} />
            {f.archivo_nombre_original}
          </a>
          <button onClick={() => borrar(f.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}>Borrar</button>
        </div>
      ))}
      {archivos.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>Ninguno todavía — opcional, si no sube nada esta sección no aparece en la página del capítulo.</p>}
      <input type="file" onChange={subir} disabled={subiendo} style={{ marginTop: 8 }} />
    </div>
  );
}

// Comentarios del capítulo, para el profesor/admin: verlos, responder (la
// respuesta queda anidada bajo la pregunta) y, si hace falta, ocultar un
// comentario puntual — no lo borra, solo deja de mandárselo al alumno
// (ver curriculum.controller.js::listComments, que filtra por "oculto"
// para cualquiera que no gestione el curso). Volver a mostrarlo es el
// mismo botón.
function ChapterComments({ chapterId }) {
  const [comments, setComments] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [respondiendoA, setRespondiendoA] = useState(null); // id del comentario al que se responde
  const [textoRespuesta, setTextoRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);

  function cargar() {
    return api.get(`/classroom/chapters/${chapterId}/comments`)
      .then((d) => setComments(d.comments))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    setCargando(true);
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  async function responder(parentId) {
    if (!textoRespuesta.trim()) return;
    setEnviando(true);
    setError('');
    try {
      await api.post(`/classroom/chapters/${chapterId}/comments`, { texto: textoRespuesta, parent_comment_id: parentId });
      setTextoRespuesta('');
      setRespondiendoA(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarVisibilidad(commentId, oculto) {
    setActualizandoId(commentId);
    setError('');
    try {
      await api.put(`/classroom/comments/${commentId}/visibility`, { oculto });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setActualizandoId(null);
    }
  }

  if (cargando) return null; // no bloquea el resto del formulario mientras carga

  const principales = comments.filter((c) => !c.parent_comment_id);
  const respuestasDe = (id) => comments.filter((c) => c.parent_comment_id === id);

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
      <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.9rem' }}>Comentarios ({principales.length})</p>
      {error && <div className="alert alert-error">{error}</div>}
      {principales.length === 0 && (
        <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>Todavía no hay comentarios en este capítulo.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {principales.map((c) => (
          <div key={c.id}>
            <ComentarioItem comentario={c} actualizando={actualizandoId === c.id} onOcultar={() => cambiarVisibilidad(c.id, !c.oculto)} />

            {respuestasDe(c.id).map((r) => (
              <div key={r.id} style={{ marginLeft: 24, marginTop: 6 }}>
                <ComentarioItem comentario={r} actualizando={actualizandoId === r.id} onOcultar={() => cambiarVisibilidad(r.id, !r.oculto)} />
              </div>
            ))}

            {respondiendoA === c.id ? (
              <form onSubmit={(e) => { e.preventDefault(); responder(c.id); }} style={{ display: 'flex', gap: 6, marginLeft: 24, marginTop: 6 }}>
                <input
                  autoFocus
                  value={textoRespuesta}
                  onChange={(e) => setTextoRespuesta(e.target.value)}
                  placeholder="Escribí la respuesta…"
                  style={{ flex: 1, fontSize: '0.85rem' }}
                />
                <button className="btn btn-primary btn-sm" disabled={enviando || !textoRespuesta.trim()}>
                  {enviando ? 'Enviando…' : 'Responder'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setRespondiendoA(null); setTextoRespuesta(''); }}>
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                className="btn btn-outline btn-sm"
                style={{ marginLeft: 24, marginTop: 6, fontSize: '0.8rem', padding: '4px 10px' }}
                onClick={() => { setRespondiendoA(c.id); setTextoRespuesta(''); }}
              >
                Responder
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ComentarioItem({ comentario, actualizando, onOcultar }) {
  const fecha = formatFecha(comentario.created_at);
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px', opacity: comentario.oculto ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.85rem' }}>
          {comentario.autor_nombre} {comentario.autor_apellido}
          {comentario.autor_rol !== 'alumno' && (
            <span className="badge" style={{ marginLeft: 6 }}>{comentario.autor_rol === 'admin' ? 'Admin' : 'Profe'}</span>
          )}
          {comentario.oculto && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Oculto — solo vos lo ves</span>}
        </strong>
        <button
          onClick={onOcultar}
          disabled={actualizando}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: comentario.oculto ? 'var(--color-success)' : 'var(--color-danger)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
        >
          {actualizando ? '…' : comentario.oculto ? 'Mostrar' : 'Ocultar'}
        </button>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>{comentario.texto}</p>
      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{fecha}</span>
    </div>
  );
}
