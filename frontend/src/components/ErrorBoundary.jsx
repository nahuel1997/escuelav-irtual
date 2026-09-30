import { Component } from 'react';
import { reportarErrorNavegador } from '../utils/erroresNavegador';

function leerTextosGuardados() {
  try {
    return JSON.parse(localStorage.getItem('paginas_error') || '{}') || {};
  } catch {
    return {};
  }
}

// Red de contención para errores de React que rompen el render (bugs de
// verdad, no errores de API — esos ya se muestran con <div className=
// "alert alert-error"> en cada página). Sin esto, un error así deja al
// usuario con una pantalla en blanco y sin ninguna explicación.
//
// Tiene que ser una clase: los error boundaries de React no existen como
// hook todavía. Envuelve TODO el árbol (ver main.jsx), afuera de
// BrowserRouter, para no depender de que el router siga sano si lo que
// rompió fue justamente algo dentro de una página con rutas.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    // Al usuario le mostramos algo genérico y tranquilizador; el detalle
    // real queda en la consola para quien esté debugueando.
    console.error('[ErrorBoundary]', error, info?.componentStack);
    // Y queda registrado en Admin → Errores (React no lo propaga a window.onerror).
    reportarErrorNavegador({
      mensaje: `Pantalla rota: ${error?.message || String(error)}`,
      stack: `${error?.stack || ''}\n\nComponentes:${info?.componentStack || ''}`,
    });
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    // Textos editables en Admin → Configuración → Páginas de error. Se leen
    // de la última copia del estado público que ya haya bajado la app (acá
    // no se puede usar un hook ni confiar en que el resto siga sano).
    const textos = leerTextosGuardados();

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-alt, #f5f7fa)',
          padding: 24,
        }}
      >
        <div className="card text-center" style={{ maxWidth: 480 }}>
          <span className="badge badge-danger">Ups</span>
          <h1 style={{ marginTop: 12 }}>{textos.titulo500 || 'Algo salió mal'}</h1>
          <p className="text-muted">
            {textos.texto500 || 'Tuvimos un problema inesperado mostrando esta página. No es algo que hayas hecho vos — podés intentar de nuevo o volver al inicio.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Recargar página
            </button>
            <a className="btn btn-outline" href="/">Volver al inicio</a>
          </div>
        </div>
      </div>
    );
  }
}
