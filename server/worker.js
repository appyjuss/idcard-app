// server/worker.js
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');
const fs = require('fs-extra');

const knexConfig = require('./knexfile');
const environment = process.env.NODE_ENV || 'development';
const db = require('knex')(knexConfig[environment]);

const { generateIdCard } = require('./services/idCardGenerator');

console.log("Worker process starting...");
console.log(`Using NODE_ENV: ${environment}`);

const redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

redisConnection.on('connect', () => {
    console.log('Worker connected to Redis.');
});
redisConnection.on('error', (err) => {
    console.error('Worker Redis connection error:', err);
});

const getJobOutputPath = (jobId) => path.join(__dirname, 'uploads', 'jobs_data', String(jobId), 'generated_ids');

const worker = new Worker('idCardGenerationQueue', async (job) => {
    const { cardId, jobId } = job.data;
    console.log(`[Worker] Received BullMQ job ${job.id} for cardId: ${cardId}, jobId: ${jobId}`);

    let cardRecord;
    let originalJobRecord;
    const jobOutputPath = getJobOutputPath(jobId);
    let processingError = null; // To store error if card generation fails
    let outputFilePath = null;  // To store the path from successful generation

    try {
        originalJobRecord = await db('jobs').where({ id: jobId }).first();
        if (!originalJobRecord) {
            throw new Error(`CRITICAL: Original Job record not found for jobId: ${jobId} (related to cardId: ${cardId})`);
        }

        // If job is new (pending/queued), mark it as 'processing'
        if (['pending', 'queued'].includes(originalJobRecord.status)) {
            await db('jobs').where({ id: jobId }).update({
                status: 'processing',
                // removed started_at
                updated_at: db.fn.now()
            });
            console.log(`[Worker] Job ${jobId} status updated to 'processing'.`);
        }

        // 1. Mark current card as 'processing'
        await db('id_cards').where({ id: cardId }).update({
            status: 'processing',
            updated_at: db.fn.now()
        });
        console.log(`[Worker] Card ${cardId} status updated to 'processing'.`);

        // 2. Fetch current card details
        cardRecord = await db('id_cards').where({ id: cardId }).first();
        if (!cardRecord) throw new Error(`Card record not found for cardId: ${cardId}`);
        console.log(`[Worker] Fetched card data for card ${cardId}`);

        // 3. Ensure output directory
        await fs.ensureDir(jobOutputPath);

        // --- Actual ID Card Generation ---
        console.log(`[Worker] Starting ID card generation for card ${cardId}...`);
        outputFilePath = await generateIdCard(cardRecord, originalJobRecord, jobOutputPath);
        console.log(`[Worker] Generation complete for card ${cardId}. Output at: ${outputFilePath}`);

        // 4. Update card to 'completed'
        await db('id_cards').where({ id: cardId }).update({
            status: 'completed',
            output_file_path: outputFilePath,
            error_message: null,
            updated_at: db.fn.now()
        });
        console.log(`[Worker] Card ${cardId} status updated to 'completed'.`);

        // 5. Increment successfully processed_cards
        await db('jobs').where({ id: jobId }).increment('processed_cards', 1);

    } catch (error) {
        processingError = error; // Store the error for re-throwing later
        console.error(`[Worker] Error during processing of card ${cardId} for BullMQ job ${job.id}:`, error.message);
        // console.error(error.stack); // Uncomment for full stack trace during debugging

        if (cardId) { // Ensure cardId is valid before DB update
            await db('id_cards').where({ id: cardId }).update({
                status: 'failed',
                error_message: error.message.slice(0, 500), // Truncate error if needed
                updated_at: db.fn.now()
            }).catch(dbErr => console.error(`[Worker] DB Error: Failed to update card ${cardId} to 'failed' status:`, dbErr));
        }
    }

    // --- Always Check and Update Overall Job Status ---
    // Refetch originalJobRecord if it wasn't fetched due to an early error (shouldn't happen with current flow but good practice)
    if (!originalJobRecord) {
        try {
            originalJobRecord = await db('jobs').where({ id: jobId }).first();
        } catch (dbFetchError) {
            console.error(`[Worker] CRITICAL DB Error: Could not fetch originalJobRecord for final status check of job ${jobId}:`, dbFetchError);
            // If we can't get job details, we can't reliably update job status.
            // The original processingError (if any) for the card will be thrown.
            if (processingError) throw processingError;
            throw dbFetchError; // This would be a new error related to the job check itself
        }
    }
    
    if (originalJobRecord) {
        try {
            const finalizedCards = await db('id_cards')
                .where({ job_id: jobId })
                .whereIn('status', ['completed', 'failed']); // CORRECTED: .whereIn

            const finalizedCount = finalizedCards.length;
            console.log(`[Worker] Job ${jobId}: ${finalizedCount} of ${originalJobRecord.total_cards} cards have reached a final state.`);

            if (finalizedCount >= originalJobRecord.total_cards) {
                // Fetch the current job details again before updating to avoid race conditions slightly better
                const currentJobDetails = await db('jobs').where({ id: jobId }).first();

                // Only update job status if it's currently 'processing'
                if (currentJobDetails && currentJobDetails.status === 'processing') {
                    const failedCardsInJobCount = finalizedCards.filter(card => card.status === 'failed').length;
                    if (failedCardsInJobCount > 0) {
                        await db('jobs').where({ id: jobId }).update({
                            status: 'completed_with_errors',
                            completed_at: db.fn.now(), // Set completion time
                            updated_at: db.fn.now()
                        });
                        console.log(`[Worker] Job ${jobId} finished with ${failedCardsInJobCount} card(s) failing.`);
                    } else {
                        await db('jobs').where({ id: jobId }).update({
                            status: 'completed',
                            completed_at: db.fn.now(), // Set completion time
                            updated_at: db.fn.now()
                        });
                        console.log(`[Worker] Job ${jobId} fully completed successfully!`);
                    }
                } else {
                    console.log(`[Worker] Job ${jobId} current status ('${currentJobDetails ? currentJobDetails.status : 'N/A'}') is not 'processing'. Final status update skipped.`);
                }
            }
        } catch (dbError) {
            console.error(`[Worker] DB Error during final job status check for job ${jobId}:`, dbError);
            // If card processing also failed, that error (processingError) should be thrown.
            // If card processing succeeded but this DB update failed, the job might appear stuck in 'processing'.
            // This specific error is tricky. For now, we log it. The card's BullMQ job might complete.
        }
    } else {
        console.warn(`[Worker] Could not perform final job status check for job ${jobId} as originalJobRecord was not available (this should be rare).`);
    }

    // If an error occurred during the card-specific processing, re-throw it now.
    // This ensures BullMQ marks this specific job (for this card) as FAILED.
    if (processingError) {
        throw processingError;
    }

    // If card processing was successful, return data for the 'completed' event.
    return { success: true, cardId, outputFilePath };

}, { connection: redisConnection, concurrency: 5 });

worker.on('completed', (job, result) => {
    console.log(`[Worker] BullMQ Job ${job.id} (CardID: ${job.data.cardId}) marked COMPLETED. Result:`, result);
});

worker.on('failed', (job, err) => {
    // This listener is triggered when the async job function throws an error.
    console.error(`[Worker] BullMQ Job ${job.id} (CardID: ${job.data.cardId}) marked FAILED. Error: ${err.message}`);
});

worker.on('error', err => {
    console.error('[Worker] Worker instance encountered an error (e.g., Redis issue):', err);
});

async function gracefulShutdown() {
    console.log('[Worker] Initiating graceful shutdown...');
    try {
        await worker.close();
        console.log('[Worker] BullMQ worker closed.');
        await redisConnection.quit();
        console.log('[Worker] Redis connection closed.');
        await db.destroy();
        console.log('[Worker] Database connection closed.');
    } catch (err) {
        console.error('[Worker] Error during graceful shutdown:', err);
    } finally {
        process.exit(0);
    }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

console.log("Worker initialized and listening for jobs on 'idCardGenerationQueue'...");