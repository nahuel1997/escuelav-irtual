process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');
const { loginLimiter, LOGIN_MAX_POR_MINUTO } = require('../src/middlewares/rateLimit.middleware');

describe('Rate limiting de login', () => {
  test('bloquea con 429 después de superar el máximo de intentos por IP', async () => {
    // El limiter se salta a sí mismo cuando NODE_ENV=test (para no romper
    // el resto de la suite, que hace varios logins seguidos contra la
    // misma IP de loopback — ver comentario en rateLimit.middleware.js).
    // Para probar acá que el límite funciona de verdad, forzamos otro
    // NODE_ENV solo durante este test, contra una app mínima aparte (no
    // la app completa: no necesitamos base de datos para esto).
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const app = express();
      app.post('/login', loginLimiter, (req, res) => res.json({ ok: true }));

      for (let i = 0; i < LOGIN_MAX_POR_MINUTO; i++) {
        const res = await request(app).post('/login').send({});
        expect(res.status).toBe(200);
      }

      const bloqueado = await request(app).post('/login').send({});
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.body.error).toMatch(/demasiados intentos/i);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
