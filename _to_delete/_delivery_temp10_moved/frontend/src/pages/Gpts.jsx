import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

// "GPTs": el alumno arma sus propios asistentes con personalidad fija
// (nombre + instrucciones + conocimiento de referencia opcional) usando
// una de las 3 IAs que ya vinculó en Integraciones IA. NO es lo mismo que
// un Custom GPT de ChatGPT, un Proyecto de Claude o una Gem de Gemini:
// ninguno de esos 3 se puede crear con una API key (investigado a fondo —
// las 3 son funciones exclusivas de cada app de consumidor, con cuenta
// propia, sin API pública para armarlas de afuera). Esto es el
// equivalente que SÍ se puede construir de verdad: vive 100% en esta
// plataforma y usa la vinculación que el alumno ya cargó para hablar con
// la IA real (ver backend/src/controllers/aiGpts.controller.js).
//
// "Chatear" con un GPT crea (o reutiliza, si ya la habías creado) una
// conversación en /integraciones-ia con el system prompt de ese GPT
// aplicado, y te manda directo a la pestaña Chats con esa conversación
// abierta — mismo mecanismo de "abrir conversación puntual" que ya usaba
// RegistrosTab, ahora también disparado desde acá vía navigate(state).
const PROVEEDOR_ORDEN = ['chatgpt', 'claude', 'gemini'];

export default function Gpts() {
  const navigate = useNavigate();
  const [proveedores, setProveedores] = useState([]);
  const [gpts, setGpts] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null); // id del gpt en edición, o null
  const [iniciando, setIniciando] = useState(null); // id del gpt con el que se está por chatear

  function cargarTodo() {
    return Promise.all([
      api.get('/ai/proveedores').then(({ proveedores }) => setProveedores(proveedores)),
      api.get('/ai/gpts').then(({ gpts }) => setGpts(gpts)),
    ]).catch((err) => setError(err.message));
  }

  useEffect(() => { cargarTodo().finally(() => setCargando(false)); }, []);

  function proveedorDe(clave) {
    return proveedores.find((p) => p.clave === clave);
  }

  async function chatearCon(gpt) {
    setError('');
    setIniciando(gpt.id);
    try {
      const { conversacion } = await api.post('/ai/conversaciones', { gptId: gpt.id });
      navigate('/integraciones-ia', {
        state: { abrirConversacion: { proveedorClave: conversacion.proveedor, conversacionId: conversacion.id } },
      });
    } catch (err) {
      setError(err.message);
      setIniciando(null);
    }
  }

  async function borrar(gpt) {
    if (!window.confirm(`¿Borrar el GPT "${gpt.nombre}"? Las conversaciones que ya tuviste con él no se borran, pero van a dejar de estar vinculadas a este GPT.`)) return;
    setError('');
    try {
      await api.delete(`/ai/gpts/${gpt.id}`);
      setGpts((gs) => gs.filter((g) => g.id !== gpt.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <h1>GPTs</h1>
        <p className="text-muted">
          Armá tus propios asistentes con personalidad e instrucciones fijas, usando la IA que ya vinculaste en{' '}
          <strong>Integraciones IA</strong>. No es un Custom GPT de ChatGPT ni un Proyecto de Claude ni una Gem de
          Gemini de verdad — esas 3 cosas solo se crean desde la app propia de cada proveedor, con cuenta propia, no
          hay forma de armarlas desde afuera con una API key. Esto es el equivalente que sí podemos ofrecerte: corre
          acá mismo, con tu IA real.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {cargando ? (
          <div className="spinner-msg">Cargando…</div>
        ) : (
          <>
            <div style={{ marginTop: 16, marginBottom: 20 }}>
              {!creando ? (
                <button type="button" className="btn btn-accent" onClick={() => setCreando(true)}>+ Nuevo GPT</button>
              ) : (
                <FormularioGpt
                  proveedores={proveedores}
                  onCancelar={() => setCreando(false)}
                  onGuardado={(nuevo) => { setGpts((gs) => [nuevo, ...gs]); setCreando(false); }}
                />
              )}
            </div>

            {gpts.length === 0 && !creando && (
              <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                <p className="text-muted" style={{ margin: 0 }}>Todavía no armaste ningún GPT propio.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gpts.map((gpt) => {
                const proveedor = proveedorDe(gpt.proveedor);
                const vinculado = !!proveedor?.vinculado;
                return editando === gpt.id ? (
                  <FormularioGpt
                    key={gpt.id}
                    gpt={gpt}
                    proveedores={proveedores}
                    onCancelar={() => setEditando(null)}
                    onGuardado={(actualizado) => {
                      setGpts((gs) => gs.map((g) => (g.id === actualizado.id ? actualizado : g)));
                      setEditando(null);
                    }}
                  />
                ) : (
                  <div key={gpt.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span className={`badge ${vinculado ? 'badge-success' : ''}`}>
                        {proveedor?.nombre || gpt.proveedor}{!vinculado && ' — sin vincular'}
                      </span>
                      <strong style={{ flex: 1, minWidth: 160 }}>{gpt.nombre}</strong>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(gpt.id)}>Editar</button>
                      <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => borrar(gpt)}>Borrar</button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!vinculado || iniciando === gpt.id}
                        title={!vinculado ? `Vinculá tu cuenta de ${proveedor?.nombre || gpt.proveedor} en Integraciones IA primero` : undefined}
                        onClick={() => chatearCon(gpt)}
                      >
                        {iniciando === gpt.id ? 'Abriendo…' : 'Chatear'}
                      </button>
                    </div>
                    <p style={{ marginTop: 10, marginBottom: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>
                      {gpt.instrucciones.length > 240 ? `${gpt.instrucciones.slice(0, 240)}…` : gpt.instrucciones}
                    </p>
                    {gpt.conocimiento && (
                      <p style={{ marginTop: 6, marginBottom: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        📎 Tiene conocimiento de referencia cargado.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function FormularioGpt({ gpt, proveedores, onCancelar, onGuardado }) {
  const proveedoresOrdenados = PROVEEDOR_ORDEN
    .map((clave) => proveedores.find((p) => p.clave === clave))
    .filter(Boolean);

  const [proveedor, setProveedor] = useState(gpt?.proveedor || proveedoresOrdenados[0]?.clave || '');
  const [nombre, setNombre] = useState(gpt?.nombre || '');
  const [instrucciones, setInstrucciones] = useState(gpt?.instrucciones || '');
  const [conocimiento, setConocimiento] = useState(gpt?.conocimiento || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) { setError('Falta el nombre.'); return; }
    if (!instrucciones.trim()) { setError('Faltan las instrucciones.'); return; }
    setGuardando(true);
    setError('');
    try {
      const body = { proveedor, nombre, instrucciones, conocimiento };
      const { gpt: guardado } = gpt
        ? await api.put(`/ai/gpts/${gpt.id}`, body)
        : await api.post('/ai/gpts', body);
      onGuardado(guardado);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Corrector de emails" />
        </div>
        <div className="field" style={{ minWidth: 200, marginBottom: 0 }}>
          <label>IA que usa</label>
          <select value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
            {proveedoresOrdenados.map((p) => (
              <option key={p.clave} value={p.clave}>{p.nombre}{!p.vinculado ? ' (sin vincular)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>Instrucciones (personalidad, tono, qué tiene que hacer siempre)</label>
        <textarea
          rows={5}
          value={instrucciones}
          onChange={(e) => setInstrucciones(e.target.value)}
          placeholder="Ej: Sos un asistente que corrige emails en español neutro, tono formal pero cercano. Nunca cambiás el sentido de lo que escribió el usuario, solo mejorás redacción y ortografía."
        />
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>Conocimiento de referencia (opcional — texto que la IA va a tener siempre presente)</label>
        <textarea
          rows={4}
          value={conocimiento}
          onChange={(e) => setConocimiento(e.target.value)}
          placeholder="Ej: pegá acá el glosario de términos de tu empresa, un instructivo interno, etc."
        />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-accent" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button className="btn btn-outline" type="button" onClick={onCancelar} disabled={guardando}>Cancelar</button>
      </div>
    </form>
  );
}
