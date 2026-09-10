import { useEffect, useState } from 'react';
import { api } from '../api/client';

const nodoVacio = () => ({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nombre: '', rol: '', instrucciones: '', proveedor: 'claude' });

// Sandbox de orquestación de agentes: el alumno arma una cadena de
// agentes (cada uno con nombre, rol, instrucciones y un proveedor de IA)
// y la "ejecuta" para ver cómo se pasarían el trabajo entre sí — un
// agente detrás del otro, donde la salida de uno es la entrada del
// siguiente. Hoy la ejecución es 100% simulada en el backend (sin
// conectar a ninguna IA real todavía, ver services/agentProviders/ del
// backend) — el objetivo es entender el concepto de orquestación antes de
// engancharlo a un proveedor real más adelante.
export default function AgentSandbox() {
  const [proveedores, setProveedores] = useState([]);
  const [flujos, setFlujos] = useState([]);
  const [flujoId, setFlujoId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [nodos, setNodos] = useState([nodoVacio()]);
  const [resultado, setResultado] = useState(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  function cargarFlujos() {
    return api.get('/agentes/flujos').then((d) => setFlujos(d.flujos));
  }

  useEffect(() => {
    Promise.all([api.get('/agentes/proveedores'), cargarFlujos()])
      .then(([p]) => setProveedores(p.proveedores))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nuevoFlujo() {
    setFlujoId(null);
    setNombre('');
    setDescripcion('');
    setNodos([nodoVacio()]);
    setResultado(null);
    setError('');
  }

  function cargarFlujo(f) {
    setFlujoId(f.id);
    setNombre(f.nombre);
    setDescripcion(f.descripcion || '');
    setNodos(f.nodos.length ? f.nodos.map((n) => ({ ...n, id: n.id || nodoVacio().id })) : [nodoVacio()]);
    setResultado(null);
    setError('');
  }

  async function borrarFlujo(id) {
    if (!window.confirm('¿Borrar este flujo guardado? No se puede deshacer.')) return;
    await api.delete(`/agentes/flujos/${id}`);
    if (flujoId === id) nuevoFlujo();
    await cargarFlujos();
  }

  function actualizarNodo(i, campo, valor) {
    const copia = [...nodos];
    copia[i] = { ...copia[i], [campo]: valor };
    setNodos(copia);
  }

  function agregarNodo() {
    setNodos([...nodos, nodoVacio()]);
  }

  function quitarNodo(i) {
    if (nodos.length === 1) return;
    setNodos(nodos.filter((_, idx) => idx !== i));
  }

  function moverNodo(i, direccion) {
    const destino = i + direccion;
    if (destino < 0 || destino >= nodos.length) return;
    const copia = [...nodos];
    [copia[i], copia[destino]] = [copia[destino], copia[i]];
    setNodos(copia);
  }

  async function guardar() {
    if (!nombre.trim()) { setError('Ponele un nombre al flujo antes de guardar.'); return; }
    setGuardando(true);
    setError('');
    try {
      const body = { nombre, descripcion, nodos };
      const { flujo } = flujoId ? await api.put(`/agentes/flujos/${flujoId}`, body) : await api.post('/agentes/flujos', body);
      setFlujoId(flujo.id);
      await cargarFlujos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutar() {
    setEjecutando(true);
    setError('');
    setResultado(null);
    try {
      const data = await api.post('/agentes/ejecutar', { nodos });
      setResultado(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setEjecutando(false);
    }
  }

  const labelProveedor = (clave) => proveedores.find((p) => p.clave === clave)?.label || clave;

  if (cargando) return <section className="section"><div className="container"><p className="spinner-msg">Cargando…</p></div></section>;

  return (
    <section className="section">
      <div className="container">
        <h1>Orquestación de agentes</h1>
        <p className="text-muted">
          Armá una cadena de agentes de IA: cada uno tiene un rol y un proveedor asignado, y la salida de uno se convierte en la
          entrada del siguiente. Por ahora la ejecución es simulada — no se conecta a ninguna IA real ni tiene costo — pero está
          pensada para poder engancharse a Claude, Gemini, ChatGPT o un modelo propio alojado en un host privado más adelante.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="grid grid-2" style={{ alignItems: 'start', gap: 24 }}>
          <div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ margin: 0 }}>{flujoId ? 'Editando flujo' : 'Flujo nuevo'}</h3>
                <button type="button" className="btn btn-outline btn-sm" onClick={nuevoFlujo}>+ Nuevo flujo</button>
              </div>

              <div className="field" style={{ marginTop: 16 }}>
                <label>Nombre del flujo</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Clasificar y responder tickets" />
              </div>
              <div className="field">
                <label>Descripción (opcional)</label>
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Para qué sirve este flujo" />
              </div>

              <h3 style={{ marginTop: 20 }}>Agentes (en orden de ejecución)</h3>
              {nodos.map((n, i) => (
                <div key={n.id} className="card" style={{ background: 'var(--color-bg-alt)', marginBottom: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: '0.85rem' }}>Agente {i + 1}</strong>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-outline btn-sm" disabled={i === 0} onClick={() => moverNodo(i, -1)} title="Mover antes" aria-label="Mover antes">↑</button>
                      <button type="button" className="btn btn-outline btn-sm" disabled={i === nodos.length - 1} onClick={() => moverNodo(i, 1)} title="Mover después" aria-label="Mover después">↓</button>
                      <button type="button" className="btn btn-outline btn-sm" disabled={nodos.length === 1} onClick={() => quitarNodo(i)} style={{ color: 'var(--color-danger)' }}>Quitar</button>
                    </div>
                  </div>
                  <div className="field">
                    <label>Nombre</label>
                    <input value={n.nombre} onChange={(e) => actualizarNodo(i, 'nombre', e.target.value)} placeholder="Ej: Clasificador" />
                  </div>
                  <div className="field">
                    <label>Rol</label>
                    <input value={n.rol} onChange={(e) => actualizarNodo(i, 'rol', e.target.value)} placeholder="Ej: Clasificar tickets por urgencia" />
                  </div>
                  <div className="field">
                    <label>Instrucciones</label>
                    <input value={n.instrucciones} onChange={(e) => actualizarNodo(i, 'instrucciones', e.target.value)} placeholder="Qué tiene que hacer con lo que recibe" />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Proveedor de IA</label>
                    <select value={n.proveedor} onChange={(e) => actualizarNodo(i, 'proveedor', e.target.value)}>
                      {proveedores.map((p) => <option key={p.clave} value={p.clave}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={agregarNodo}>+ Agregar agente</button>

              <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" disabled={guardando} onClick={guardar}>
                  {guardando ? 'Guardando…' : flujoId ? 'Guardar cambios' : 'Guardar flujo'}
                </button>
                <button type="button" className="btn btn-accent" disabled={ejecutando} onClick={ejecutar}>
                  {ejecutando ? 'Ejecutando (simulado)…' : '▶ Ejecutar flujo'}
                </button>
              </div>
            </div>

            {flujos.length > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <h3>Mis flujos guardados</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {flujos.map((f) => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem' }}>{f.nombre}</strong>
                        <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>{f.nodos.length} agente{f.nodos.length === 1 ? '' : 's'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => cargarFlujo(f)}>Abrir</button>
                        <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => borrarFlujo(f.id)}>Borrar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Vista del flujo</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                {nodos.map((n, i) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ border: '1.5px solid var(--color-border)', borderRadius: 10, padding: '10px 12px', minWidth: 120, background: '#fff' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{n.nombre || `Agente ${i + 1}`}</div>
                      <div className="badge" style={{ marginTop: 6, fontSize: '0.7rem' }}>{labelProveedor(n.proveedor)}</div>
                    </div>
                    {i < nodos.length - 1 && <span style={{ fontSize: '1.3rem', color: 'var(--color-text-muted)' }}>→</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <h3 style={{ marginTop: 0 }}>Resultado de la ejecución</h3>
              {!resultado && <p className="text-muted">Todavía no ejecutaste este flujo.</p>}
              {resultado && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {resultado.pasos.map((p, i) => (
                    <div key={p.nodoId || i} style={{ borderLeft: '3px solid var(--color-accent)', paddingLeft: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        <strong style={{ color: 'var(--color-text)' }}>{p.nombre || `Agente ${i + 1}`}</strong>
                        <span>{labelProveedor(p.proveedor)} · {p.meta?.latenciaMs}ms (simulado)</span>
                      </div>
                      <p style={{ whiteSpace: 'pre-line', margin: '4px 0 0' }}>{p.salida}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
