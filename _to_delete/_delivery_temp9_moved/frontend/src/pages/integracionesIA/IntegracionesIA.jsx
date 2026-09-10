import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import VinculacionesTab from './VinculacionesTab';
import ChatsTab from './ChatsTab';
import RegistrosTab from './RegistrosTab';

const TABS = [
  { id: 'chats', label: 'Chats' },
  { id: 'vinculaciones', label: 'Vinculaciones' },
  { id: 'registros', label: 'Registros' },
];

// "Integraciones IA": el alumno vincula su PROPIA cuenta de ChatGPT/
// Claude/Gemini (su propia API key — ver backend/src/utils/crypto.js, se
// guarda cifrada y nunca se vuelve a mostrar entera) y desde acá mismo
// chatea de verdad con esa IA, con historial guardado. Tres pestañas:
// - Vinculaciones: instructivo (editable por el admin desde
//   /admin-panel/ai-integraciones) + campo para cargar la API key.
// - Chats: el chat en vivo, con un panel a la izquierda para elegir IA y
//   navegar entre conversaciones.
// - Registros: todo el historial de conversaciones, de las IAs vinculadas
//   HOY nomás — si desvinculás una, sus chats no se pierden pero dejan de
//   listarse acá hasta que la vuelvas a vincular (ver ai.controller.js).
//
// El catálogo de proveedores (con su estado de vinculación) se carga acá
// arriba y se pasa a las 3 pestañas, para no repetir el fetch cada vez
// que el alumno cambia de pestaña.
export default function IntegracionesIA() {
  const [tab, setTab] = useState('chats');
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // Cuando desde "Registros" el alumno quiere reabrir una conversación
  // vieja, guardamos acá qué conversación abrir y saltamos a la pestaña
  // Chats — ChatsTab la consume y la limpia (ver su useEffect).
  const [conversacionAAbrir, setConversacionAAbrir] = useState(null);

  function cargarProveedores() {
    return api.get('/ai/proveedores').then(({ proveedores }) => setProveedores(proveedores)).catch((err) => setError(err.message));
  }

  useEffect(() => { cargarProveedores().finally(() => setCargando(false)); }, []);

  function abrirEnChats(proveedorClave, conversacionId) {
    setConversacionAAbrir({ proveedorClave, conversacionId });
    setTab('chats');
  }

  return (
    <section className="section">
      <div className="container">
        <h1>Integraciones IA</h1>
        <p className="text-muted">
          Vinculá tu propia cuenta de ChatGPT, Claude o Gemini con tu propia API key — la plataforma no la ve en
          texto plano ni la usa para nada más que reenviar tus mensajes a esa IA en tu nombre. Una vez vinculada,
          podés chatear con ella desde acá y llevar un registro de tus conversaciones.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          {cargando ? (
            <div className="spinner-msg">Cargando…</div>
          ) : (
            <>
              {tab === 'vinculaciones' && (
                <VinculacionesTab proveedores={proveedores} onActualizado={(p) => setProveedores((ps) => ps.map((x) => (x.clave === p.clave ? p : x)))} />
              )}
              {tab === 'chats' && (
                <ChatsTab proveedores={proveedores} aAbrir={conversacionAAbrir} onConsumirAAbrir={() => setConversacionAAbrir(null)} />
              )}
              {tab === 'registros' && <RegistrosTab proveedores={proveedores} onAbrirChat={abrirEnChats} />}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
