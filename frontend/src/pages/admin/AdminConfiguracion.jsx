import { useEffect, useState } from 'react';
import { api, API_ORIGIN } from '../../api/client';
import { formatFecha } from '../../utils/fecha';
import { refrescarEstadoPublico } from '../../hooks/useEstadoPublico';

function useGuardar(seccion, onGuardado) {
  const [estado, setEstado] = useState('');
  async function guardar(valor) {
    setEstado('guardando');
    try {
      const r = await api.put(`/admin/configuracion/${seccion}`, valor);
      setEstado('ok');
      refrescarEstadoPublico();
      onGuardado(seccion, r.valor);
      setTimeout(() => setEstado(''), 2500);
    } catch (e) {
      setEstado(e.message);
    }
  }
  const aviso = estado && estado !== 'guardando'
    ? <div className={`alert ${estado === 'ok' ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 12 }}>{estado === 'ok' ? 'Guardado.' : estado}</div>
    : null;
  return { guardar, guardando: estado === 'guardando', aviso };
}

// "YYYY-MM-DDTHH:mm" local para un <input type="datetime-local">.
function aInputLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TabMantenimiento({ valor, onGuardado }) {
  const [v, setV] = useState(valor);
  const { guardar, guardando, aviso } = useGuardar('mantenimiento', onGuardado);
  const roles = [['alumno', 'Alumnos'], ['profesor', 'Profesores'], ['soporte', 'Agentes de soporte']];
  const alguno = roles.some(([r]) => v[r]);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Modo mantenimiento</h3>
      <p className="text-muted">
        Los roles marcados ven una pantalla de "estamos en mantenimiento" y la API les responde 503. El panel de admin
        siempre sigue andando. Si cargás "hasta", se apaga solo a esa hora.
      </p>
      {alguno && <div className="alert alert-error">Hay roles en mantenimiento ahora mismo.</div>}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '12px 0' }}>
        {roles.map(([r, label]) => (
          <label key={r} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={Boolean(v[r])} onChange={(e) => setV({ ...v, [r]: e.target.checked })} /> {label}
          </label>
        ))}
      </div>
      <div className="field">
        <label>Mensaje</label>
        <textarea rows={3} value={v.mensaje || ''} onChange={(e) => setV({ ...v, mensaje: e.target.value })} maxLength={500} />
      </div>
      <div className="field" style={{ maxWidth: 280 }}>
        <label>Hasta (opcional)</label>
        <input type="datetime-local" value={aInputLocal(v.hasta)} onChange={(e) => setV({ ...v, hasta: e.target.value ? new Date(e.target.value).toISOString() : null })} />
      </div>
      <button className="btn btn-primary" disabled={guardando} onClick={() => guardar(v)}>Guardar</button>
      {aviso}
    </div>
  );
}

function TabPaginasError({ valor, onGuardado }) {
  const [v, setV] = useState(valor);
  const { guardar, guardando, aviso } = useGuardar('paginas_error', onGuardado);
  const campo = (k, label, filas) => (
    <div className="field">
      <label>{label}</label>
      {filas ? <textarea rows={filas} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <input value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
    </div>
  );
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Páginas de error</h3>
      <p className="text-muted">Textos que ve el usuario cuando entra a un link que no existe (404) o cuando una pantalla falla.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div>{campo('titulo404', 'Título "página no encontrada"')}{campo('texto404', 'Texto', 3)}</div>
        <div>{campo('titulo500', 'Título "algo salió mal"')}{campo('texto500', 'Texto', 3)}</div>
      </div>
      <button className="btn btn-primary" disabled={guardando} onClick={() => guardar(v)}>Guardar</button>
      {aviso}
    </div>
  );
}

function TabModoOscuro({ valor, onGuardado }) {
  const [v, setV] = useState(valor);
  const { guardar, guardando, aviso } = useGuardar('modo_oscuro', onGuardado);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Modo oscuro</h3>
      <p className="text-muted">
        Se arma invirtiendo los colores del sitio (mismo enfoque que DBA24) — las imágenes y videos se ven normales.
        Cada alumno/profesor lo prende o apaga desde su menú; acá se elige si está disponible, si arranca prendido y
        su intensidad.
      </p>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '8px 0' }}>
        <input type="checkbox" checked={Boolean(v.habilitado)} onChange={(e) => setV({ ...v, habilitado: e.target.checked })} /> Disponible para los usuarios
      </label>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '8px 0' }}>
        <input type="checkbox" checked={Boolean(v.porDefectoActivo)} onChange={(e) => setV({ ...v, porDefectoActivo: e.target.checked })} /> Prendido por defecto (para quien no eligió)
      </label>
      <div className="field" style={{ maxWidth: 360 }}>
        <label>Intensidad: {v.intensidad}%</label>
        <input type="range" min={50} max={100} value={v.intensidad} onChange={(e) => setV({ ...v, intensidad: Number(e.target.value) })} />
      </div>
      <div className="field" style={{ maxWidth: 360 }}>
        <label>Contraste: {v.contraste}%</label>
        <input type="range" min={70} max={120} value={v.contraste} onChange={(e) => setV({ ...v, contraste: Number(e.target.value) })} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ filter: `invert(${v.intensidad}%) hue-rotate(180deg) contrast(${v.contraste}%)`, background: '#fff', color: '#1a1f26', border: '1px solid #ddd', borderRadius: 8, padding: 12, width: 220 }}>
          <strong style={{ color: '#1c3d5a' }}>Vista previa</strong>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Así se vería una tarjeta del sitio.</p>
        </div>
      </div>
      <div style={{ marginTop: 12 }}><button className="btn btn-primary" disabled={guardando} onClick={() => guardar(v)}>Guardar</button></div>
      {aviso}
    </div>
  );
}

function TabFeriados({ valor, onGuardado }) {
  const [dias, setDias] = useState(valor.dias || []);
  const [nuevo, setNuevo] = useState({ fecha: '', nombre: '' });
  const { guardar, guardando, aviso } = useGuardar('feriados', (s, val) => { setDias(val.dias); onGuardado(s, val); });
  function agregar(e) {
    e.preventDefault();
    if (!nuevo.fecha || !nuevo.nombre.trim()) return;
    setDias([...dias.filter((d) => d.fecha !== nuevo.fecha), { fecha: nuevo.fecha, nombre: nuevo.nombre.trim() }].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    setNuevo({ fecha: '', nombre: '' });
  }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Feriados</h3>
      <p className="text-muted">Se marcan en los calendarios y no se pueden pedir turnos esos días.</p>
      <form onSubmit={agregar} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}><label>Fecha</label><input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} /></div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}><label>Nombre</label><input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} maxLength={80} /></div>
        <button className="btn btn-outline btn-sm">Agregar</button>
      </form>
      <table style={{ marginTop: 12 }}>
        <tbody>
          {dias.map((d) => (
            <tr key={d.fecha}>
              <td style={{ width: 140 }}>{new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
              <td>{d.nombre}</td>
              <td style={{ width: 40 }}><button className="btn btn-outline btn-sm" onClick={() => setDias(dias.filter((x) => x.fecha !== d.fecha))} aria-label={`Quitar ${d.nombre}`}>×</button></td>
            </tr>
          ))}
          {dias.length === 0 && <tr><td className="text-muted">Sin feriados cargados.</td></tr>}
        </tbody>
      </table>
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={guardando} onClick={() => guardar({ dias })}>Guardar feriados</button>
      {aviso}
    </div>
  );
}

function TabLogoMail({ valor, onGuardado }) {
  const [v, setV] = useState(valor);
  const [subiendo, setSubiendo] = useState(false);
  const { guardar, guardando, aviso } = useGuardar('logo_mail', onGuardado);
  async function subir(e) {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('imagen', archivo);
      const { url } = await api.postForm('/admin/upload-imagen', form);
      setV({ ...v, logoUrl: url });
    } finally {
      setSubiendo(false);
    }
  }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Encabezado de los mails</h3>
      <p className="text-muted">Logo propio para los mails (distinto del logo del sitio) o, si no hay logo, un texto. Se usa en las campañas y en los mails nuevos.</p>
      <div className="field"><label>Logo</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={subir} disabled={subiendo} /></div>
      {v.logoUrl && <button className="btn btn-outline btn-sm" onClick={() => setV({ ...v, logoUrl: '' })}>Quitar logo</button>}
      <div className="field" style={{ marginTop: 12 }}><label>Texto (si no hay logo)</label><input value={v.texto || ''} onChange={(e) => setV({ ...v, texto: e.target.value })} maxLength={80} /></div>
      <div className="field" style={{ maxWidth: 200 }}><label>Color de fondo</label><input type="color" value={v.colorFondo || '#1c3d5a'} onChange={(e) => setV({ ...v, colorFondo: e.target.value })} /></div>
      <div style={{ background: v.colorFondo, color: '#fff', padding: '16px 20px', borderRadius: 8, maxWidth: 520, fontWeight: 700 }}>
        {v.logoUrl ? <img src={v.logoUrl.startsWith('/uploads') ? `${API_ORIGIN}${v.logoUrl}` : v.logoUrl} alt="Logo" style={{ maxHeight: 40 }} /> : v.texto}
      </div>
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={guardando || subiendo} onClick={() => guardar(v)}>Guardar</button>
      {aviso}
    </div>
  );
}

function TabJobs() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState({});
  const [corriendo, setCorriendo] = useState(null);
  const cargar = () => api.get('/admin/jobs').then(setData).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function actualizar(clave, patch) {
    setError('');
    try {
      setData(await api.put(`/admin/jobs/${clave}`, patch));
      setEditando((e) => ({ ...e, [clave]: undefined }));
    } catch (e) {
      setError(e.message);
    }
  }
  async function ejecutar(clave) {
    setCorriendo(clave);
    setError('');
    try {
      await api.post(`/admin/jobs/${clave}/ejecutar`, {});
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setCorriendo(null);
    }
  }

  if (!data) return <div className="card">{error || 'Cargando…'}</div>;
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Tareas programadas</h3>
      {!data.habilitadosPorEnv && <div className="alert alert-error">Las tareas están apagadas en el servidor (JOBS_HABILITADOS=false): se pueden configurar y ejecutar a mano, pero no corren solas.</div>}
      <p className="text-muted">Horario en formato cron (minuto hora día mes día-de-semana). Ej: <code>0 9 * * *</code> = todos los días a las 9; <code>*/30 * * * *</code> = cada 30 minutos.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <table>
        <thead><tr><th>Tarea</th><th>Activa</th><th>Horario</th><th>Última ejecución</th><th></th></tr></thead>
        <tbody>
          {data.jobs.map((j) => (
            <tr key={j.clave}>
              <td><strong>{j.nombre}</strong><div className="text-muted" style={{ fontSize: '0.8rem' }}>{j.descripcion}</div></td>
              <td><input type="checkbox" checked={j.activo} onChange={(e) => actualizar(j.clave, { activo: e.target.checked })} aria-label={`Activar ${j.nombre}`} /></td>
              <td style={{ minWidth: 190 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={editando[j.clave] ?? j.cron} onChange={(e) => setEditando({ ...editando, [j.clave]: e.target.value })} style={{ width: 120, fontFamily: 'monospace' }} />
                  {editando[j.clave] !== undefined && editando[j.clave] !== j.cron && (
                    <button className="btn btn-primary btn-sm" onClick={() => actualizar(j.clave, { cron: editando[j.clave] })}>OK</button>
                  )}
                </div>
                {j.cron !== j.cronPorDefecto && <button className="btn btn-outline btn-sm" style={{ marginTop: 4, fontSize: '0.7rem' }} onClick={() => actualizar(j.clave, { cron: j.cronPorDefecto })}>Volver a {j.cronPorDefecto}</button>}
              </td>
              <td style={{ fontSize: '0.85rem' }}>
                {j.ultimaEjecucion ? formatFecha(j.ultimaEjecucion) : <span className="text-muted">Nunca</span>}
                {j.ultimoResultado && <div style={{ color: j.ultimoOk ? 'var(--color-success, #1a7f4b)' : 'var(--color-danger)' }}>{j.ultimoResultado}</div>}
              </td>
              <td><button className="btn btn-outline btn-sm" disabled={corriendo === j.clave} onClick={() => ejecutar(j.clave)}>{corriendo === j.clave ? 'Corriendo…' : 'Ejecutar ahora'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Admin → Configuración (portado de la pestaña Configuración de DBA24).
export default function AdminConfiguracion() {
  const [tab, setTab] = useState('mantenimiento');
  const [secciones, setSecciones] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/admin/configuracion').then((d) => setSecciones(d.secciones)).catch((e) => setError(e.message)); }, []);
  const onGuardado = (s, valor) => setSecciones((prev) => ({ ...prev, [s]: valor }));

  const tabs = [
    ['mantenimiento', 'Mantenimiento'],
    ['paginas_error', 'Páginas de error'],
    ['modo_oscuro', 'Modo oscuro'],
    ['feriados', 'Feriados'],
    ['logo_mail', 'Logo de mails'],
    ['jobs', 'Tareas programadas'],
  ];

  return (
    <div>
      <h1 style={{ margin: 0 }}>Configuración</h1>
      <div style={{ display: 'flex', gap: 6, marginTop: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {tabs.map(([k, label]) => <button key={k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
        {tab === 'jobs' ? <TabJobs /> : !secciones ? <p className="text-muted">Cargando…</p> : (
          <>
            {tab === 'mantenimiento' && <TabMantenimiento valor={secciones.mantenimiento} onGuardado={onGuardado} />}
            {tab === 'paginas_error' && <TabPaginasError valor={secciones.paginas_error} onGuardado={onGuardado} />}
            {tab === 'modo_oscuro' && <TabModoOscuro valor={secciones.modo_oscuro} onGuardado={onGuardado} />}
            {tab === 'feriados' && <TabFeriados valor={secciones.feriados} onGuardado={onGuardado} />}
            {tab === 'logo_mail' && <TabLogoMail valor={secciones.logo_mail} onGuardado={onGuardado} />}
          </>
        )}
      </div>
    </div>
  );
}
