process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

// Unit tests de payments.service.js — la única capa que habla de verdad
// con Mercado Pago/PayPal. Como dice el comentario en el archivo: estos
// tests SIEMPRE mockean el módulo `mercadopago` y el `fetch` global a
// PayPal, nunca pegan a una sandbox real (ni acá ni en CI).
jest.mock('mercadopago', () => {
  const create = jest.fn();
  const get = jest.fn();
  return {
    MercadoPagoConfig: jest.fn().mockImplementation(function mockCtor(opts) { this.opts = opts; }),
    Preference: jest.fn().mockImplementation(function mockCtor() { this.create = create; }),
    Payment: jest.fn().mockImplementation(function mockCtor() { this.get = get; }),
    __create: create,
    __get: get,
  };
});

jest.mock('../src/models/appSetting.model', () => ({
  getValor: jest.fn(),
}));

const { __create: mockPreferenceCreate, __get: mockPaymentGet } = require('mercadopago');
const appSettingModel = require('../src/models/appSetting.model');
const paymentsService = require('../src/services/payments.service');

describe('payments.service (unit, sin red real)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('metodosDisponibles siempre devuelve [] en NODE_ENV=test, sin importar las credenciales', () => {
    // Esto es a propósito (ver el comentario en el archivo): los tests
    // nunca deben poder "activar" una pasarela real por accidente.
    expect(paymentsService.metodosDisponibles()).toEqual([]);
  });

  test('processPayment (simulado) aprueba siempre y arma un transactionId propio', async () => {
    const pago = await paymentsService.processPayment({ course: { id: 1 } });
    expect(pago).toMatchObject({ ok: true, method: 'simulado', status: 'pagado' });
    expect(pago.transactionId).toMatch(/^SIM-/);
  });

  describe('Mercado Pago', () => {
    test('crearCheckoutMercadoPago arma la preferencia con los items y vuelve con el link de sandbox', async () => {
      mockPreferenceCreate.mockResolvedValue({ id: 'PREF-1', sandbox_init_point: 'https://sandbox.mp/pref-1', init_point: 'https://mp/pref-1' });

      const resultado = await paymentsService.crearCheckoutMercadoPago({
        items: [{ course_id: 5, titulo: 'Curso X', precio: 1000 }],
        externalReference: 42,
        payerEmail: 'alumno@escuela.demo',
      });

      expect(resultado).toEqual({ externalId: 'PREF-1', redirectUrl: 'https://sandbox.mp/pref-1' });
      const bodyMandado = mockPreferenceCreate.mock.calls[0][0].body;
      expect(bodyMandado.items).toEqual([{ title: 'Curso X', quantity: 1, unit_price: 1000, currency_id: 'ARS' }]);
      expect(bodyMandado.external_reference).toBe('42');
      expect(bodyMandado.payer).toEqual({ email: 'alumno@escuela.demo' });
      // BACKEND_URL por default es localhost: notification_url no tiene
      // sentido ahí (Mercado Pago no puede pegarle a nuestra máquina) —
      // ver el comentario en el service sobre por qué se omite.
      expect(bodyMandado.notification_url).toBeUndefined();
    });

    test('crearCheckoutMercadoPago usa init_point si no hay sandbox_init_point (credenciales de producción)', async () => {
      mockPreferenceCreate.mockResolvedValue({ id: 'PREF-2', init_point: 'https://mp/pref-2' });
      const resultado = await paymentsService.crearCheckoutMercadoPago({ items: [{ titulo: 'Y', precio: 500 }], externalReference: 1 });
      expect(resultado.redirectUrl).toBe('https://mp/pref-2');
    });

    test('confirmarPagoMercadoPago vuelve a preguntarle a la API de MP por el estado real', async () => {
      mockPaymentGet.mockResolvedValue({ id: 999, status: 'approved', external_reference: '42', transaction_amount: 1000 });
      const confirmacion = await paymentsService.confirmarPagoMercadoPago('999');
      expect(mockPaymentGet).toHaveBeenCalledWith({ id: '999' });
      expect(confirmacion).toEqual({ aprobado: true, status: 'approved', externalReference: '42', montoTotal: 1000, paymentId: '999' });
    });

    test('confirmarPagoMercadoPago: un pago pendiente/rechazado nunca se marca aprobado', async () => {
      mockPaymentGet.mockResolvedValue({ id: 1, status: 'rejected', external_reference: '1' });
      const confirmacion = await paymentsService.confirmarPagoMercadoPago('1');
      expect(confirmacion.aprobado).toBe(false);
      expect(confirmacion.status).toBe('rejected');
    });
  });

  describe('PayPal', () => {
    function mockFetchSecuencia(respuestas) {
      let i = 0;
      global.fetch.mockImplementation(() => Promise.resolve(respuestas[i++]));
    }

    test('crearCheckoutPayPal pide un token OAuth, convierte el total a USD con la tasa configurada, y crea la orden', async () => {
      appSettingModel.getValor.mockResolvedValue('1000'); // 1000 ARS = 1 USD
      mockFetchSecuencia([
        { ok: true, json: async () => ({ access_token: 'TOKEN-1', expires_in: 3600 }) }, // OAuth
        { ok: true, json: async () => ({ id: 'PP-ORDER-1', links: [{ rel: 'approve', href: 'https://paypal/approve/1' }] }) }, // crear orden
      ]);

      const resultado = await paymentsService.crearCheckoutPayPal({ total: 5000, externalReference: 7 });

      expect(resultado).toEqual({ externalId: 'PP-ORDER-1', redirectUrl: 'https://paypal/approve/1' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const [, opcionesCrearOrden] = global.fetch.mock.calls[1];
      const bodyOrden = JSON.parse(opcionesCrearOrden.body);
      expect(bodyOrden.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '5.00' });
      expect(bodyOrden.purchase_units[0].reference_id).toBe('7');
    });

    test('convertirATotalUsd redondea a centavos y nunca da 0 (mínimo 0.01)', async () => {
      appSettingModel.getValor.mockResolvedValue('1000');
      expect(await paymentsService.convertirATotalUsd(1550)).toBeCloseTo(1.55);
      expect(await paymentsService.convertirATotalUsd(1)).toBe(0.01);
    });

    test('el token OAuth se cachea: no se vuelve a pedir si todavía no venció', async () => {
      // El cache de token es un singleton a nivel de módulo (ver
      // getPaypalAccessToken en payments.service.js) — el test anterior de
      // este mismo archivo ya lo dejó "tibio" con TOKEN-1, así que acá NI
      // LA PRIMERA de estas dos llamadas debería volver a pedir OAuth.
      appSettingModel.getValor.mockResolvedValue('1000');
      mockFetchSecuencia([
        { ok: true, json: async () => ({ id: 'PP-ORDER-2', links: [{ rel: 'approve', href: 'https://paypal/approve/2' }] }) },
        { ok: true, json: async () => ({ id: 'PP-ORDER-3', links: [{ rel: 'approve', href: 'https://paypal/approve/3' }] }) },
      ]);

      await paymentsService.crearCheckoutPayPal({ total: 1000, externalReference: 1 });
      expect(global.fetch).toHaveBeenCalledTimes(1); // solo "crear orden", token reusado del cache

      await paymentsService.crearCheckoutPayPal({ total: 1000, externalReference: 2 });
      expect(global.fetch).toHaveBeenCalledTimes(2); // +1 sola de nuevo, nunca vuelve a pedir OAuth
    });

    test('capturarPagoPayPal reporta aprobado cuando PayPal devuelve COMPLETED', async () => {
      mockFetchSecuencia([{
        ok: true,
        json: async () => ({
          status: 'COMPLETED',
          purchase_units: [{ reference_id: '7', payments: { captures: [{ id: 'CAPTURE-1' }] } }],
        }),
      }]);

      const confirmacion = await paymentsService.capturarPagoPayPal('PP-ORDER-1');
      expect(confirmacion).toEqual({ aprobado: true, status: 'COMPLETED', externalReference: '7', paymentId: 'CAPTURE-1' });
    });

    test('capturarPagoPayPal: si PayPal no devuelve COMPLETED, no se marca aprobado', async () => {
      mockFetchSecuencia([{ ok: true, json: async () => ({ status: 'VOIDED', purchase_units: [{ reference_id: '7' }] }) }]);
      const confirmacion = await paymentsService.capturarPagoPayPal('PP-ORDER-X');
      expect(confirmacion.aprobado).toBe(false);
    });
  });
});
