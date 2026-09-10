// Configuración de knex (query builder + migraciones).
// Elegimos el cliente según DB_CLIENT (ver .env.example). Arrancamos en
// "sqlite" para no depender de tener Postgres instalado; el día de mañana
// alcanza con cambiar DB_CLIENT=postgres y completar DATABASE_URL para que
// TODO el código de controllers/models siga funcionando igual, porque
// siempre hablan con knex y no con el driver de la base directamente.
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const sqliteFilename = path.resolve(__dirname, '..', '..', env.SQLITE_FILE.replace('./', ''));

// La carpeta ./data no existe hasta que alguien la crea: nos aseguramos acá
// (tanto si nos importa la app vía config/db.js como si nos usa el CLI de
// knex directamente para migrar/seedear).
const sqliteDir = path.dirname(sqliteFilename);
if (!fs.existsSync(sqliteDir)) fs.mkdirSync(sqliteDir, { recursive: true });

const sqliteConfig = {
  client: 'better-sqlite3',
  connection: {
    filename: sqliteFilename,
  },
  useNullAsDefault: true,
};

const postgresConfig = {
  client: 'pg',
  connection: env.DATABASE_URL,
};

const config = env.DB_CLIENT === 'postgres' ? postgresConfig : sqliteConfig;

module.exports = {
  ...config,
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
  },
  seeds: {
    directory: path.resolve(__dirname, 'seeds'),
  },
};
