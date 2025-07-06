// server/knexfile.js
require('dotenv').config({ path: './.env.render' }); // For production-like tasks

// This is the default connection string for local development when running
// commands on the host machine against the Docker containers.
const LOCAL_DOCKER_URL = 'postgresql://myuser:mypassword@localhost:5433/idcard_db';

module.exports = {
  development: {
    client: 'pg',
    // If DATABASE_URL is provided by Docker Compose, use it.
    // Otherwise, default to the local connection string.
    connection: process.env.DATABASE_URL || LOCAL_DOCKER_URL,
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  },

  test: {
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgresql://myuser:mypassword@localhost:5433/idcard_test_db',
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    },
    useNullAsDefault: true
  },

  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL, // This will be the Supabase URL
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: './db/migrations'
    }
  }
};