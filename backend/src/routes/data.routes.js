const express = require('express');
const router = express.Router();
const dataApiController = require('../controllers/dataApi.controller');
const { apiClientAuth } = require('../middlewares/apiClientAuth.middleware');

// Toda /api/data/* se autentica con usuario/contraseña de api_clients
// (Basic Auth), no con el JWT de la app — ver apiClientAuth.middleware.js.
router.use(apiClientAuth);

router.get('/:tabla', dataApiController.getDatos);

module.exports = router;
