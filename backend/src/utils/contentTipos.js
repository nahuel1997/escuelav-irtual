// Tipos válidos para site_content.tipo. Ver migración 20260821000013: la
// columna ya no tiene CHECK a nivel de base, así que la validez la
// controla acá la aplicación (mismo patrón que utils/roles.js).
//   texto     -> string corto o largo (el admin decide input/textarea)
//   imagen    -> URL servida desde /uploads
//   color     -> "#rrggbb"
//   seleccion -> valor de una lista fija definida en el frontend (ej: fuente)
//   boton     -> id de un button_options (ver button.model.js)
const CONTENT_TIPOS = ['texto', 'imagen', 'color', 'seleccion', 'boton'];

function esTipoValido(tipo) {
  return CONTENT_TIPOS.includes(tipo);
}

module.exports = { CONTENT_TIPOS, esTipoValido };
