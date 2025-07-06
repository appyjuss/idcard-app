// server/cleanup.js
const db = require('./db/db');
// Import the reusable deletion logic from our controller
const { performJobDeletion } = require('./controllers/jobController');

async function cleanupOldJobs() {
    console.log('Starting scheduled cleanup process...');
    const retentionDays = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`Searching for jobs created before: ${cutoffDate.toISOString()}`);

    try {
        const jobsToDelete = await db('jobs')
            .where('created_at', '<', cutoffDate)
            .select('id');

        if (jobsToDelete.length === 0) {
            console.log('No old jobs found to clean up. Exiting.');
            return;
        }

        console.log(`Found ${jobsToDelete.length} old jobs to delete.`);

        // Loop through the jobs and call our shared deletion logic for each one
        for (const job of jobsToDelete) {
            try {
                await performJobDeletion(job.id);
            } catch (error) {
                // Log the error for a specific job but continue with the rest
                console.error(`Failed to delete job #${job.id} during cleanup.`, error);
            }
        }

        console.log('Cleanup process completed.');

    } catch (error) {
        console.error('A critical error occurred during the cleanup process:', error);
        process.exit(1);
    }
}

cleanupOldJobs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));