import { useState } from 'react';
import { useProceso } from '../hooks/useProceso';
import ProcesoCapa from './ProcesoCapa';

// Botón "Descargar PDF" + "Enviar por mail" para un proceso en segundo
// plano que genera un PDF (reportes, mi progreso). El envío por mail tiene
// tope de 15 por hora por usuario (lo controla el backend).
export default function BotonPdfProceso({ tipo, parametros = {}, etiqueta = 'Descargar PDF', children }) {
  const { proceso, enCurso, error, iniciar } = useProceso();
  const [mail, setMail] = useState({ abierto: false, destinatario: '', mensaje: '' });
  const [ok, setOk] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setOk('');
    const p = await iniciar(tipo, { ...parametros, destinatario: mail.destinatario, mensaje: mail.mensaje }, { descargar: false });
    if (p) {
      setOk(`Enviando a ${mail.destinatario} (${p.numero}).`);
      setMail({ abierto: false, destinatario: '', mensaje: '' });
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <ProcesoCapa proceso={proceso} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
        <button type="button" className="btn btn-primary btn-sm" disabled={enCurso} onClick={() => iniciar(tipo, parametros)}>{etiqueta}</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={enCurso} onClick={() => setMail((m) => ({ ...m, abierto: !m.abierto }))}>Enviar por mail</button>
      </div>
      {mail.abierto && (
        <form onSubmit={enviar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Mail de destino</label>
            <input type="email" value={mail.destinatario} onChange={(e) => setMail({ ...mail, destinatario: e.target.value })} required />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label>Mensaje (opcional)</label>
            <input value={mail.mensaje} onChange={(e) => setMail({ ...mail, mensaje: e.target.value })} maxLength={2000} />
          </div>
          <button className="btn btn-primary btn-sm" disabled={enCurso}>Enviar</button>
        </form>
      )}
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
      {ok && !error && proceso?.estado === 'terminado' && <div className="alert alert-success" style={{ marginTop: 8 }}>{ok.replace('Enviando', 'Enviado')}</div>}
    </div>
  );
}
