import { useEffect, useState } from 'react';
import { api, guardarBlob } from '../../api/client';
import { formatFecha } from '../../utils/fecha';
import MiniGrafico from '../../components/MiniGrafico';

function Dato({ titulo, valor, alerta }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="text-muted" style={{ fontSize: '0.8rem' }}>{titulo}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: alerta ? 'var(--color-danger)' : undefined }}>{valor ?? '—'}</div>
    </div>
  );
}

// Admin → Estado de la app (portado de DBA24): memoria, CPU, demora del
// event loop, requests y latencia de la última hora, rutas más lentas,
// disco, serie de los últimos 30 días, test de velocidad y PDF.
export default function AdminEstadoApp() {
  const [data, setData] = useState(null);
  const [test, setTest] = useState(null);
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState('');

  const cargar = () => api.get('/admin/estado-app').then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, []);

  async function testVelocidad() {
    setProbando(true);
    setError('');
    try {
      setTest(await api.post('/admin/estado-app/test-velocidad', {}));
    } catch (e) {
      setError(e.message);
    } finally {
      setProbando(false);
    }
  }

  async function pdf() {
    try {
      guardarBlob(await api.getBlob('/admin/estado-app/pdf'), `estado-app-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  }

  if (!data) return <div>{error ? <div className="alert alert-error">{error}</div> : 'Cargando…'}</div>;
  const a = data.actual;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Estado de la app</h1>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Se actualiza sola cada 30 segundos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={testVelocidad} disabled={probando}>{probando ? 'Midiendo…' : 'Test de velocidad'}</button>
          <button className="btn btn-primary btn-sm" onClick={pdf}>Descargar PDF</button>
        </div>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 16 }}>
        <Dato titulo="Memoria del proceso" valor={`${a.proceso.rssMb} MB`} alerta={a.proceso.rssMb > 700} />
        <Dato titulo="CPU del proceso" valor={`${a.proceso.cpuPorcentaje} %`} alerta={a.proceso.cpuPorcentaje > 80} />
        <Dato titulo="Event loop p99" valor={`${a.eventLoop.p99Ms} ms`} alerta={a.eventLoop.p99Ms > 200} />
        <Dato titulo="Latencia base" valor={a.baseLatenciaMs == null ? 'Sin conexión' : `${a.baseLatenciaMs} ms`} alerta={a.baseLatenciaMs == null || a.baseLatenciaMs > 100} />
        <Dato titulo="Requests (última hora)" valor={a.ultimaHora.requests} />
        <Dato titulo="Latencia promedio" valor={`${a.ultimaHora.latenciaPromMs} ms`} alerta={a.ultimaHora.latenciaPromMs > 500} />
        <Dato titulo="Errores 5xx (última hora)" valor={a.ultimaHora.errores5xx} alerta={a.ultimaHora.errores5xx > 0} />
        <Dato titulo="En línea ahora" valor={a.app.usuariosOnline} />
        <Dato titulo="Errores distintos (24 h)" valor={a.app.errores24h} alerta={a.app.errores24h > 0} />
        <Dato titulo="Procesos en cola" valor={a.app.procesosPendientes} />
      </div>

      {test && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Test de velocidad — {test.totalMs} ms en total</h3>
          <table>
            <tbody>
              {test.pasos.map((p) => (
                <tr key={p.nombre}><td>{p.nombre}</td><td style={{ textAlign: 'right', color: p.ok ? undefined : 'var(--color-danger)' }}>{p.ok ? `${p.ms} ms` : `Error: ${p.error}`}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <MiniGrafico titulo="Requests por minuto (última hora)" datos={a.ultimaHora.porMinuto.map((m) => ({ etiqueta: new Date(m.minuto).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }), valor: m.requests }))} />
      </div>

      {data.serie.length > 0 && (
        <div className="card" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <MiniGrafico titulo="Memoria (MB) — últimos 30 días" datos={data.serie.map((s) => ({ etiqueta: formatFecha(s.ts, { hour: undefined, minute: undefined }), valor: s.rss_mb }))} />
          <MiniGrafico titulo="Requests por hora" color="var(--color-accent)" datos={data.serie.map((s) => ({ etiqueta: formatFecha(s.ts), valor: s.requests }))} />
          <MiniGrafico titulo="Latencia promedio (ms)" datos={data.serie.map((s) => ({ etiqueta: formatFecha(s.ts), valor: s.latencia_prom_ms }))} />
          <MiniGrafico titulo="Usuarios en línea" color="var(--color-accent)" datos={data.serie.map((s) => ({ etiqueta: formatFecha(s.ts), valor: s.usuarios_online }))} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
        <div className="card" style={{ margin: 0, overflowX: 'auto' }}>
          <h3 style={{ marginTop: 0 }}>Rutas más lentas</h3>
          <table>
            <thead><tr><th>Ruta</th><th>Req.</th><th>Prom.</th><th>Máx.</th></tr></thead>
            <tbody>
              {a.rutasMasLentas.map((r) => <tr key={r.ruta}><td style={{ fontSize: '0.82rem' }}><code>{r.ruta}</code></td><td>{r.requests}</td><td>{r.promMs} ms</td><td>{r.maxMs} ms</td></tr>)}
              {a.rutasMasLentas.length === 0 && <tr><td colSpan={4} className="text-muted">Todavía no hay datos.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginTop: 0 }}>Servidor</h3>
          <table>
            <tbody>
              <tr><th>Node</th><td>{a.servidor.node}</td></tr>
              <tr><th>Plataforma</th><td>{a.servidor.plataforma}</td></tr>
              <tr><th>Núcleos</th><td>{a.servidor.nucleos}</td></tr>
              <tr><th>Memoria total / libre</th><td>{a.servidor.memoriaTotalMb} / {a.servidor.memoriaLibreMb} MB</td></tr>
              <tr><th>Proceso activo hace</th><td>{a.servidor.uptimeProcesoMin} min</td></tr>
              <tr><th>Base de datos</th><td>{a.servidor.baseDeDatos}</td></tr>
              {Object.entries(a.disco).map(([k, v]) => <tr key={k}><th>Disco: {k}/</th><td>{v.mb} MB ({v.archivos} archivos)</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
