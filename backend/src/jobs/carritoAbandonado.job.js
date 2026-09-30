// Job: mail de carrito abandonado. Corre cada 30 minutos; el umbral real
// de "cuánto tiempo sin actividad cuenta como abandonado" es configurable
// desde el backoffice (app_settings.horas_carrito_abandonado).
const cartModel = require('../models/cart.model');
const { paraSql } = require('../utils/sqlFecha');
const appSettingModel = require('../models/appSetting.model');
const mailService = require('../services/mail.service');
const env = require('../config/env');

function formatPrecio(precio) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precio);
}

async function correrJobCarritoAbandonado() {
  const horas = Number(await appSettingModel.getValor('horas_carrito_abandonado', 24));
  const umbralFecha = paraSql(new Date(Date.now() - horas * 60 * 60 * 1000));
  // paraSql: en SQLite un Date se compara como número contra columnas de texto y el
  // filtro nunca daba verdadero — el mail no salía nunca (ver utils/sqlFecha.js).
  const candidatos = await cartModel.listCandidatosAAbandono(umbralFecha);

  for (const c of candidatos) {
    const items = await cartModel.listItems(c.cart_id);
    if (items.length === 0) continue; // por las dudas, no debería pasar por el join del propio query

    const cursosHtml = `<ul>${items.map((i) => `<li>${i.titulo} — ${formatPrecio(i.precio)}</li>`).join('')}</ul>`;

    await mailService.enviarMail({
      clave: 'carrito_abandonado',
      destinatario: c.email,
      variables: { nombre: c.nombre, cursos: cursosHtml, link_carrito: `${env.FRONTEND_URL}/carrito` },
      userId: c.user_id,
    });

    await cartModel.marcarAbandonado(c.cart_id);
  }

  return candidatos.length;
}

module.exports = { correrJobCarritoAbandonado };
