import { useEffect, useState } from 'react';
import { api } from '../api/client';

function Formulario({ curso, preguntas, onListo }) {
  const [resp, setResp] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post(`/encuestas/${curso.id}`, { respuestas: preguntas.map((p) => ({ preguntaId: p.id, ...(resp[p.id] || {}) })) });
      onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ marginTop: 12 }}>
      {preguntas.map((p) => (
        <div key={p.id} className="field">
          <label>{p.texto}</label>
          {p.tipo === 'escala' && (
            <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label={p.texto}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} className={`btn btn-sm ${resp[p.id]?.valor === n ? 'btn-primary' : 'btn-outline'}`} onClick={() => setResp({ ...resp, [p.id]: { valor: n } })} aria-pressed={resp[p.id]?.valor === n}>{'★'.repeat(n)}</button>
              ))}
            </div>
          )}
          {p.tipo === 'si_no' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {[[true, 'Sí'], [false, 'No']].map(([v, l]) => (
                <button type="button" key={l} className={`btn btn-sm ${resp[p.id]?.valor === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setResp({ ...resp, [p.id]: { valor: v } })}>{l}</button>
              ))}
            </div>
          )}
          {p.tipo === 'texto' && <textarea rows={3} value={resp[p.id]?.texto || ''} onChange={(e) => setResp({ ...resp, [p.id]: { texto: e.target.value } })} maxLength={2000} />}
        </div>
      ))}
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar encuesta'}</button>
    </form>
  );
}

// "Encuestas": el alumno califica cada curso en el que está inscripto
// (una vez por curso). Las preguntas las arma la escuela.
export default function Encuestas() {
  const [data, setData] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [ok, setOk] = useState('');
  const cargar = () => api.get('/encuestas').then(setData).catch(() => setData({ cursos: [], preguntas: [] }));
  useEffect(() => { cargar(); }, []);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 820 }}>
        <h1>Encuestas</h1>
        <p className="text-muted">Contanos qué te pareció cada curso: nos ayuda a mejorar.</p>
        {ok && <div className="alert alert-success">{ok}</div>}
        {!data ? <p className="text-muted">Cargando…</p> : data.cursos.length === 0 ? <p className="text-muted">Todavía no estás inscripto/a en ningún curso.</p> : data.cursos.map((c) => (
          <div key={c.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <strong>{c.titulo}</strong>
              {c.respondida ? <span className="badge badge-success">¡Gracias!</span> : (
                <button className="btn btn-outline btn-sm" onClick={() => setAbierto(abierto === c.id ? null : c.id)}>{abierto === c.id ? 'Cerrar' : 'Responder'}</button>
              )}
            </div>
            {abierto === c.id && !c.respondida && (
              <Formulario curso={c} preguntas={data.preguntas} onListo={() => { setAbierto(null); setOk('¡Gracias por tu opinión!'); cargar(); }} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
