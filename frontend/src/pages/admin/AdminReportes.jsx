import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';
import MiniGrafico from '../../components/MiniGrafico';
import BotonPdfProceso from '../../components/BotonPdfProceso';

const TIPOS = { ventas: 'Ventas', inscripciones: 'Inscripciones', progreso: 'Progreso de alumnos', profesores: 'Profesores', encuestas: 'Encuestas' };

function hoyMenos(dias) {
  return new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
}

function Ventas({ d }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div className="card" style={{ margin: 0 }}><div className="text-muted">Órdenes aprobadas</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{d.totalOrdenes}</div></div>
        {Object.entries(d.porMoneda).map(([m, t]) => <div key={m} className="card" style={{ margin: 0 }}><div className="text-muted">Total {m}</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{t.toLocaleString('es-AR')}</div></div>)}
        <div className="card" style={{ margin: 0 }}><div className="text-muted">Inscripciones sin pasarela</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{d.inscripcionesSinPasarela}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><MiniGrafico titulo="Órdenes por día" datos={d.porDia.map((x) => ({ etiqueta: x.dia.slice(5), valor: x.cantidad }))} /></div>
      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Cursos más vendidos</h3>
        <table><tbody>{d.cursosMasVendidos.map((c) => <tr key={c.titulo}><td>{c.titulo}</td><td style={{ textAlign: 'right' }}>{c.cantidad}</td></tr>)}</tbody></table>
        <h3>Órdenes</h3>
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Alumno</th><th>Medio</th><th>Total</th></tr></thead>
          <tbody>{d.ordenes.map((o) => <tr key={o.id}><td>{o.id}</td><td>{formatFecha(o.created_at)}</td><td>{o.nombre} {o.apellido}</td><td>{o.provider}</td><td>{o.moneda} {Number(o.total).toLocaleString('es-AR')}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function Tabla({ columnas, filas }) {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr>{columnas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j}>{v ?? '—'}</td>)}</tr>)}
          {filas.length === 0 && <tr><td colSpan={columnas.length} className="text-muted">Sin datos.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// Admin → Reportes: ver en pantalla, descargar en PDF o mandar por mail
// (el PDF se arma en segundo plano, con número de seguimiento).
export default function AdminReportes() {
  const [tipo, setTipo] = useState('ventas');
  const [filtro, setFiltro] = useState({ desde: hoyMenos(29), hasta: hoyMenos(0), courseId: '' });
  const [cursos, setCursos] = useState([]);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/admin/courses').then((d) => setCursos(d.courses)).catch(() => {}); }, []);

  function cargar(t = tipo, f = filtro) {
    setDatos(null);
    setError('');
    const params = new URLSearchParams();
    if (f.desde) params.set('desde', f.desde);
    if (f.hasta) params.set('hasta', f.hasta);
    if (f.courseId) params.set('courseId', f.courseId);
    api.get(`/admin/reportes/${t}?${params.toString()}`).then(setDatos).catch((e) => setError(e.message));
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const parametros = { reporte: tipo, desde: filtro.desde, hasta: filtro.hasta, ...(filtro.courseId ? { courseId: Number(filtro.courseId) } : {}) };

  return (
    <div>
      <h1 style={{ margin: 0 }}>Reportes</h1>
      <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
        {Object.entries(TIPOS).map(([k, v]) => <button key={k} className={`btn btn-sm ${tipo === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setTipo(k); cargar(k); }}>{v}</button>)}
      </div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); cargar(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16 }}>
        {['ventas', 'inscripciones', 'profesores'].includes(tipo) && (
          <>
            <div className="field" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} /></div>
          </>
        )}
        {['progreso', 'encuestas'].includes(tipo) && (
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Curso</label>
            <select value={filtro.courseId} onChange={(e) => setFiltro({ ...filtro, courseId: e.target.value })}>
              <option value="">Todos</option>
              {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </div>
        )}
        <button className="btn btn-outline btn-sm">Ver</button>
        <div style={{ marginLeft: 'auto' }}><BotonPdfProceso tipo="reporte_admin" parametros={parametros} /></div>
      </form>
      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
        {!datos ? (!error && <p className="text-muted">Cargando…</p>) : tipo === 'ventas' ? <Ventas d={datos} /> : tipo === 'inscripciones' ? (
          <Tabla columnas={['Curso', 'Profesor', 'Estado', 'Nuevas', 'Total', 'Terminaron', 'Ingreso est.']} filas={datos.cursos.map((c) => [c.titulo, c.profesor, c.estado, c.nuevasEnRango, c.alumnosTotales, c.completados, c.ingresoEstimadoRango.toLocaleString('es-AR')])} />
        ) : tipo === 'progreso' ? (
          datos.cursos.map((c) => (
            <div key={c.id} style={{ marginBottom: 16 }}>
              <h3>{c.titulo} <span className="text-muted" style={{ fontSize: '0.9rem' }}>· {c.alumnos.length} alumnos · promedio {c.promedio}%</span></h3>
              <Tabla columnas={['Alumno', 'Email', 'Capítulos', 'Avance', 'Terminó']} filas={c.alumnos.map((a) => [a.alumno, a.email, `${a.capitulosCompletados}/${a.capitulosTotales}`, `${a.porcentaje}%`, a.completado ? 'Sí' : 'No'])} />
            </div>
          ))
        ) : tipo === 'profesores' ? (
          <Tabla columnas={['Profesor', 'Cursos', 'Alumnos', 'Clases dadas', 'Turnos', 'Calif. interna', 'Encuesta alumnos']} filas={datos.profesores.map((p) => [p.profesor, p.cursos, p.alumnos, p.clasesDadas, p.turnosAtendidos, p.calificacionInterna, p.encuestaAlumnos])} />
        ) : (
          <div>
            <p>{datos.respondieron} encuesta(s) respondida(s).</p>
            {datos.preguntas.map((p) => (
              <div key={p.id} className="card">
                <strong>{p.texto}</strong> {!p.activa && <span className="badge">inactiva</span>}
                {p.tipo === 'escala' && <p>Promedio: <strong>{p.promedio ?? '—'}</strong> / 5 · distribución 1→5: {p.distribucion.join(' · ')}</p>}
                {p.tipo === 'si_no' && <p>Sí: {p.si} · No: {p.no}</p>}
                {p.tipo === 'texto' && <ul>{p.comentarios.map((c, i) => <li key={i}>{c.texto} <span className="text-muted">({c.curso})</span></li>)}</ul>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
