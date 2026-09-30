// Arma el error que devuelve la API de datos con el texto que el admin
// configuró en APIs → "Mensajes de error" (tabla api_errores). Si la tabla
// no está (migración pendiente) o el código no existe, usa el texto por
// defecto — la API nunca se cae por esto.
const apiSeguridadModel = require('../models/apiSeguridad.model');
const { AppError } = require('../middlewares/error.middleware');

async function errorApi(codigo, { status, porDefecto, variables = {} } = {}) {
  let mensaje = porDefecto || codigo;
  let httpStatus = status || 400;
  try {
    const fila = await apiSeguridadModel.findError(codigo);
    if (fila) {
      mensaje = fila.mensaje;
      httpStatus = fila.http_status;
    }
  } catch (_e) {
    // tabla todavía no creada: texto por defecto
  }
  Object.entries(variables).forEach(([k, v]) => { mensaje = mensaje.split(`{${k}}`).join(String(v)); });
  const err = new AppError(mensaje, httpStatus);
  err.codigo = codigo;
  return err;
}

function formatoEspera(ms) {
  const seg = Math.ceil(ms / 1000);
  if (seg < 60) return `${seg} segundo${seg === 1 ? '' : 's'}`;
  const min = Math.ceil(seg / 60);
  return `${min} minuto${min === 1 ? '' : 's'}`;
}

module.exports = { errorApi, formatoEspera };
