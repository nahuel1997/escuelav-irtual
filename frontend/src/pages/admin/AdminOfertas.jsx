import { useEffect, useState } from 'react';
import { api, API_ORIGIN } from '../../api/client';
import { formatFecha } from '../../utils/fecha';
import CuentaRegresiva from '../../components/CuentaRegresiva';

const TIPOS = { barra: 'Barra arriba de todo', banner: 'Banner arriba del contenido', popup: 'Pop-up (una vez por sesión)' };
const AUDIENCIAS = { todos: 'Todos', visitantes: 'Visitantes sin cuenta', alumnos: 'Alumnos', profesores: 'Profesores' };

function aInputLocal(d) {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

const nueva = () => ({
  titulo: '', mensaje: '', tipo: 'barra', audiencia: 'todos', curso_id: '', descuento_pct: '',
  boton_texto: 'Ver oferta', boton_url: '', imagen_url: '', color_fondo: '#e0972d', color_texto: '#1a1f26',
  inicia_en: aInputLocal(new Date()), termina_en: aInputLocal(new Date(Date.now() + 3 * 86400000)),
  mostrar_contador: true, activa: true, prioridad: 0,
});

function estadoDe(o) {
  const ahora = Date.now();
  if (!o.activa) return { label: 'Pausada', clase: '' };
  if (new Date(o.inicia_en).getTime() > ahora) return { label: 'Programada', clase: 'badge-warning' };
  if (new Date(o.termina_en).getTime() <= ahora) return { label: 'Terminada', clase: '' };
  return { label: 'En curso', clase: 'badge-success' };
}

// Admin → Ofertas en la app: barras, banners y pop-ups con cuenta
// regresiva; si se asocia un curso con descuento, la tienda y el carrito
// cobran el precio con descuento mientras dure la oferta.
export default function AdminOfertas() {
  const [ofertas, setOfertas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/admin/ofertas').then((d) => setOfertas(d.ofertas));
  useEffect(() => {
    cargar();
    api.get('/admin/courses').then((d) => setCursos(d.courses)).catch(() => {});
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setError('');
    try {
      const body = {
        ...form,
        curso_id: form.curso_id || null,
        descuento_pct: form.descuento_pct === '' ? null : Number(form.descuento_pct),
        inicia_en: new Date(form.inicia_en).toISOString(),
        termina_en: new Date(form.termina_en).toISOString(),
      };
      if (form.id) await api.put(`/admin/ofertas/${form.id}`, body);
      else await api.post('/admin/ofertas', body);
      setForm(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function subirImagen(ev) {
    const archivo = ev.target.files && ev.target.files[0];
    if (!archivo) return;
    const fd = new FormData();
    fd.append('imagen', archivo);
    const { url } = await api.postForm('/admin/upload-imagen', fd);
    setForm((f) => ({ ...f, imagen_url: url }));
  }

  const curso = form && cursos.find((c) => String(c.id) === String(form.curso_id));
  const precioOferta = curso && form.descuento_pct ? Math.round(Number(curso.precio) * (100 - Number(form.descuento_pct))) / 100 : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Ofertas en la app</h1>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Mensajes promocionales con cuenta regresiva dentro del sitio. Con un curso y un %, el descuento se cobra de verdad.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setForm(nueva())}>Nueva oferta</button>
      </div>

      {form && (
        <form className="card" onSubmit={guardar} style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>{form.id ? 'Editar oferta' : 'Nueva oferta'}</h3>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 2, minWidth: 220 }}><label>Título</label><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={120} required /></div>
            <div className="field"><label>Formato</label><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field"><label>Para</label><select value={form.audiencia} onChange={(e) => setForm({ ...form, audiencia: e.target.value })}>{Object.entries(AUDIENCIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="field"><label>Mensaje</label><input value={form.mensaje || ''} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} maxLength={500} /></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="field"><label>Empieza</label><input type="datetime-local" value={form.inicia_en} onChange={(e) => setForm({ ...form, inicia_en: e.target.value })} required /></div>
            <div className="field"><label>Termina</label><input type="datetime-local" value={form.termina_en} onChange={(e) => setForm({ ...form, termina_en: e.target.value })} required /></div>
            <div className="field" style={{ minWidth: 220 }}>
              <label>Curso en oferta (opcional)</label>
              <select value={form.curso_id || ''} onChange={(e) => setForm({ ...form, curso_id: e.target.value, descuento_pct: e.target.value ? form.descuento_pct : '' })}>
                <option value="">Ninguno</option>
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </div>
            <div className="field" style={{ width: 130 }}><label>Descuento %</label><input type="number" min={1} max={90} value={form.descuento_pct} disabled={!form.curso_id} onChange={(e) => setForm({ ...form, descuento_pct: e.target.value })} /></div>
          </div>
          {precioOferta !== null && <p className="text-muted">Precio con descuento: <s>${Number(curso.precio).toLocaleString('es-AR')}</s> <strong>${precioOferta.toLocaleString('es-AR')}</strong></p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field"><label>Texto del botón</label><input value={form.boton_texto || ''} onChange={(e) => setForm({ ...form, boton_texto: e.target.value })} maxLength={60} /></div>
            <div className="field" style={{ minWidth: 220 }}><label>Link del botón</label><input value={form.boton_url || ''} onChange={(e) => setForm({ ...form, boton_url: e.target.value })} placeholder={form.curso_id ? `/tienda/${form.curso_id} (automático)` : '/tienda o https://…'} /></div>
            <div className="field"><label>Fondo</label><input type="color" value={form.color_fondo} onChange={(e) => setForm({ ...form, color_fondo: e.target.value })} /></div>
            <div className="field"><label>Texto</label><input type="color" value={form.color_texto} onChange={(e) => setForm({ ...form, color_texto: e.target.value })} /></div>
            {form.tipo !== 'barra' && <div className="field"><label>Imagen</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={subirImagen} /></div>}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '4px 0 12px' }}>
            <label><input type="checkbox" checked={form.mostrar_contador} onChange={(e) => setForm({ ...form, mostrar_contador: e.target.checked })} /> Mostrar cuenta regresiva</label>
            <label><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Activa</label>
            <label>Prioridad <input type="number" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: Number(e.target.value) })} style={{ width: 70 }} /></label>
          </div>

          <p className="text-muted" style={{ margin: '0 0 6px' }}>Vista previa:</p>
          <div style={{ background: form.color_fondo, color: form.color_texto, padding: form.tipo === 'barra' ? '8px 16px' : 16, borderRadius: form.tipo === 'barra' ? 0 : 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: form.tipo === 'barra' ? 'center' : 'flex-start' }}>
            {form.tipo !== 'barra' && form.imagen_url && <img src={form.imagen_url.startsWith('/uploads') ? `${API_ORIGIN}${form.imagen_url}` : form.imagen_url} alt="" style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 6 }} />}
            <strong>{form.titulo || 'Título de la oferta'}</strong>
            {form.mensaje && <span>{form.mensaje}</span>}
            {form.mostrar_contador && form.termina_en && <CuentaRegresiva hasta={new Date(form.termina_en).toISOString()} />}
            {form.boton_texto && <span className="btn btn-sm" style={{ background: form.color_texto, color: form.color_fondo }}>{form.boton_texto}</span>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary">Guardar</button>
            <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Oferta</th><th>Formato</th><th>Para</th><th>Vigencia</th><th>Estado</th><th>Vistas</th><th>Clicks</th><th></th></tr></thead>
          <tbody>
            {ofertas.map((o) => {
              const est = estadoDe(o);
              return (
                <tr key={o.id}>
                  <td><strong>{o.titulo}</strong>{o.curso_titulo && <div className="text-muted" style={{ fontSize: '0.8rem' }}>{o.curso_titulo}{o.descuento_pct ? ` · -${o.descuento_pct}%` : ''}</div>}</td>
                  <td>{o.tipo}</td>
                  <td>{AUDIENCIAS[o.audiencia]}</td>
                  <td style={{ fontSize: '0.85rem' }}>{formatFecha(o.inicia_en)} → {formatFecha(o.termina_en)}</td>
                  <td><span className={`badge ${est.clase}`}>{est.label}</span></td>
                  <td>{o.estadisticas.vistas}</td>
                  <td>{o.estadisticas.clicks}{o.estadisticas.vistas ? ` (${Math.round((o.estadisticas.clicks / o.estadisticas.vistas) * 100)}%)` : ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setForm({ ...o, curso_id: o.curso_id || '', descuento_pct: o.descuento_pct ?? '', inicia_en: aInputLocal(o.inicia_en), termina_en: aInputLocal(o.termina_en) })}>Editar</button>{' '}
                    <button className="btn btn-outline btn-sm" onClick={async () => { if (window.confirm('¿Borrar la oferta?')) { await api.delete(`/admin/ofertas/${o.id}`); cargar(); } }}>Borrar</button>
                  </td>
                </tr>
              );
            })}
            {ofertas.length === 0 && <tr><td colSpan={8} className="text-muted">Todavía no hay ofertas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
