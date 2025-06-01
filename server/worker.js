// server/worker.js
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') }); // Load .env from server directory

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');
const fs = require('fs-extra'); // For file system operations

// Database Connection (using your existing knex setup)
const knexConfig = require('./knexfile'); // Adjust path if your knexfile is elsewhere
const environment = process.env.NODE_ENV || 'development';
const db = require('knex')(knexConfig[environment]);

// Image processing library (install sharp: npm install sharp)
// const sharp = require('sharp'); // integrate this later

console.log("Worker process starting...");
console.log(`Using NODE_ENV: ${environment}`);
console.log(`Attempting to connect to DB: ${knexConfig[environment]?.connection?.database || 'DB details not fully shown'}`);
console.log(`Attempting to connect to Redis: ${process.env.REDIS_URL}`);

const { generateIdCard } = require('./services/idCardGenerator'); 

// Redis Connection (must match the one used in jobController.js)
const redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Recommended for BullMQ
    enableReadyCheck: false // Can help with initial connection on some Redis providers
});

redisConnection.on('connect', () => {
    console.log('Worker connected to Redis.');
});
redisConnection.on('error', (err) => {
    console.error('Worker Redis connection error:', err);
    // Consider exiting or implementing a more robust retry/reconnect strategy for production
});

// Define where generated ID cards will be stored
const getJobOutputPath = (jobId) => path.join(__dirname, 'uploads', 'jobs_data', String(jobId), 'generated_ids');

const worker = new Worker('idCardGenerationQueue', async (job) => {
    const { cardId, jobId } = job.data;
    console.log(`[Worker] Received job ${job.id} for cardId: ${cardId}, jobId: ${jobId}`);

    let cardRecord;
    let jobRecord;
    const jobOutputPath = getJobOutputPath(jobId);

    try {
        // 1. Mark card as 'processing'
        await db('id_cards').where({ id: cardId }).update({
            status: 'processing',
            updated_at: db.fn.now()
        });
        console.log(`[Worker] Card ${cardId} status updated to 'processing'.`);

        // 2. Fetch card and job details
        cardRecord = await db('id_cards').where({ id: cardId }).first();
        jobRecord = await db('jobs').where({ id: jobId }).first();

        if (!cardRecord) throw new Error(`Card record not found for cardId: ${cardId}`);
        if (!jobRecord) throw new Error(`Job record not found for jobId: ${jobId}`);

        console.log(`[Worker] Fetched card data: ${cardRecord.photo_identifier}, Job data: ${jobRecord.server_template_path}`);

        // 3. Ensure output directory for this job exists
        await fs.ensureDir(jobOutputPath);

         // --- Actual ID Card Generation using the service ---
        console.log(`[Worker] Starting ID card generation for card ${cardId}...`);
        const outputFilePath = await generateIdCard(cardRecord, jobRecord, jobOutputPath); // <-- USE THE SERVICE
        console.log(`[Worker] Generation complete. Output at: ${outputFilePath}`);
        // --- End ID Card Generation ---

        // 4. Update card status to 'completed'
        await db('id_cards').where({ id: cardId }).update({
            status: 'completed',
            output_file_path: outputFilePath, // Store the path to the generated card
            updated_at: db.fn.now()
        });
        console.log(`[Worker] Card ${cardId} status updated to 'completed'. Path: ${outputFilePath}`);

        // 5. Increment processed_cards count for the job
        const { count: processedCount } = await db('jobs')
            .where({ id: jobId })
            .increment('processed_cards', 1)
            .returning('processed_cards') // Some DBs return an array of objects, others a direct value
            .then(result => ({ count: Array.isArray(result) ? (result[0]?.processed_cards || result[0]) : result }));


        console.log(`[Worker] Job ${jobId} processed cards: ${processedCount} / ${jobRecord.total_cards}`);

        // 6. If all cards for the job are processed, update job status to 'completed'
        if (processedCount >= jobRecord.total_cards) {
            await db('jobs').where({ id: jobId }).update({
                status: 'completed',
                completed_at: db.fn.now(),
                updated_at: db.fn.now()
            });
            console.log(`[Worker] Job ${jobId} fully completed!`);
        }

        return { success: true, cardId, outputFilePath }; // Optional: what the job resolves to

    } catch (error) {
        console.error(`[Worker] Error processing job ${job.id} (cardId: ${cardId}):`, error.message);
        console.error(error.stack); // Full stack trace

        // Mark card as 'failed'
        if (cardId) { // Ensure cardId is defined before trying to update
            await db('id_cards').where({ id: cardId }).update({
                status: 'failed',
                error_message: error.message.slice(0, 500), // Truncate error message if too long for DB field
                updated_at: db.fn.now()
            }).catch(dbErr => console.error(`[Worker] Failed to update card ${cardId} to 'failed' status:`, dbErr));
        }
        // Optionally, you might want to increment a 'failed_cards' count on the job record
        // And potentially mark the whole job as 'failed' or 'partially_completed' if too many cards fail.

        throw error; // Re-throw error to let BullMQ know the job failed
    }
}, { connection: redisConnection, concurrency: 5 }); // `concurrency` is how many jobs this worker can process in parallel

worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} (CardID: ${job.data.cardId}) completed. Result:`, result);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} (CardID: ${job.data.cardId}) failed with error: ${err.message}`);
    // console.error(err.stack); // Already logged in the catch block
});

worker.on('error', err => {
    // Local worker errors (e.g., Redis connection lost)
    console.error('[Worker] Worker encountered an error:', err);
});

process.on('SIGINT', async () => {
    console.log('[Worker] SIGINT received, closing worker...');
    await worker.close();
    await redisConnection.quit();
    await db.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM received, closing worker...');
    await worker.close();
    await redisConnection.quit();
    await db.destroy();
    process.exit(0);
});

console.log("Worker initialized and listening for jobs on 'idCardGenerationQueue'...");