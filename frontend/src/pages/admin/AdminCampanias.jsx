import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

const ESTADOS = {
  borrador: { label: 'Borrador', clase: '' },
  programada: { label: 'Programada', clase: 'badge-warning' },
  enviando: { label: 'Enviando…', clase: 'badge-warning' },
  enviada: { label: 'Enviada', clase: 'badge-success' },
  cancelada: { label: 'Cancelada', clase: '' },
  error: { label: 'Con error', clase: 'badge-danger' },
};

const VACIA = { nombre: '', asunto: '', titulo: '', contenido: '', imagen_url: '', boton_texto: '', boton_url: '', oferta_id: '', segmento: { roles: ['alumno'], listaId: '', cursoId: '', sinCompras: false } };

function aInputLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Editor({ inicial, ofertas, listas, cursos, onGuardada, onCancelar }) {
  const [c, setC] = useState(inicial);
  const [destinatarios, setDestinatarios] = useState(null);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const seg = c.segmento;

  useEffect(() => {
    const t = setTimeout(() => {
      api.post('/admin/campanias/segmento/contar', { segmento: seg }).then((d) => setDestinatarios(d.destinatarios)).catch(() => setDestinatarios(null));
    }, 300);
    return () => clearTimeout(t);
  }, [seg]);

  const setSeg = (patch) => setC({ ...c, segmento: { ...seg, ...patch } });
  const toggleRol = (r) => setSeg({ roles: seg.roles.includes(r) ? seg.roles.filter((x) => x !== r) : [...seg.roles, r] });

  async function subirImagen(e) {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('imagen', archivo);
      const { url } = await api.postForm('/admin/upload-imagen', form);
      setC({ ...c, imagen_url: url });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    try {
      const body = { ...c, oferta_id: c.oferta_id || null };
      if (c.id) await api.put(`/admin/campanias/${c.id}`, body);
      else await api.post('/admin/campanias', body);
      onGuardada();
    } catch (err) {
      setError(err.message);
    }
  }

  const campo = (k, label, props = {}) => (
    <div className="field" style={{ flex: 1, minWidth: 220 }}>
      <label>{label}</label>
      <input value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} {...props} />
    </div>
  );

  return (
    <form className="card" onSubmit={guardar}>
      <h3 style={{ marginTop: 0 }}>{c.id ? 'Editar campaña' : 'Nueva campaña'}</h3>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {campo('nombre', 'Nombre interno', { required: true, maxLength: 120 })}
        {campo('asunto', 'Asunto del mail', { required: true, maxLength: 200 })}
      </div>
      {campo('titulo', 'Título dentro del mail', { required: true, maxLength: 200 })}
      <div className="field">
        <label>Texto (un párrafo por línea)</label>
        <textarea rows={5} value={c.contenido} onChange={(e) => setC({ ...c, contenido: e.target.value })} required />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 220 }}>
          <label>Imagen (opcional)</label>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={subirImagen} disabled={subiendo} />
          {c.imagen_url && <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 4 }} onClick={() => setC({ ...c, imagen_url: '' })}>Quitar imagen</button>}
        </div>
        {campo('boton_texto', 'Texto del botón', { maxLength: 60, placeholder: 'Ver cursos' })}
        {campo('boton_url', 'Link del botón', { placeholder: '/tienda o https://…' })}
      </div>
      <div className="field" style={{ maxWidth: 420 }}>
        <label>Oferta asociada (opcional — suma la cuenta regresiva al mail)</label>
        <select value={c.oferta_id || ''} onChange={(e) => setC({ ...c, oferta_id: e.target.value })}>
          <option value="">Ninguna</option>
          {ofertas.map((o) => <option key={o.id} value={o.id}>{o.titulo} (hasta {formatFecha(o.termina_en)})</option>)}
        </select>
      </div>

      <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
        <legend>Destinatarios</legend>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label><input type="checkbox" checked={seg.roles.includes('alumno')} onChange={() => toggleRol('alumno')} /> Alumnos</label>
          <label><input type="checkbox" checked={seg.roles.includes('profesor')} onChange={() => toggleRol('profesor')} /> Profesores</label>
          <label><input type="checkbox" checked={seg.sinCompras} onChange={(e) => setSeg({ sinCompras: e.target.checked })} /> Solo quienes todavía no compraron nada</label>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Solo de la lista</label>
            <select value={seg.listaId || ''} onChange={(e) => setSeg({ listaId: e.target.value })}>
              <option value="">Cualquiera</option>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Solo inscriptos en</label>
            <select value={seg.cursoId || ''} onChange={(e) => setSeg({ cursoId: e.target.value })}>
              <option value="">Cualquier curso</option>
              {cursos.map((cu) => <option key={cu.id} value={cu.id}>{cu.titulo}</option>)}
            </select>
          </div>
        </div>
        <p className="text-muted" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
          {destinatarios === null ? '…' : <strong>{destinatarios} destinatario{destinatarios === 1 ? '' : 's'}</strong>} — solo cuentas activas que aceptan publicidad. Cada mail lleva su link de baja.
        </p>
      </fieldset>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary">Guardar</button>
        <button type="button" className="btn btn-outline" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function Detalle({ id, onCambio, onEditar }) {
  const [est, setEst] = useState(null);
  const [html, setHtml] = useState('');
  const [cuando, setCuando] = useState(aInputLocal(new Date(Date.now() + 3600000)));
  const [prueba, setPrueba] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = () => api.get(`/admin/campanias/${id}/estadisticas`).then(setEst);
  useEffect(() => {
    cargar();
    api.getBlob(`/admin/campanias/${id}/vista-previa`).then((b) => b.text()).then(setHtml).catch(() => setHtml(''));
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accion(fn, ok) {
    setAviso('');
    try {
      await fn();
      setAviso(ok);
      cargar();
      onCambio();
    } catch (e) {
      setAviso(`✗ ${e.message}`);
    }
  }

  if (!est) return <div className="card">Cargando…</div>;
  const c = est.campania;
  const editable = ['borrador', 'programada', 'cancelada'].includes(c.estado);

  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{c.nombre}</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            <span className={`badge ${ESTADOS[c.estado]?.clase}`}>{ESTADOS[c.estado]?.label}</span>{' '}
            {c.estado === 'programada' && `para el ${formatFecha(c.programada_para)}`}
            {c.enviada_en && ` · enviada el ${formatFecha(c.enviada_en)}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {editable && <button className="btn btn-outline btn-sm" onClick={() => onEditar(c)}>Editar</button>}
          <button className="btn btn-outline btn-sm" onClick={() => accion(() => api.post(`/admin/campanias/${id}/duplicar`, {}), 'Campaña duplicada (quedó como borrador).')}>Duplicar</button>
          {c.estado !== 'enviando' && <button className="btn btn-outline btn-sm" onClick={() => window.confirm('¿Borrar la campaña?') && accion(() => api.delete(`/admin/campanias/${id}`), 'Borrada.')}>Borrar</button>}
        </div>
      </div>
      {aviso && <div className={`alert ${aviso.startsWith('✗') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: 10 }}>{aviso}</div>}

      {(est.total > 0 || c.estado === 'enviada') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginTop: 12 }}>
          {[['Enviados', est.enviados], ['Abiertos', `${est.abiertos} (${est.tasaApertura}%)`], ['Con click', `${est.conClick} (${est.tasaClick}%)`], ['Clicks', est.clicks], ['Bajas', est.bajas], ['Fallidos', est.fallidos], ['Pendientes', est.pendientes]].map(([k, v]) => (
            <div key={k} style={{ background: 'var(--color-bg-alt)', borderRadius: 8, padding: 8 }}><div className="text-muted" style={{ fontSize: '0.75rem' }}>{k}</div><strong>{v}</strong></div>
          ))}
        </div>
      )}

      {editable && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Programar para</label>
            <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => accion(() => api.post(`/admin/campanias/${id}/programar`, { programada_para: new Date(cuando).toISOString() }), 'Programada. Sale sola a esa hora.')}>Programar</button>
          <button className="btn btn-outline btn-sm" onClick={() => window.confirm('¿Mandarla ahora a todos los destinatarios?') && accion(() => api.post(`/admin/campanias/${id}/enviar`, {}), 'Enviándose en segundo plano (ver Procesos).')}>Enviar ahora</button>
          {c.estado === 'programada' && <button className="btn btn-outline btn-sm" onClick={() => accion(() => api.post(`/admin/campanias/${id}/cancelar`, {}), 'Programación cancelada.')}>Cancelar programación</button>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
          <label>Mandar una prueba a</label>
          <input type="email" value={prueba} onChange={(e) => setPrueba(e.target.value)} placeholder="(tu mail si lo dejás vacío)" />
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => accion(async () => { const r = await api.post(`/admin/campanias/${id}/prueba`, { destinatario: prueba || undefined }); setPrueba(''); return r; }, 'Prueba enviada.')}>Enviar prueba</button>
      </div>

      <h3>Vista previa</h3>
      {/* sandbox sin scripts: el HTML del mail nunca ejecuta nada en el panel */}
      <iframe title="Vista previa del mail" sandbox="" srcDoc={html} style={{ width: '100%', height: 560, border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }} />
    </div>
  );
}

// Admin → Campañas de mail: publicidad programada con segmento,
// estadísticas de apertura y clicks, prueba y baja automática.
export default function AdminCampanias() {
  const [campanias, setCampanias] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [listas, setListas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [abierta, setAbierta] = useState(null);

  const cargar = () => api.get('/admin/campanias').then((d) => setCampanias(d.campanias));
  useEffect(() => {
    cargar();
    api.get('/admin/ofertas').then((d) => setOfertas(d.ofertas)).catch(() => {});
    api.get('/admin/mails/listas').then((d) => setListas(d.listas || [])).catch(() => {});
    api.get('/admin/courses').then((d) => setCursos(d.courses)).catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Campañas de mail</h1>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Publicidad programada: elegí a quién, cuándo y medí aperturas y clicks.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditando(VACIA); setAbierta(null); }}>Nueva campaña</button>
      </div>

      {editando && (
        <div style={{ marginTop: 16 }}>
          <Editor
            key={editando.id || 'nueva'}
            inicial={{ ...VACIA, ...editando, segmento: { ...VACIA.segmento, ...(editando.segmento || {}) } }}
            ofertas={ofertas}
            listas={listas}
            cursos={cursos}
            onGuardada={() => { setEditando(null); cargar(); }}
            onCancelar={() => setEditando(null)}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: abierta ? 'minmax(260px, 1fr) minmax(0, 1.6fr)' : '1fr', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div className="card" style={{ margin: 0, overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Campaña</th><th>Estado</th>{!abierta && <><th>Enviados</th><th>Aperturas</th><th>Clicks</th><th>Bajas</th></>}</tr></thead>
            <tbody>
              {campanias.map((c) => (
                <tr key={c.id} onClick={() => { setAbierta(c.id); setEditando(null); }} style={{ cursor: 'pointer', background: abierta === c.id ? 'var(--color-bg-alt)' : undefined }}>
                  <td><strong>{c.nombre}</strong><div className="text-muted" style={{ fontSize: '0.8rem' }}>{c.asunto}</div></td>
                  <td><span className={`badge ${ESTADOS[c.estado]?.clase}`}>{ESTADOS[c.estado]?.label}</span>{c.estado === 'programada' && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{formatFecha(c.programada_para)}</div>}</td>
                  {!abierta && (
                    <>
                      <td>{c.estadisticas.enviados}</td>
                      <td>{c.estadisticas.abiertos}</td>
                      <td>{c.estadisticas.conClick}</td>
                      <td>{c.estadisticas.bajas}</td>
                    </>
                  )}
                </tr>
              ))}
              {campanias.length === 0 && <tr><td colSpan={6} className="text-muted">Todavía no hay campañas.</td></tr>}
            </tbody>
          </table>
        </div>
        {abierta && <Detalle key={abierta} id={abierta} onCambio={cargar} onEditar={(c) => { setEditando(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
      </div>
    </div>
  );
}
