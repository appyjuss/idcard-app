// server/db/db.js (Revised for simplicity)
const knex = require('knex');
const knexConfig = require('../knexfile'); // knexfile.js already loads dotenv

const environment = process.env.NODE_ENV || 'development';
const configOptions = knexConfig[environment];

if (!configOptions) {
  console.error(`Knex configuration for environment '${environment}' not found in knexfile.js.`);
  console.error(`Available configurations: ${Object.keys(knexConfig).join(', ')}`);
  console.error(`Current NODE_ENV: ${process.env.NODE_ENV}`);
  process.exit(1); // Exit if config is missing
}

module.exports = knex(configOptions);