// Estado en memoria de si hay migraciones de la base sin correr. Se
// calcula una sola vez al arrancar (ver chequearMigraciones() en app.js) y
// se expone en GET /api/health para poder chequearlo sin tener que andar
// buscando el warning entre los logs del server.
//
// Por qué esto existe: el bug que arrancó la sesión donde se agregó esto
// (favicon/logo no se veían en el sitio) fue, en el fondo, 5 migraciones
// nunca corridas — y el único síntoma visible era un 500 silencioso en
// GET /api/content. Con esto, el problema queda gritado en la consola del
// server apenas arranca, en vez de descubrirse horas después.
let estado = { chequeado: false, pendientes: [] };

function setPendientes(lista) {
  estado = { chequeado: true, pendientes: lista };
}

function getEstado() {
  return estado;
}

module.exports = { setPendientes, getEstado };
