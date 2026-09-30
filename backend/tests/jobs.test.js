process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = './data/test-jobs.sqlite3';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'data', 'test-jobs.sqlite3');

// Tareas programadas que filtran por fecha. Antes comparaban un Date contra
// columnas de texto en SQLite y el filtro nunca daba verdadero (el mail no
// salía nunca) — ver utils/sqlFecha.js.
describe('Tareas programadas con filtro por fecha', () => {
  let db;
  let alumnoId;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    db = require('../src/config/db');
    await db.migrate.latest();
    const vieja = '2020-01-01 10:00:00';
    [alumnoId] = await db('users').insert({ nombre: 'Viejo', apellido: 'T', email: 'viejo-jobs@escuela.demo', password_hash: 'x', rol: 'alumno', created_at: vieja });
    const [cursoId] = await db('courses').insert({ titulo: 'Curso', descripcion: 'd', precio: 100, estado: 'subido' });
    const [cartId] = await db('carts').insert({ user_id: alumnoId, estado: 'activo' });
    await db('cart_items').insert({ cart_id: cartId, course_id: cursoId, agregado_at: vieja });
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  test('carrito abandonado encuentra el carrito viejo y manda el mail', async () => {
    const { correrJobCarritoAbandonado } = require('../src/jobs/carritoAbandonado.job');
    expect(await correrJobCarritoAbandonado()).toBe(1);
    // Queda marcado para no volver a avisarle por el mismo carrito.
    expect(await correrJobCarritoAbandonado()).toBe(0);
  });

  test('"te extrañamos" encuentra al usuario que nunca volvió', async () => {
    const { correrJobInactividad } = require('../src/jobs/inactividad.job');
    expect(await correrJobInactividad()).toBe(1);
    // Y no se lo vuelve a mandar enseguida (cooldown).
    expect(await correrJobInactividad()).toBe(0);
  });

  test('sqlFecha: el formato de SQLite y la vuelta a Date en UTC', () => {
    const { paraSql, aDate } = require('../src/utils/sqlFecha');
    expect(paraSql(new Date('2026-09-30T15:04:05.678Z'))).toBe('2026-09-30 15:04:05');
    expect(aDate('2026-09-30 15:04:05').toISOString()).toBe('2026-09-30T15:04:05.000Z');
  });
});
