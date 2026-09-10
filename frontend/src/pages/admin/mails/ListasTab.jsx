import { useEffect, useState } from 'react';
import { api } from '../../../api/client';

// Mismo estilo que .field input en global.css, para inputs sueltos que no
// están dentro de un <div className="field"> con label (formularios
// compactos de este panel).
const estiloInput = {
  fontFamily: 'inherit', fontSize: '0.95rem', padding: '10px 12px',
  border: '1.5px solid var(--color-border)', borderRadius: 8, background: '#fff', color: 'var(--color-text)',
};

// Listas armables a mano (alumnos y/o profesores) para el mail de
// ofertas/avisos. El mail en sí usa la plantilla "oferta_aviso" (editable
// desde la pestaña Plantillas) pero el título y el mensaje de cada envío
// se escriben acá, en el momento — así una misma plantilla sirve tanto
// para "Black Friday" como para un aviso de mantenimiento.
export default function ListasTab() {
  const [listas, setListas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionada, setSeleccionada] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [creando, setCreando] = useState(false);

  function cargarListas() {
    return api.get('/admin/mails/listas').then(({ listas }) => setListas(listas)).catch((err) => setError(err.message));
  }

  useEffect(() => { cargarListas().finally(() => setCargando(false)); }, []);

  async function crearLista(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    setError('');
    try {
      const { lista } = await api.post('/admin/mails/listas', { nombre, descripcion });
      setNombre('');
      setDescripcion('');
      await cargarListas();
      setSeleccionada(lista.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function borrarLista(id) {
    await api.delete(`/admin/mails/listas/${id}`);
    if (seleccionada === id) setSeleccionada(null);
    await cargarListas();
  }

  if (cargando) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 260, flex: '0 0 260px' }}>
        <form onSubmit={crearLista} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <strong style={{ fontSize: '0.9rem' }}>Nueva lista</strong>
          <input style={estiloInput} placeholder="Nombre (ej: Oferta Black Friday)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input style={estiloInput} placeholder="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          <button className="btn btn-primary btn-sm" type="submit" disabled={creando || !nombre.trim()}>
            {creando ? 'Creando…' : 'Crear lista'}
          </button>
        </form>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {listas.map((l) => (
            <button
              key={l.id}
              className={`card ${seleccionada === l.id ? 'card-active' : ''}`}
              style={{ textAlign: 'left', cursor: 'pointer', border: seleccionada === l.id ? '2px solid var(--color-primary)' : undefined }}
              onClick={() => setSeleccionada(l.id)}
            >
              <strong>{l.nombre}</strong>
              <div className="text-muted" style={{ fontSize: '0.78rem' }}>{l.cantidad_miembros} miembro(s)</div>
            </button>
          ))}
          {listas.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Todavía no hay listas creadas.</p>}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 320 }}>
        {seleccionada ? (
          <DetalleLista listaId={seleccionada} onBorrar={() => borrarLista(seleccionada)} />
        ) : (
          <p className="text-muted">Elegí una lista de la izquierda (o creá una nueva) para ver sus miembros y mandar un aviso.</p>
        )}
      </div>
    </div>
  );
}

function DetalleLista({ listaId, onBorrar }) {
  const [miembros, setMiembros] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState('');

  function cargar() {
    setCargando(true);
    return api.get(`/admin/mails/listas/${listaId}/miembros`)
      .then((d) => { setMiembros(d.miembros); setDisponibles(d.disponibles); })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [listaId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function agregar(userId) {
    await api.post(`/admin/mails/listas/${listaId}/miembros`, { user_id: userId });
    cargar();
  }

  async function agregarTodos() {
    await api.post(`/admin/mails/listas/${listaId}/miembros/todos`, {});
    cargar();
  }

  async function quitar(userId) {
    await api.delete(`/admin/mails/listas/${listaId}/miembros/${userId}`);
    cargar();
  }

  async function quitarTodos() {
    await api.delete(`/admin/mails/listas/${listaId}/miembros/todos`);
    cargar();
  }

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setResultadoEnvio('');
    setError('');
    try {
      const res = await api.post(`/admin/mails/listas/${listaId}/enviar`, { titulo, mensaje });
      setResultadoEnvio(`Enviado a ${res.enviados}/${res.total} miembro(s).`);
      setTitulo('');
      setMensaje('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={onBorrar}>Borrar esta lista</button>
      </div>

      <form onSubmit={enviar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <strong>Mandar oferta / aviso a esta lista</strong>
        <input style={estiloInput} placeholder="Título (asunto del mail)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <textarea style={estiloInput} rows={4} placeholder="Mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
        <button className="btn btn-accent btn-sm" type="submit" disabled={enviando || !titulo.trim() || !mensaje.trim() || miembros.length === 0} style={{ alignSelf: 'flex-start' }}>
          {enviando ? 'Enviando…' : `Enviar a ${miembros.length} miembro(s)`}
        </button>
        {resultadoEnvio && <p style={{ color: '#1a8a4a', fontSize: '0.85rem', margin: 0 }}>{resultadoEnvio}</p>}
      </form>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.9rem' }}>Miembros ({miembros.length})</strong>
            {miembros.length > 0 && <button className="btn btn-outline btn-sm" onClick={quitarTodos}>Quitar todos</button>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
            {miembros.map((m) => (
              <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
                <span style={{ fontSize: '0.85rem' }}>{m.nombre} {m.apellido} <span className="badge">{m.rol}</span></span>
                <button className="btn btn-outline btn-sm" onClick={() => quitar(m.id)}>Quitar</button>
              </div>
            ))}
            {miembros.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Sin miembros todavía.</p>}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.9rem' }}>Disponibles ({disponibles.length})</strong>
            {disponibles.length > 0 && <button className="btn btn-outline btn-sm" onClick={agregarTodos}>Seleccionar todos</button>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
            {disponibles.map((u) => (
              <div key={u.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
                <span style={{ fontSize: '0.85rem' }}>{u.nombre} {u.apellido} <span className="badge">{u.rol}</span></span>
                <button className="btn btn-outline btn-sm" onClick={() => agregar(u.id)}>Agregar</button>
              </div>
            ))}
            {disponibles.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem' }}>No quedan alumnos/profesores para agregar.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
