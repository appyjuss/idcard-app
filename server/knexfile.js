// server/knexfile.js

// Load environment variables. In Docker, these will be provided by docker-compose.
// When running locally for production tasks, it can use a .env file.
require('dotenv').config({ path: './.env.render' }); // Keep your render .env renamed

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {

  // This is the environment we use inside Docker
  development: {
    client: 'pg',
    // This connection string comes directly from docker-compose.yml
    // It does NOT require SSL.
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  },

  // This is the environment you would use when connecting to your live Render database.
  production: { 
    client: 'pg',
    connection: {
      // This connection string comes from your Render dashboard / .env.render file
      connectionString: process.env.DATABASE_URL, 
      // Render's public-facing databases REQUIRE SSL.
      ssl: { rejectUnauthorized: false } 
    },
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  }

};