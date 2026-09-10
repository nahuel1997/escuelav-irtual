// =============================================================================
// liveClassSocket.js — Chat en vivo de una clase transmitida (Socket.io).
//
// A diferencia de chatSocket.js, este módulo NO crea su propio servidor de
// Socket.io: reutiliza la MISMA instancia `io` que ya arma chatSocket.js al
// engancharse al servidor HTTP (ver el bloque require.main === module en
// app.js). Un http.Server solo admite un servidor de Socket.io enganchado
// — crear un segundo con `new Server(httpServer, ...)` pisaría (o rompería)
// el primero. Como ya es el mismo `io`, la autenticación por JWT
// (io.use(...) en chatSocket.js) corre una sola vez por conexión y
// `socket.user` ya viene resuelto acá también — no hay que autenticar de
// nuevo.
//
// Qué SÍ vive acá (en vivo, por socket):
//   - Unirse a la sala de una clase puntual (con chequeo de acceso).
//   - Mandar/recibir mensajes del chat de esa clase.
//   - Avisar a quien esté mirando cuando la clase cambia de estado
//     (programada → en_vivo → finalizada, o cancelada) — lo dispara
//     liveClasses.controller.js al procesar iniciar/finalizar/cancelar.
// Qué NO vive acá (REST normal, ver liveClasses.routes.js):
//   - Agendar/editar/cancelar la clase (solo admin, con mail de aviso).
//   - Cargar el historial de mensajes al abrir la sala.
//   - Iniciar/finalizar la transmisión en sí (cambia el estado en la base).
// =============================================================================
const liveClassModel = require('../models/liveClass.model');
const liveClassMessageModel = require('../models/liveClassMessage.model');

function roomDeClase(liveClassId) {
  return `clase-en-vivo:${liveClassId}`;
}

// Mismo criterio de acceso que usa el REST (ver liveClasses.controller.js):
// el profesor tiene que estar asignado a la clase; el alumno, inscripto en
// el curso de esa clase. Quién puede VER la sala en sí (según el estado)
// ya lo resolvió el REST antes de que el frontend intente conectarse al
// chat — acá solo re-chequeamos la titularidad, por si alguien intenta
// unirse a mano a una clase ajena.
async function tieneAcceso(liveClassId, user) {
  if (user.rol === 'profesor') {
    return liveClassModel.esProfesorAsignado(liveClassId, user.id);
  }
  return liveClassModel.alumnoTieneAcceso(liveClassId, user.id);
}

let ioRef = null;

function attachLiveClassSocket(io) {
  ioRef = io;

  io.on('connection', (socket) => {
    // chatSocket.js ya dejó socket.user colgado (o cortó la conexión antes
    // de llegar acá si el token no era válido) — ver io.use() en ese archivo.
    if (!socket.user) return;
    const { id: userId, rol, nombre } = socket.user;

    socket.on('claseEnVivo:unirse', async (liveClassId, callback) => {
      const responder = typeof callback === 'function' ? callback : () => {};
      try {
        const clase = await liveClassModel.findById(liveClassId);
        if (!clase) throw new Error('La clase no existe');
        const autorizado = await tieneAcceso(clase.id, socket.user);
        if (!autorizado) throw new Error('No tenés acceso a esta clase');

        socket.join(roomDeClase(clase.id));
        responder({ ok: true });
      } catch (err) {
        responder({ ok: false, error: err.message });
      }
    });

    socket.on('claseEnVivo:mensaje', async ({ liveClassId, texto } = {}, callback) => {
      const responder = typeof callback === 'function' ? callback : () => {};
      try {
        const textoLimpio = String(texto || '').trim();
        if (!textoLimpio) throw new Error('El mensaje no puede estar vacío');

        const clase = await liveClassModel.findById(liveClassId);
        if (!clase) throw new Error('La clase no existe');
        const autorizado = await tieneAcceso(clase.id, socket.user);
        if (!autorizado) throw new Error('No tenés acceso a esta clase');

        const mensaje = await liveClassMessageModel.crear({ liveClassId: clase.id, userId, cuerpo: textoLimpio });
        const payload = {
          liveClassId: clase.id,
          mensaje: { ...mensaje, remitente_nombre: nombre },
        };

        io.to(roomDeClase(clase.id)).emit('claseEnVivo:mensaje-nuevo', payload);
        responder({ ok: true, mensaje: payload.mensaje });
      } catch (err) {
        responder({ ok: false, error: err.message });
      }
    });

    // Rol informativo nada más (no se persiste): así el que está en la
    // sala ve "profesor conectado" / "se sumó un alumno" sin tener que
    // refrescar el historial de mensajes para notarlo.
    socket.on('claseEnVivo:presencia', ({ liveClassId } = {}) => {
      if (!liveClassId) return;
      socket.to(roomDeClase(liveClassId)).emit('claseEnVivo:presencia', { userId, nombre, rol });
    });
  });
}

// Lo llama liveClasses.controller.js después de iniciar, finalizar o
// cancelar una clase (fuera de cualquier conexión de socket puntual), para
// que quien tenga la sala o el listado abiertos se entere en el momento
// sin tener que refrescar la página.
function emitirCambioEstado(liveClassId, estado) {
  if (!ioRef) return;
  ioRef.to(roomDeClase(liveClassId)).emit('claseEnVivo:estado', { liveClassId, estado });
}

module.exports = { attachLiveClassSocket, emitirCambioEstado };
