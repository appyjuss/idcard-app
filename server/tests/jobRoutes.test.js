// server/tests/jobRoutes.test.js
const request = require('supertest');
const app = require('../app'); // We need to export our app from a separate file
const db = require('../db/db');

describe('Job API Endpoints', () => {

  describe('GET /api/jobs', () => {
    it('should return an empty array when no jobs exist', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(0);
    });

    it('should return a list of jobs when they exist', async () => {
      // Setup: Insert a dummy job into the test database
      await db('jobs').insert({
        original_csv_filename: 'test.csv',
        status: 'completed',
      });

      const res = await request(app).get('/api/jobs');
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toHaveProperty('original_csv_filename', 'test.csv');
    });
  });

  describe('POST /api/jobs', () => {
    it('should create a new job with valid file uploads', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .attach('csvFile', 'tests/fixtures/sample_data.csv')
        .attach('templateFile', 'tests/fixtures/id_template.svg')
        .attach('photosZip', 'tests/fixtures/photos.zip');

      // This is a complex endpoint, so we'll just check for a successful creation for now
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('jobId');
      expect(res.body).toHaveProperty('jobStatus', 'queued');

      // Verify the job was actually created in the database
      const jobs = await db('jobs').select('*');
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe(res.body.jobId);
    });

    it('should return 400 if a required file is missing', async () => {
        const res = await request(app)
            .post('/api/jobs')
            .attach('csvFile', 'tests/fixtures/sample_data.csv')
            .attach('templateFile', 'tests/fixtures/id_template.svg'); // Missing photosZip

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain('all required');
    });
  }, 15000);

});