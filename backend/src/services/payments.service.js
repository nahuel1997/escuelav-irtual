// =============================================================================
// payments.service.js — Capa de pagos.
//
// Tres métodos posibles:
//   - 'simulado'    → siempre disponible, aprueba al toque, no cobra nada
//                      real. Es el que se usaba hasta ahora y sigue siendo
//                      el default si no se elige uno real — cero cambio de
//                      comportamiento para quien no configuró nada.
//   - 'mercadopago' → real, disponible solo si MP_ACCESS_TOKEN está en
//                      .env. Usa Checkout Pro (redirect a una página
//                      hospedada por Mercado Pago): el alumno paga ahí, no
//                      en nuestro propio formulario — así no manejamos
//                      número de tarjeta nunca.
//   - 'paypal'      → real, disponible solo si PAYPAL_CLIENT_ID/SECRET
//                      están en .env. Mismo criterio: redirect a la página
//                      de PayPal (Orders API v2, checkout "Approve").
//
// APPLE PAY: no es una pasarela propia, es un método de pago DENTRO de la
// pasarela de otro. No hay código específico de Apple Pay acá — si la
// cuenta de Mercado Pago del comercio lo tiene habilitado (depende del
// país), Checkout Pro lo muestra solo como una opción más al alumno, sin
// que este archivo tenga que saber que existe. Ver README para el detalle
// de qué hace falta del lado de la cuenta de MP.
//
// NODE_ENV=test SIEMPRE usa el modo simulado, sin importar qué haya en
// .env — mismo criterio que mail.service.js con el SMTP real: los tests
// nunca deben depender de (ni golpear) una pasarela real. Si algún día se
// agregan tests que ejercitan de verdad crearCheckoutMercadoPago/PayPal,
// tienen que mockear el módulo `mercadopago` y el `fetch` a PayPal, nunca
// pegarle a la sandbox real desde CI.
//
// Un pago real es ASÍNCRONO: acá solo se crea la orden (pendiente) y se
// devuelve la URL a la que mandar al alumno. La confirmación (aprobado /
// rechazado) llega después, por webhook o por el retorno del alumno a la
// app — ver payments.controller.js, que es quien de verdad inscribe al
// terminar. Este archivo solo habla con las pasarelas, nunca toca
// enrollments ni carritos.
// =============================================================================
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const env = require('../config/env');
const appSettingModel = require('../models/appSetting.model');

let mpClient = null;
function getMpClient() {
  if (!mpClient) mpClient = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });
  return mpClient;
}

// Qué métodos reales están listos para usarse (tienen credenciales
// cargadas). 'simulado' no se lista acá a propósito: el checkout lo usa
// como fallback implícito cuando no se manda metodo_pago, no como una
// opción que el alumno "elige" a propósito en el selector del frontend.
function metodosDisponibles() {
  if (env.NODE_ENV === 'test') return []; // ver nota arriba
  const metodos = [];
  if (env.MP_ACCESS_TOKEN) metodos.push('mercadopago');
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) metodos.push('paypal');
  return metodos;
}

// Pago simulado de siempre — aprueba al toque, síncrono. Lo sigue usando
// el checkout cuando no se pidió un método real (o en cualquier NODE_ENV
// de test).
function processPayment({ course }) {
  const transactionId = `SIM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return Promise.resolve({ ok: true, method: 'simulado', status: 'pagado', transactionId });
}

// --- Mercado Pago ---------------------------------------------------------

// `items`: [{course_id, titulo, precio}]. `externalReference` es el id de
// nuestra payment_orders, para poder encontrarla de nuevo cuando llegue el
// webhook (MP lo devuelve tal cual en cada notificación y en cada consulta
// de pago).
async function crearCheckoutMercadoPago({ items, externalReference, payerEmail }) {
  const preference = await new Preference(getMpClient()).create({
    body: {
      items: items.map((i) => ({
        title: i.titulo,
        quantity: 1,
        unit_price: Number(i.precio),
        currency_id: 'ARS',
      })),
      payer: payerEmail ? { email: payerEmail } : undefined,
      external_reference: String(externalReference),
      back_urls: {
        success: `${env.BACKEND_URL}/api/payments/retorno`,
        pending: `${env.BACKEND_URL}/api/payments/retorno`,
        failure: `${env.BACKEND_URL}/api/payments/retorno`,
      },
      auto_return: 'approved',
      // Sin dominio público (dev local) esto no es alcanzable por MP y no
      // pasa nada: /retorno ya vuelve a confirmar el pago activamente, no
      // dependemos únicamente del webhook (ver payments.controller.js).
      notification_url: env.BACKEND_URL.startsWith('http://localhost') ? undefined : `${env.BACKEND_URL}/api/payments/webhook/mercadopago`,
    },
  });
  // sandbox_init_point solo existe con credenciales de prueba; con
  // credenciales de producción (live) no viene, por eso el fallback.
  const redirectUrl = preference.sandbox_init_point || preference.init_point;
  return { externalId: preference.id, redirectUrl };
}

// Nunca confiamos en lo que dice el webhook por las suyas (cualquiera
// podría mandarnos un POST fingiendo ser Mercado Pago) — siempre volvemos
// a preguntarle a la API de MP por el estado real de ESE payment_id.
async function confirmarPagoMercadoPago(paymentId) {
  const pago = await new Payment(getMpClient()).get({ id: paymentId });
  return {
    aprobado: pago.status === 'approved',
    status: pago.status, // approved | pending | rejected | in_process | cancelled | refunded...
    externalReference: pago.external_reference,
    montoTotal: pago.transaction_amount,
    paymentId: String(pago.id),
  };
}

// --- PayPal ----------------------------------------------------------------
// Sin SDK aparte: la API REST v2 de PayPal (Orders) es simple y Node 22 ya
// trae fetch nativo — un dependency menos que mantener. `PAYPAL_MODE`
// decide sandbox vs. cuenta real, mismo host para ambos casos salvo el
// subdominio.
function paypalApiBase() {
  return env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

let paypalTokenCache = null; // { token, expiraEn } — se pide uno nuevo si venció
async function getPaypalAccessToken() {
  if (paypalTokenCache && paypalTokenCache.expiraEn > Date.now()) return paypalTokenCache.token;
  const basic = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal OAuth falló: ${res.status} ${await res.text()}`);
  const data = await res.json();
  paypalTokenCache = { token: data.access_token, expiraEn: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

// PayPal no liquida en ARS — convertimos el total con la tasa manual de
// app_settings (ver seed 002_email_templates.js). `total` viene en ARS.
async function convertirATotalUsd(totalArs) {
  const tasa = Number(await appSettingModel.getValor('paypal_tasa_cambio_usd', '1000')) || 1000;
  return Math.max(0.01, Math.round((totalArs / tasa) * 100) / 100);
}

async function crearCheckoutPayPal({ total, externalReference }) {
  const totalUsd = await convertirATotalUsd(total);
  const token = await getPaypalAccessToken();
  const res = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: String(externalReference), amount: { currency_code: 'USD', value: totalUsd.toFixed(2) } }],
      application_context: {
        return_url: `${env.BACKEND_URL}/api/payments/retorno?provider=paypal`,
        cancel_url: `${env.BACKEND_URL}/api/payments/retorno?provider=paypal`,
      },
    }),
  });
  if (!res.ok) throw new Error(`PayPal crear orden falló: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const approveLink = (data.links || []).find((l) => l.rel === 'approve');
  return { externalId: data.id, redirectUrl: approveLink ? approveLink.href : null };
}

// El "capture" es lo que efectivamente mueve la plata en PayPal — antes de
// esto la orden está solo "aprobada por el alumno" pero no cobrada.
async function capturarPagoPayPal(orderId) {
  const token = await getPaypalAccessToken();
  const res = await fetch(`${paypalApiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  const captura = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    aprobado: res.ok && data.status === 'COMPLETED',
    status: data.status,
    externalReference: data.purchase_units?.[0]?.reference_id,
    paymentId: captura ? captura.id : null,
  };
}

module.exports = {
  processPayment,
  metodosDisponibles,
  crearCheckoutMercadoPago,
  confirmarPagoMercadoPago,
  crearCheckoutPayPal,
  capturarPagoPayPal,
  convertirATotalUsd,
};
