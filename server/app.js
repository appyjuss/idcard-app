// server/app.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const jobRoutes = require('./routes/jobRoutes');

const app = express();

app.use(cors());

// Configure CORS
const corsOptions = {
  // example: origin: 'https://your-frontend-url.onrender.com'
  origin: '*', 
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// API Routes
app.use('/api/jobs', jobRoutes); // <--- USE JOB ROUTES FOR THIS PATH
// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// Catch-all for unhandled routes (optional, good for dev)
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Global error handler (very basic for now)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

module.exports = app;