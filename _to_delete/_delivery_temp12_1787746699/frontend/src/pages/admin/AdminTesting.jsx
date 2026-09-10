import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// Entorno de testing para el admin: corre la suite real de Jest/Supertest
// (backend/tests/) con un click y muestra el resultado acá mismo, en vez
// de tener que abrir una terminal y correr "npm test" a mano.
//
// Cada suite usa su propia base SQLite descartable (ver comentario en
// testing.controller.js) — correr esto NUNCA toca los datos reales de la
// app ni reinicia el servidor.
export default function AdminTesting() {
  const [suites, setSuites] = useState([]);
  const [resultados, setResultados] = useState({}); // id -> { estado, ...resultado }
  const [corriendoTodo, setCorriendoTodo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/testing/suites')
      .then(({ suites }) => setSuites(suites))
      .catch((err) => setError(err.message));
  }, []);

  async function correr(id) {
    setResultados((r) => ({ ...r, [id]: { estado: 'corriendo' } }));
    try {
      const data = await api.post(`/admin/testing/run/${id}`);
      setResultados((r) => ({ ...r, [id]: { estado: data.ok ? 'ok' : 'fail', ...data } }));
    } catch (err) {
      setResultados((r) => ({ ...r, [id]: { estado: 'fail', errorEjecucion: err.message } }));
    }
  }

  async function correrTodo() {
    setCorriendoTodo(true);
    for (const s of suites) {
      // Secuencial a propósito: jest --runInBand ya corre los tests de
      // cada archivo en serie, y encadenar los archivos en paralelo no
      // ahorra mucho tiempo real pero satura la vista con todo "corriendo"
      // a la vez sin poder seguir el progreso.
      // eslint-disable-next-line no-await-in-loop
      await correr(s.id);
    }
    setCorriendoTodo(false);
  }

  const total = suites.length;
  const corridos = Object.values(resultados).filter((r) => r.estado === 'ok' || r.estado === 'fail').length;
  const conFallas = Object.values(resultados).filter((r) => r.estado === 'fail').length;

  return (
    <div>
      <h1>Testing</h1>
      <p className="text-muted">
        Corre la suite real de tests del backend (Jest + Supertest, en <code>backend/tests/</code>)
        contra una base SQLite descartable propia — no toca los datos reales de la app. Sirve para
        confirmar que un cambio no rompió nada, sin tener que abrir una terminal.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <button className="btn btn-primary" onClick={correrTodo} disabled={corriendoTodo || suites.length === 0}>
          {corriendoTodo ? 'Corriendo todo…' : 'Correr todos los tests'}
        </button>
        {corridos > 0 && (
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>
            {corridos}/{total} suites corridas{conFallas > 0 ? ` — ${conFallas} con fallas` : corridos === total ? ' — todo OK' : ''}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suites.map((s) => (
          <SuiteRow key={s.id} suite={s} resultado={resultados[s.id]} onCorrer={() => correr(s.id)} />
        ))}
        {suites.length === 0 && !error && <div className="spinner-msg">Cargando…</div>}
      </div>
    </div>
  );
}

function SuiteRow({ suite, resultado, onCorrer }) {
  const [expandido, setExpandido] = useState(false);
  const estado = resultado?.estado || 'idle';

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <EstadoBadge estado={estado} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <strong>{suite.label}</strong>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>{suite.archivo}</div>
        </div>
        {estado === 'ok' || estado === 'fail' ? (
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            {resultado.numTotalTests !== undefined
              ? `${resultado.numPassedTests}/${resultado.numTotalTests} tests pasaron`
              : 'No se pudo correr'}
          </span>
        ) : null}
        <button className="btn btn-outline btn-sm" onClick={onCorrer} disabled={estado === 'corriendo'}>
          {estado === 'corriendo' ? 'Corriendo…' : 'Correr'}
        </button>
        {estado === 'fail' && (
          <button className="btn btn-outline btn-sm" onClick={() => setExpandido((e) => !e)}>
            {expandido ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        )}
      </div>

      {estado === 'fail' && expandido && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          {resultado.errorEjecucion ? (
            <div>
              <p style={{ color: 'var(--color-danger, #c0392b)', fontWeight: 600, margin: '0 0 4px' }}>{resultado.errorEjecucion}</p>
              {resultado.detalle && (
                <pre style={{ fontSize: '0.75rem', background: 'var(--color-bg-alt)', padding: 8, borderRadius: 6, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {resultado.detalle}
                </pre>
              )}
            </div>
          ) : (
            (resultado.tests || []).filter((t) => t.estado === 'failed').map((t, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <p style={{ fontWeight: 600, margin: '0 0 4px' }}>{t.titulo}</p>
                <pre style={{ fontSize: '0.75rem', background: 'var(--color-bg-alt)', padding: 8, borderRadius: 6, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {t.error}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado }) {
  const cfg = {
    idle: { texto: 'Sin correr', color: '#8b97a5', bg: 'rgba(139,151,165,0.15)' },
    corriendo: { texto: 'Corriendo…', color: '#e0972d', bg: 'rgba(224,151,45,0.15)' },
    ok: { texto: 'OK', color: '#1a8a4a', bg: 'rgba(26,138,74,0.15)' },
    fail: { texto: 'Falló', color: '#c0392b', bg: 'rgba(192,57,43,0.15)' },
  }[estado];

  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {cfg.texto}
    </span>
  );
}
