import { useEffect, useState } from 'react';
import { api, guardarBlob } from '../../api/client';
import { formatFecha } from '../../utils/fecha';
import MiniGrafico from '../../components/MiniGrafico';

function hoyMenos(dias) {
  const d = new Date(Date.now() - dias * 86400000);
  return d.toISOString().slice(0, 10);
}

// Admin → Tráfico (portado de DBA24): quién está en línea, páginas vistas
// por día y por hora, páginas más vistas, por rol y dispositivo, y PDF.
export default function AdminTrafico() {
  const [filtro, setFiltro] = useState({ desde: hoyMenos(29), hasta: hoyMenos(0) });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const cargar = (f = filtro) => api.get(`/admin/trafico?desde=${f.desde}&hasta=${f.hasta}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    const t = setInterval(() => cargar(), 60000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function pdf() {
    try {
      guardarBlob(await api.getBlob(`/admin/trafico/pdf?desde=${filtro.desde}&hasta=${filtro.hasta}`), `trafico-${filtro.desde}-${filtro.hasta}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Tráfico</h1>
        <button className="btn btn-primary btn-sm" onClick={pdf}>Descargar PDF</button>
      </div>

      <form className="card" onSubmit={(e) => { e.preventDefault(); cargar(filtro); }} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} /></div>
        <button className="btn btn-primary btn-sm">Ver</button>
      </form>
      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 16 }}>
            <div className="card" style={{ margin: 0 }}><div className="text-muted" style={{ fontSize: '0.8rem' }}>En línea ahora</div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{data.online.length}</div></div>
            <div className="card" style={{ margin: 0 }}><div className="text-muted" style={{ fontSize: '0.8rem' }}>Páginas vistas</div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{data.resumen.totalVistas}</div></div>
            <div className="card" style={{ margin: 0 }}><div className="text-muted" style={{ fontSize: '0.8rem' }}>Personas distintas</div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{data.resumen.personasUnicas}</div></div>
            {Object.entries(data.resumen.porDispositivo).map(([k, v]) => (
              <div key={k} className="card" style={{ margin: 0 }}><div className="text-muted" style={{ fontSize: '0.8rem' }}>Desde {k}</div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{v}</div></div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <MiniGrafico titulo="Vistas por día" datos={data.resumen.porDia.map((d) => ({ etiqueta: d.dia.slice(5), valor: d.vistas }))} />
            <MiniGrafico titulo="Vistas por hora del día" color="var(--color-accent)" datos={data.resumen.porHora.map((h) => ({ etiqueta: `${h.hora}h`, valor: h.vistas }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 16 }}>
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>En línea ahora</h3>
              <table><tbody>
                {data.online.map((u) => <tr key={u.id}><td>{u.nombre}</td><td><span className="badge">{u.rol}</span></td><td className="text-muted" style={{ fontSize: '0.8rem' }}>{formatFecha(u.ultima)}</td></tr>)}
                {data.online.length === 0 && <tr><td className="text-muted">Nadie en los últimos 5 minutos.</td></tr>}
              </tbody></table>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>Páginas más vistas</h3>
              <table><tbody>
                {data.resumen.paginas.map((p) => <tr key={p.pagina}><td><code>{p.pagina}</code></td><td style={{ textAlign: 'right' }}>{p.vistas}</td></tr>)}
                {data.resumen.paginas.length === 0 && <tr><td className="text-muted">Sin datos en el rango.</td></tr>}
              </tbody></table>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>Por tipo de usuario</h3>
              <table><tbody>{Object.entries(data.resumen.porRol).map(([k, v]) => <tr key={k}><td>{k}</td><td style={{ textAlign: 'right' }}>{v}</td></tr>)}</tbody></table>
              <h3>Últimas vistas</h3>
              <table><tbody>
                {data.ultimos.slice(0, 15).map((u) => <tr key={u.id}><td className="text-muted" style={{ fontSize: '0.8rem' }}>{formatFecha(u.ts)}</td><td><code>{u.pagina}</code></td><td>{u.nombre || u.rol || 'visitante'}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
