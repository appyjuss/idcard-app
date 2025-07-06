// server/jest.config.js
module.exports = {
  testEnvironment: 'node', // Specifies that we're testing a Node.js environment
  testTimeout: 10000, // Increase timeout for tests that might involve DB setup
  setupFilesAfterEnv: ['./jest.setup.js'], // A file to run before all tests
};