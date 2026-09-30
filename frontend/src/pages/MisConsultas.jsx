import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatFecha } from '../utils/fecha';
import TicketHilo from '../components/TicketHilo';
import { ESTADOS_TICKET } from '../config/estadosTicket';

const CATEGORIAS = ['Cursos', 'Pagos', 'Cuenta', 'Clases en vivo', 'Otro'];

function FormNueva({ onCreada }) {
  const [asunto, setAsunto] = useState('');
  const [categoria, setCategoria] = useState('Cursos');
  const [mensaje, setMensaje] = useState('');
  const [adjuntos, setAdjuntos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const form = new FormData();
      form.append('asunto', asunto.trim());
      form.append('categoria', categoria);
      form.append('mensaje', mensaje.trim());
      adjuntos.forEach((a) => form.append('adjuntos', a));
      const { ticket } = await api.postForm('/tickets', form);
      onCreada(ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="card" onSubmit={enviar}>
      <h3 style={{ marginTop: 0 }}>Nueva consulta</h3>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 2, minWidth: 220 }}>
          <label>Asunto</label>
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={200} required />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>Tema</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Contanos qué necesitás</label>
        <textarea rows={5} value={mensaje} onChange={(e) => setMensaje(e.target.value)} required />
      </div>
      <div className="field">
        <label>Adjuntos (opcional, hasta 5 de 10 MB)</label>
        <input type="file" multiple onChange={(e) => setAdjuntos(Array.from(e.target.files || []).slice(0, 5))} />
      </div>
      <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar consulta'}</button>
    </form>
  );
}

// "Mis consultas": tickets de soporte del alumno/profesor, para lo que
// necesita seguimiento (el chat de ayuda sigue para lo inmediato).
export function MisConsultas() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nueva, setNueva] = useState(false);
  const [ok, setOk] = useState('');

  const cargar = () => api.get('/tickets').then((d) => setTickets(d.tickets)).finally(() => setLoading(false));
  useEffect(() => { cargar(); }, []);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>Mis consultas</h1>
            <p className="text-muted" style={{ margin: '4px 0 0' }}>Consultas al equipo de la escuela con seguimiento.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setNueva((v) => !v)}>{nueva ? 'Cancelar' : 'Nueva consulta'}</button>
        </div>

        {ok && <div className="alert alert-success" style={{ marginTop: 16 }}>{ok}</div>}
        {nueva && (
          <div style={{ marginTop: 16 }}>
            <FormNueva onCreada={(t) => { setNueva(false); setOk(`Recibimos tu consulta ${t.numero}. Te avisamos por mail cuando haya novedades.`); cargar(); }} />
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? <p className="text-muted">Cargando…</p> : tickets.length === 0 ? (
            <p className="text-muted">No tenés consultas todavía.</p>
          ) : tickets.map((t) => {
            const est = ESTADOS_TICKET[t.estado] || { label: t.estado };
            return (
              <Link key={t.id} to={`/mis-consultas/${t.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{t.numero} · {t.asunto}</strong>
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>{t.categoria || 'Sin tema'} · actualizada {formatFecha(t.updated_at)}</div>
                  </div>
                  <span className={`badge ${est.clase || ''}`}>{est.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ConsultaDetalle() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [adjuntos, setAdjuntos] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = () => api.get(`/tickets/${id}`).then((d) => setTicket(d.ticket)).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function responder(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const form = new FormData();
      form.append('mensaje', mensaje.trim());
      adjuntos.forEach((a) => form.append('adjuntos', a));
      const { ticket: t } = await api.postForm(`/tickets/${id}/mensajes`, form);
      setTicket(t);
      setMensaje('');
      setAdjuntos([]);
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cerrar() {
    if (!window.confirm('¿Cerrar la consulta? Si después necesitás algo, podés abrir una nueva.')) return;
    await api.post(`/tickets/${id}/cerrar`, {});
    cargar();
  }

  if (error && !ticket) return <section className="section"><div className="container"><div className="alert alert-error">{error}</div></div></section>;
  if (!ticket) return <section className="section"><div className="container"><p className="text-muted">Cargando…</p></div></section>;
  const est = ESTADOS_TICKET[ticket.estado] || { label: ticket.estado };

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 900 }}>
        <Link to="/mis-consultas" className="text-muted">← Mis consultas</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 16px' }}>
          <h1 style={{ margin: 0 }}>{ticket.numero} · {ticket.asunto}</h1>
          <span className={`badge ${est.clase || ''}`}>{est.label}</span>
        </div>

        <TicketHilo ticket={ticket} />

        {ticket.estado !== 'cerrado' ? (
          <form className="card" onSubmit={responder} style={{ marginTop: 16 }}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="field">
              <label>Responder</label>
              <textarea rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} required />
            </div>
            <div className="field">
              <input type="file" multiple onChange={(e) => setAdjuntos(Array.from(e.target.files || []).slice(0, 5))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
              <button type="button" className="btn btn-outline" onClick={cerrar}>Cerrar consulta</button>
            </div>
          </form>
        ) : (
          <p className="text-muted" style={{ marginTop: 16 }}>Esta consulta está cerrada.</p>
        )}
      </div>
    </section>
  );
}
