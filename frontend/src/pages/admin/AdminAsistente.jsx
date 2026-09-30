import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

const EJEMPLOS = [
  '¿Cómo venimos este mes?',
  '¿Cuáles son los cursos más vendidos de los últimos 30 días?',
  '¿Qué alumnos van atrasados en sus cursos?',
  '¿Hay tickets sin asignar o errores nuevos?',
];

const NOMBRES_HERRAMIENTAS = {
  resumen_general: 'resumen general', buscar_usuarios: 'búsqueda de usuarios', detalle_usuario: 'ficha de usuario',
  listar_cursos: 'cursos', reporte: 'reportes', tickets: 'tickets', errores_recientes: 'errores', trafico: 'tráfico',
};

// Admin → Asistente IA: preguntas en castellano sobre los datos de la
// escuela. Solo consulta (no cambia nada).
export default function AdminAsistente() {
  const [conversaciones, setConversaciones] = useState([]);
  const [actual, setActual] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState('');
  const [modelo, setModelo] = useState('');
  const fin = useRef(null);

  const cargarLista = () => api.get('/admin/asistente').then((d) => { setConversaciones(d.conversaciones); setModelo(d.modelo); });
  useEffect(() => { cargarLista(); }, []);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, pensando]);

  async function abrir(id) {
    setError('');
    const { conversacion } = await api.get(`/admin/asistente/${id}`);
    setActual(id);
    setMensajes(conversacion.mensajes);
  }

  async function enviar(pregunta) {
    const q = (pregunta ?? texto).trim();
    if (!q || pensando) return;
    setTexto('');
    setError('');
    setMensajes((m) => [...m, { rol: 'admin', texto: q }]);
    setPensando(true);
    try {
      const r = await api.post('/admin/asistente', { conversacionId: actual, mensaje: q });
      setActual(r.conversacionId);
      setMensajes((m) => [...m, { rol: 'asistente', texto: r.respuesta || '(sin respuesta)', aviso: r.aviso, herramientas: r.herramientas }]);
      cargarLista();
    } catch (e) {
      setError(e.message);
    } finally {
      setPensando(false);
    }
  }

  async function borrar(id) {
    if (!window.confirm('¿Borrar esta conversación?')) return;
    await api.delete(`/admin/asistente/${id}`);
    if (actual === id) { setActual(null); setMensajes([]); }
    cargarLista();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 16, alignItems: 'start' }}>
      <div className="card" style={{ margin: 0 }}>
        <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => { setActual(null); setMensajes([]); }}>Nueva conversación</button>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {conversaciones.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => abrir(c.id)} style={{ flex: 1, textAlign: 'left', background: actual === c.id ? 'var(--color-bg-alt)' : 'transparent', border: 'none', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                <div style={{ fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</div>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>{formatFecha(c.updated_at)}</div>
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => borrar(c.id)} aria-label="Borrar conversación">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Asistente IA</h1>
        <p className="text-muted" style={{ margin: '4px 0 12px', fontSize: '0.85rem' }}>
          Preguntale sobre ventas, alumnos, cursos, tickets, errores o tráfico. Solo consulta datos, no cambia nada. {modelo && `Modelo: ${modelo}.`}
        </p>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mensajes.length === 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EJEMPLOS.map((e) => <button key={e} className="btn btn-outline btn-sm" onClick={() => enviar(e)}>{e}</button>)}
            </div>
          )}
          {mensajes.map((m, i) => (
            <div key={i} style={{ alignSelf: m.rol === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.rol === 'admin' ? 'var(--color-primary)' : 'var(--color-bg-alt)', color: m.rol === 'admin' ? '#fff' : undefined, padding: '10px 14px', borderRadius: 12 }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</div>
              {m.herramientas?.length > 0 && <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 6 }}>Consultó: {m.herramientas.map((h) => NOMBRES_HERRAMIENTAS[h] || h).join(', ')}</div>}
              {m.aviso && <div style={{ fontSize: '0.8rem', marginTop: 6, color: 'var(--color-danger)' }}>{m.aviso}</div>}
            </div>
          ))}
          {pensando && <div className="text-muted">Consultando…</div>}
          <div ref={fin} />
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí tu pregunta…" style={{ flex: 1 }} maxLength={4000} disabled={pensando} />
          <button className="btn btn-primary" disabled={pensando || !texto.trim()}>Enviar</button>
        </form>
      </div>
    </div>
  );
}
