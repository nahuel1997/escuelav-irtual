import { Component } from 'react';

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
  }

  render() {
    if (!this.state.crashed) return this.props.children;

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
          <h1 style={{ marginTop: 12 }}>Algo salió mal</h1>
          <p className="text-muted">
            Tuvimos un problema inesperado mostrando esta página. No es algo que hayas hecho vos —
            podés intentar de nuevo o volver al inicio.
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
