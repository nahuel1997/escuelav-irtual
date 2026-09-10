// Instancia única de knex (pool de conexión) para toda la app.
// Antes de usar la base por primera vez, corré las migraciones:
//   npm run migrate
const knexLib = require('knex');
// knexfile.js ya se encarga de crear la carpeta ./data si hace falta (así
// funciona tanto acá como cuando el CLI de knex lo usa directamente).
const knexConfig = require('../db/knexfile');

const db = knexLib(knexConfig);

module.exports = db;
