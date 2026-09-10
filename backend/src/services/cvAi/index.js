// Registro de "motores" de generación de CV para IA — mismo patrón
// exacto que services/agentProviders/index.js (el registro de proveedores
// del sandbox de agentes): el resto del código (cv.controller.js) solo
// pide "generá con el motor <clave>" y nunca sabe cómo arma el HTML de
// verdad.
//
// Hoy hay un solo motor: 'plantilla' (templateEngine.js) — arma el HTML
// sustituyendo variables en la plantilla que cargó el admin, con nivel y
// recomendaciones calculados por reglas fijas (cv.service.js), sin
// ningún modelo de IA real de por medio. El día de mañana, conectar un
// motor 'ia' que le pida a un modelo real que redacte/optimice el CV
// (en vez de solo sustituir variables en HTML fijo) alcanza con sumar un
// archivo más acá y una entrada en MOTORES — cv.controller.js y el
// frontend no cambian.
const motorPlantilla = require('./templateEngine');

const MOTORES = {
  plantilla: motorPlantilla,
};

function getMotor(clave = 'plantilla') {
  return MOTORES[clave] || motorPlantilla;
}

module.exports = { getMotor, MOTORES };
