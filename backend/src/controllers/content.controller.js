const contentModel = require('../models/content.model');
const navLinkModel = require('../models/navLink.model');
const buttonOptionModel = require('../models/buttonOption.model');
const { asyncHandler } = require('../middlewares/error.middleware');

// Endpoint público: todo el frontend público (Navbar, Footer, Home,
// Contacto, etc.) lo consume de un solo golpe para mostrar lo que el admin
// haya editado desde /admin-panel/contenido. Si algo no está cargado, el
// frontend usa sus valores por defecto hardcodeados.
const getContent = asyncHandler(async (req, res) => {
  const [content, navLinks, buttons] = await Promise.all([
    contentModel.getMap(),
    navLinkModel.listAll(),
    buttonOptionModel.listAll(),
  ]);
  res.json({ content, navLinks, buttons });
});

module.exports = { getContent };
