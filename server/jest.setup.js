// server/jest.setup.js
const db = require('./db/db'); // Our main knex instance
const { redisConnection } = require('./controllers/jobController');

// Before all tests run, connect to the DB and run migrations
beforeAll(async () => {
  await db.migrate.latest();
});

// Before each individual test, clean the tables to ensure isolation
beforeEach(async () => {
  // Truncate tables in the correct order to respect foreign key constraints
  await db.raw('TRUNCATE TABLE jobs, id_cards RESTART IDENTITY CASCADE');
});

// After all tests have finished, destroy the database connection
afterAll(async () => {
  // Close both connections after all tests are done
  await db.destroy();
  await redisConnection.quit(); // or .disconnect()
});