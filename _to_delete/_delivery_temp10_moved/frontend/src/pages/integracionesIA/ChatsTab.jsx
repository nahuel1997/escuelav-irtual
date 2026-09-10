import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

// Pestaña "Chats": panel a la izquierda para elegir a qué IA consultar
// (solo las vinculadas se pueden abrir — mismo criterio de permisos que
// Registros) y navegar entre las conversaciones que ya tenés con ella, más
// la ventana de chat a la derecha. A diferencia del chat de las clases en
// vivo (LiveClassChat.jsx, por socket), acá cada mensaje es un pedido
// HTTP normal: no es una charla entre 2 personas en simultáneo, es
// pregunta → el backend le pega a la IA real → respuesta (ver
// POST /ai/conversaciones/:id/mensajes).
export default function ChatsTab({ proveedores, aAbrir, onConsumirAAbrir }) {
  const [proveedorActivo, setProveedorActivo] = useState(null);
  const [conversaciones, setConversaciones] = useState([]);
  const [cargandoConversaciones, setCargandoConversaciones] = useState(false);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [error, setError] = useState('');

  function cargarConversaciones(proveedorClave) {
    setCargandoConversaciones(true);
    return api.get(`/ai/conversaciones?proveedor=${proveedorClave}`)
      .then(({ conversaciones }) => setConversaciones(conversaciones))
      .catch((err) => setError(err.message))
      .finally(() => setCargandoConversaciones(false));
  }

  function abrirConversacion(conversacion) {
    setConversacionActiva(conversacion);
    setCargandoMensajes(true);
    setError('');
    api.get(`/ai/conversaciones/${conversacion.id}/mensajes`)
      .then(({ mensajes }) => setMensajes(mensajes))
      .catch((err) => setError(err.message))
      .finally(() => setCargandoMensajes(false));
  }

  function seleccionarProveedor(p) {
    if (!p.vinculado) return;
    setProveedorActivo(p);
    setConversacionActiva(null);
    setMensajes([]);
    cargarConversaciones(p.clave);
  }

  async function nuevaConversacion() {
    if (!proveedorActivo) return;
    setError('');
    try {
      const { conversacion } = await api.post('/ai/conversaciones', { proveedor: proveedorActivo.clave });
      setConversaciones((cs) => [conversacion, ...cs]);
      abrirConversacion(conversacion);
    } catch (err) {
      setError(err.message);
    }
  }

  // Reabrir una conversación puntual pedida desde "Registros" (ver
  // IntegracionesIA.jsx): buscamos el proveedor en el catálogo ya
  // cargado, cargamos sus conversaciones y abrimos la pedida.
  useEffect(() => {
    if (!aAbrir) return;
    const p = proveedores.find((x) => x.clave === aAbrir.proveedorClave);
    if (!p || !p.vinculado) { onConsumirAAbrir(); return; }
    setProveedorActivo(p);
    setCargandoConversaciones(true);
    api.get(`/ai/conversaciones?proveedor=${p.clave}`)
      .then(({ conversaciones }) => {
        setConversaciones(conversaciones);
        const objetivo = conversaciones.find((c) => c.id === aAbrir.conversacionId);
        if (objetivo) abrirConversacion(objetivo);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setCargandoConversaciones(false);
        onConsumirAAbrir();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aAbrir]);

  const hayVinculadas = proveedores.some((p) => p.vinculado);

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 10 }}>Elegí una IA</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {proveedores.map((p) => (
              <button
                key={p.clave}
                type="button"
                disabled={!p.vinculado}
                onClick={() => seleccionarProveedor(p)}
                title={!p.vinculado ? 'Vinculá esta IA primero en la pestaña Vinculaciones' : undefined}
                style={{
                  textAlign: 'left',
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: p.vinculado ? 'pointer' : 'not-allowed',
                  background: proveedorActivo?.clave === p.clave ? 'var(--color-bg-alt)' : 'transparent',
                  color: p.vinculado ? 'var(--color-text)' : 'var(--color-text-muted)',
                  fontWeight: proveedorActivo?.clave === p.clave ? 700 : 500,
                  fontSize: '0.9rem',
                  opacity: p.vinculado ? 1 : 0.7,
                }}
              >
                {p.nombre}
                {!p.vinculado && <span className="badge" style={{ marginLeft: 8, fontSize: '0.65rem' }}>Sin vincular</span>}
              </button>
            ))}
          </div>
        </div>

        {proveedorActivo && (
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: '0.85rem' }}>Conversaciones</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={nuevaConversacion}>+ Nueva</button>
            </div>
            {cargandoConversaciones && <p className="text-muted" style={{ fontSize: '0.8rem' }}>Cargando…</p>}
            {!cargandoConversaciones && conversaciones.length === 0 && (
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>Todavía no tenés conversaciones con {proveedorActivo.nombre}.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {conversaciones.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => abrirConversacion(c)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    background: conversacionActiva?.id === c.id ? 'var(--color-primary)' : 'var(--color-bg-alt)',
                    color: conversacionActiva?.id === c.id ? '#fff' : 'var(--color-text)',
                    fontSize: '0.85rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.gpt_nombre ? `🤖 ${c.titulo}` : c.titulo}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 280 }}>
        {error && <div className="alert alert-error">{error}</div>}

        {!proveedorActivo && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="text-muted" style={{ margin: 0 }}>
              {hayVinculadas
                ? 'Elegí una IA de la izquierda para empezar a chatear.'
                : 'Todavía no vinculaste ninguna IA — hacelo desde la pestaña "Vinculaciones" para poder chatear acá.'}
            </p>
          </div>
        )}

        {proveedorActivo && !conversacionActiva && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="text-muted" style={{ margin: 0 }}>Elegí una conversación o creá una nueva para empezar a chatear con {proveedorActivo.nombre}.</p>
          </div>
        )}

        {conversacionActiva && (
          <VentanaDeChat
            conversacion={conversacionActiva}
            mensajes={mensajes}
            cargando={cargandoMensajes}
            onMensajesActualizados={setMensajes}
            onConversacionTocada={() => setConversaciones((cs) => {
              const resto = cs.filter((c) => c.id !== conversacionActiva.id);
              return [conversacionActiva, ...resto];
            })}
          />
        )}
      </div>
    </div>
  );
}

function VentanaDeChat({ conversacion, mensajes, cargando, onMensajesActualizados, onConversacionTocada }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const listaRef = useRef(null);

  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensajes]);

  async function enviar(e) {
    e.preventDefault();
    const contenido = texto.trim();
    if (!contenido || enviando) return;
    setEnviando(true);
    setError('');
    // Optimista: mostramos el mensaje del alumno de una, la respuesta de
    // la IA llega después (puede tardar unos segundos, es una llamada
    // real) — así el chat se siente responsivo aunque la IA tarde.
    const mensajeOptimista = { id: `local-${Date.now()}`, rol: 'user', contenido, optimista: true };
    onMensajesActualizados([...mensajes, mensajeOptimista]);
    setTexto('');
    try {
      const { mensajeUsuario, mensajeAsistente } = await api.post(`/ai/conversaciones/${conversacion.id}/mensajes`, { contenido });
      onMensajesActualizados([...mensajes, mensajeUsuario, mensajeAsistente]);
      onConversacionTocada();
    } catch (err) {
      // El mensaje del alumno igual quedó guardado del lado del backend
      // (ver ai.controller.js::mandarMensaje) — refrescamos para no dejar
      // el optimista pegado si algo no coincide exactamente.
      setError(err.message);
      onMensajesActualizados([...mensajes, mensajeOptimista]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 560, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <strong style={{ fontSize: '0.95rem' }}>{conversacion.titulo}</strong>
        {conversacion.gpt_nombre && (
          <span className="text-muted" style={{ fontSize: '0.78rem', marginLeft: 8 }}>— GPT: {conversacion.gpt_nombre}</span>
        )}
      </div>

      <div ref={listaRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cargando && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Cargando mensajes…</p>}
        {!cargando && mensajes.length === 0 && (
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>Todavía no hay mensajes. ¡Arrancá la conversación!</p>
        )}
        {mensajes.map((m) => {
          const esAlumno = m.rol === 'user';
          return (
            <div
              key={m.id}
              style={{
                alignSelf: esAlumno ? 'flex-end' : 'flex-start',
                background: esAlumno ? 'var(--color-primary)' : 'var(--color-bg-alt)',
                color: esAlumno ? '#fff' : 'var(--color-text)',
                padding: '8px 12px',
                borderRadius: 12,
                maxWidth: '85%',
                fontSize: '0.85rem',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
                opacity: m.optimista ? 0.7 : 1,
              }}
            >
              {m.contenido}
            </div>
          );
        })}
        {enviando && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            Pensando…
          </div>
        )}
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.78rem', margin: '0 14px 8px' }}>{error}</p>}

      <form onSubmit={enviar} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--color-border)' }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí tu mensaje…"
          style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit' }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
