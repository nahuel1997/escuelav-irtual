// Rutas públicas de marketing (sin login): ofertas activas en la app y el
// seguimiento de las campañas (pixel de apertura, click y baja). Con topes
// por IP para que no se puedan usar para inflar números ni probar tokens.
const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/marketing.controller');

const skip = () => process.env.NODE_ENV === 'test';
const limiter = (max) => rateLimit({ windowMs: 60 * 1000, max, standardHeaders: true, legacyHeaders: false, skip, message: { error: 'Demasiadas solicitudes' } });

const ofertasRouter = express.Router();
ofertasRouter.get('/activas', limiter(120), ctrl.ofertasActivas);
ofertasRouter.post('/:id/evento', limiter(60), ctrl.eventoOferta);

const seguimientoRouter = express.Router();
seguimientoRouter.get('/a/:token', limiter(120), ctrl.pixelApertura);
seguimientoRouter.get('/c/:token', limiter(60), ctrl.click);
seguimientoRouter.get('/baja/:token', limiter(30), ctrl.infoBaja);
seguimientoRouter.post('/baja/:token', limiter(30), ctrl.darDeBaja);

module.exports = { ofertasRouter, seguimientoRouter };
