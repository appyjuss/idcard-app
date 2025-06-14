// server/controllers/jobController.js
const db = require('../db/db'); // Your Knex instance
const csv = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs-extra'); // For extended file system operations
const path = require('path');
const AdmZip = require('adm-zip'); // For unzipping
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const archiver = require('archiver')

const redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Recommended for BullMQ
    enableReadyCheck: false // Can help with initial connection on some Redis providers
});

redisConnection.on('connect', () => {
    console.log('jobController connected to Redis for queueing.');
});
redisConnection.on('error', (err) => {
    console.error('jobController Redis connection error:', err);
});


// Create a new queue instance (give it a descriptive name)
const idCardGenerationQueue = new Queue('idCardGenerationQueue', { connection: redisConnection });


// Helper to define base path for job-specific uploads
const getJobUploadsBasePath = () => path.join(__dirname, '..', 'uploads', 'jobs_data');

exports.createJob = async (req, res, next) => {
    // Check if all required files are present
    if (!req.files || !req.files.csvFile || !req.files.templateFile || !req.files.photosZip) {
        // Multer might have uploaded some files before this check. Clean them up.
        if (req.files) {
            Object.values(req.files).flat().forEach(file => {
                if (file && file.path) fs.unlink(file.path).catch(err => console.error(`Error cleaning up initial multer file ${file.path}:`, err));
            });
        }
        return res.status(400).json({ message: 'CSV, SVG Template, and Photos ZIP file are all required.' });
    }

    const csvFile = req.files.csvFile[0];
    const templateFile = req.files.templateFile[0];
    const photosZipFile = req.files.photosZip[0];

    let newJob;
    let jobSpecificPath; // Full path to this job's upload directory e.g., /path/to/server/uploads/jobs_data/1

    try {
        // 1. Create an initial job entry in the DB to get a job ID
        const expires = new Date();
        expires.setDate(expires.getDate() + 1); // Default expiry: 1 day (configurable)

        [newJob] = await db('jobs')
            .insert({
                original_csv_filename: csvFile.originalname,
                original_template_filename: templateFile.originalname,
                original_photos_zip_filename: photosZipFile.originalname,
                status: 'pending_assets', // Files received, assets need processing
                expires_at: expires,
                // total_cards, processed_cards will be updated after CSV parsing
            })
            .returning('*');

        if (!newJob || !newJob.id) {
            throw new Error('Failed to create initial job entry in database.');
        }

        // 2. Define and create job-specific directory using the new job ID
        // e.g., server/uploads/jobs_data/1/
        jobSpecificPath = path.join(getJobUploadsBasePath(), String(newJob.id));
        await fs.ensureDir(jobSpecificPath); // fs-extra: creates directory if it doesn't exist, like mkdir -p

        // Define server-side paths for the files (relative to project or absolute, store consistently)
        // For simplicity, let's store paths relative to the 'uploads' directory for DB, or use absolute.
        // Using paths relative to `getJobUploadsBasePath()` could be good.
        // Let's store full paths for now, makes retrieval easier.
        const serverCsvPath = path.join(jobSpecificPath, `data-${newJob.id}.csv`);
        const serverTemplatePath = path.join(jobSpecificPath, `template-${newJob.id}.svg`);
        const serverPhotosZipPath = path.join(jobSpecificPath, `photos-${newJob.id}.zip`);
        const serverPhotosUnzipPath = path.join(jobSpecificPath, 'photos'); // Directory for unzipped photos

        // 3. Move uploaded files from multer's temp location to the job-specific directory
        await fs.move(csvFile.path, serverCsvPath, { overwrite: true });
        await fs.move(templateFile.path, serverTemplatePath, { overwrite: true });
        await fs.move(photosZipFile.path, serverPhotosZipPath, { overwrite: true });

        // 4. Unzip the photos archive
        await fs.ensureDir(serverPhotosUnzipPath); // Ensure 'photos' subdirectory exists
        const zip = new AdmZip(serverPhotosZipPath);
        zip.extractAllTo(serverPhotosUnzipPath, true /* overwrite */);
        // Optionally, delete the zip file after extraction if not needed
        await fs.unlink(serverPhotosZipPath);


        // 5. Update the job record in DB with the final server paths
        await db('jobs').where({ id: newJob.id }).update({
            server_csv_path: serverCsvPath,
            server_template_path: serverTemplatePath,
            server_photos_unzip_path: serverPhotosUnzipPath,
            // status remains 'pending_assets' or could move to 'parsing_csv'
        });
        // Update our local newJob object too
        newJob.server_csv_path = serverCsvPath;
        newJob.server_template_path = serverTemplatePath;
        newJob.server_photos_unzip_path = serverPhotosUnzipPath;


        // 6. Parse CSV and create id_card entries
        const results = [];
        const csvDataBuffer = await fs.readFile(serverCsvPath); // Read the moved CSV
        const readableCsvStream = Readable.from(csvDataBuffer.toString());

        readableCsvStream
            .pipe(csv({
                // Example: Autodetect headers, or specify if needed
                mapHeaders: ({ header, index }) => header.toLowerCase().trim().replace(/\s+/g, '_')
            }))
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                if (results.length === 0) {
                    // Mark job as failed, cleanup files, and respond
                    await db('jobs').where({ id: newJob.id }).update({ status: 'failed', error_message: 'CSV file is empty or invalid.' });
                    await fs.remove(jobSpecificPath); // remove the job-specific folder and its contents
                    return res.status(400).json({ message: 'CSV file is empty or invalid.' });
                }

                let createdCardIds = []; // To store IDs of successfully created cards for queueing
                
                try {
                    await db.transaction(async (trx) => {
                        const cardEntries = results.map(row => {
                            // Heuristic to find photo identifier column.
                            // User should ideally provide this column name or it should be fixed (e.g., 'Photo File')
                            const photoIdKey = Object.keys(row).find(key =>
                                ['photo', 'image', 'picture', 'filename', 'identifier']
                                .some(keyword => key.toLowerCase().includes(keyword)) &&
                                (row[key] || '').toString().match(/\.(jpeg|jpg|png|gif|webp)$/i) // check if value looks like an image filename
                            );
                            const photoIdentifier = photoIdKey ? row[photoIdKey] : null;

                            // All other columns go into card_data
                            const dynamicData = { ...row };
                            if (photoIdKey) { // Avoid duplicating photo_identifier in card_data if it was a column
                                delete dynamicData[photoIdKey];
                            }

                            // Basic validation: photo_identifier is essential
                            if (!photoIdentifier) {
                                throw new Error(`Could not determine photo identifier for a row. Ensure CSV has a column with photo filenames (e.g., 'photo.jpg') and it's correctly identified. Row data: ${JSON.stringify(row)}`);
                            }

                            return {
                                job_id: newJob.id,
                                photo_identifier: photoIdentifier.trim(), // Sanitize
                                card_data: dynamicData, // Stored as JSONB
                                status: 'queued'
                            };
                        });

                        // Batch insert id_card entries and get their IDs
                        const insertedCards = await trx('id_cards').insert(cardEntries).returning('id');
                        createdCardIds = insertedCards.map(card => card.id); // Or just `insertedCards` if it returns array of IDs

                        // Update job status to 'queued' and set total_cards
                        await trx('jobs').where({ id: newJob.id }).update({
                            status: 'queued',
                            total_cards: results.length,
                            processed_cards: 0 // Initialize processed_cards
                        });
                        newJob.status = 'queued';
                        newJob.total_cards = results.length;
                        newJob.processed_cards = 0;
                    }); // End of DB transaction

                    // ***** BULLMQ INTEGRATION POINT *****
                    // Now that DB transaction is successful, add jobs to the queue
                    for (const cardId of createdCardIds) {
                        await idCardGenerationQueue.add('generateSingleCard', {
                            cardId: cardId,
                            jobId: newJob.id // Pass jobId for context (e.g., to find template/photo paths)
                        });
                        console.log(`Added card ${cardId} to idCardGenerationQueue for job ${newJob.id}`);
                    }
                    // ***** END BULLMQ INTEGRATION *****


                    res.status(201).json({
                        message: 'Job created, assets processed, and cards are queued for generation.',
                        jobId: newJob.id,
                        jobStatus: newJob.status,
                        totalCards: newJob.total_cards,
                        originalFilenames: {
                            csv: csvFile.originalname,
                            template: templateFile.originalname,
                            photos: photosZipFile.originalname
                        }
                    });

                } catch (dbError) { // Catch errors from DB transaction or card entry mapping
                    console.error('Error during DB transaction or CSV data mapping:', dbError);
                    // More advanced: could try to rollback or flag for retry.
                    await db('jobs').where({ id: newJob.id }).update({ status: 'failed_queueing', error_message: `DB/Queue Error: ${dbError.message.slice(0,250)}` });
                    await fs.remove(jobSpecificPath).catch(err => console.error(`Error cleaning up job directory ${jobSpecificPath} after DB/Queue error:`, err));
                    return res.status(500).json({ message: `Failed to process CSV/save cards/queue tasks: ${dbError.message}` });
                }
            })
            .on('error', async (parseError) => { // Catch errors from CSV parsing stream
                console.error('Error parsing CSV stream:', parseError);
                await db('jobs').where({ id: newJob.id }).update({ status: 'failed', error_message: `CSV Parse Error: ${parseError.message.slice(0,250)}` });
                await fs.remove(jobSpecificPath).catch(err => console.error(`Error cleaning up job directory ${jobSpecificPath} after CSV parse error:`, err));
                return res.status(400).json({ message: `Error parsing CSV file: ${parseError.message}` });
            });

    } catch (error) { // Catch errors from initial setup (DB job creation, file moves, unzipping)
        console.error('Error in createJob initial setup:', error);
        // If job was created but subsequent file ops failed, mark job as failed and attempt cleanup
        if (newJob && newJob.id) {
            await db('jobs').where({ id: newJob.id }).update({ status: 'failed', error_message: `Setup Error: ${error.message.slice(0,250)}` })
                .catch(dbErr => console.error("Failed to update job status on setup error:", dbErr)); // Log secondary error
        }
        if (jobSpecificPath) { // If job-specific path was defined, try to remove it
            await fs.remove(jobSpecificPath)
                .catch(fsErr => console.error(`Error cleaning up job directory ${jobSpecificPath} after setup error:`, fsErr));
        }
        // Also, ensure multer's original temp files are cleaned if they weren't moved
        [csvFile, templateFile, photosZipFile].forEach(file => {
            if (file && file.path && fs.existsSync(file.path)) {
                // Check if it's one of the moved paths; if not, it's a raw multer temp file
                const isMoved = [newJob?.server_csv_path, newJob?.server_template_path, newJob?.server_photos_zip_path].includes(file.path);
                if (!isMoved) {
                     fs.unlink(file.path).catch(err => console.error(`Error cleaning up multer temp file ${file.path} after setup error:`, err));
                }
            }
        });

        return res.status(500).json({ message: `Failed to create job due to setup error: ${error.message}` });
    }
};

// Potentially add other controller methods here later:
// exports.getJobStatus = async (req, res) => { ... };
// exports.downloadJobResults = async (req, res) => { ... };

exports.deleteJob = async (req, res, next) => {
    const { jobId } = req.params;

    if (!jobId || isNaN(parseInt(jobId))) {
        return res.status(400).json({ message: 'Valid Job ID is required.' });
    }

    console.log(`Attempting to delete job ID: ${jobId}`);

    try {
        // 1. Fetch job details to get file paths for cleanup
        const job = await db('jobs').where({ id: jobId }).first();

        if (!job) {
            return res.status(404).json({ message: `Job with ID ${jobId} not found.` });
        }

        // 2. Delete job-specific files and directory
        // The main job directory is server/uploads/jobs_data/[jobId]
        const jobDirectoryPath = path.join(getJobUploadsBasePath(), String(jobId));

        if (await fs.pathExists(jobDirectoryPath)) {
            console.log(`Removing directory: ${jobDirectoryPath}`);
            await fs.remove(jobDirectoryPath); // fs-extra's remove is like rm -rf
        } else {
            console.log(`Directory not found, presumed already cleaned or never fully created: ${jobDirectoryPath}`);
        }

        // 3. Delete database records
        // It's good practice to use a transaction here if you want atomicity,
        // though for deletion, if one part fails, the other might still proceed.
        // For simplicity, direct deletes shown.
        // Delete associated id_cards first (due to foreign key constraint if job_id is FK)
        const deletedCardsCount = await db('id_cards').where({ job_id: jobId }).del();
        console.log(`Deleted ${deletedCardsCount} id_card entries for job ${jobId}.`);

        // Then delete the job record
        const deletedJobsCount = await db('jobs').where({ id: jobId }).del();

        if (deletedJobsCount > 0) {
            console.log(`Successfully deleted job ${jobId} from database.`);
            return res.status(200).json({ message: `Job ${jobId} and associated data deleted successfully.` });
        } else {
            // This case might occur if files were deleted but DB record was already gone,
            // or if the job existed for file check but was deleted before this DB operation.
            console.log(`Job ${jobId} was not found in the database for deletion, but file cleanup attempted.`);
            return res.status(404).json({ message: `Job ${jobId} not found in database for deletion, but file cleanup was attempted.` });
        }

    } catch (error) {
        console.error(`Error deleting job ${jobId}:`, error);
        // Avoid sending detailed error messages to client in production for security
        return res.status(500).json({ message: 'An error occurred while trying to delete the job.' });
    }
};

exports.getJobStatus = async (req, res, next) => {
    const { jobId } = req.params;

    if (!jobId || isNaN(parseInt(jobId))) {
        return res.status(400).json({ message: 'Valid Job ID is required.' });
    }

    try {
        const job = await db('jobs')
            .where({ id: jobId })
            .select(
                'id',
                'status',
                'total_cards',
                'processed_cards',
                'created_at',
                'updated_at',
                'completed_at',
                'error_message as job_error_message' // Alias for clarity
            )
            .first();

        if (!job) {
            return res.status(404).json({ message: `Job with ID ${jobId} not found.` });
        }

        // Optionally, fetch details of individual cards for more granular status
        // This can be heavy if there are thousands of cards.
        // Consider pagination or conditional fetching based on a query parameter.
        // For now, let's fetch all for simplicity of the example.
        const cards = await db('id_cards')
            .where({ job_id: jobId })
            .select(
                'id as card_id', // Alias for clarity
                'status as card_status',
                'photo_identifier',
                'output_file_path',
                'error_message as card_error_message',
                'updated_at as card_updated_at'
            )
            .orderBy('id', 'asc'); // Or some other meaningful order

        // Calculate some aggregate stats if needed
        const successfulCards = cards.filter(c => c.card_status === 'completed').length;
        const failedCards = cards.filter(c => c.card_status === 'failed').length;
        const queuedCards = cards.filter(c => c.card_status === 'queued').length;
        const processingCards = cards.filter(c => c.card_status === 'processing').length;


        return res.status(200).json({
            jobId: job.id,
            cards: cards,
            jobStatus: job.status,
            totalCards: job.total_cards,    
            successfullyProcessedCards: job.processed_cards, 
            failedCardsCount: failedCards, // Count from our query
            queuedCardsCount: queuedCards,
            processingCardsCount: processingCards,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            jobErrorMessage: job.job_error_message,
            
        });

    } catch (error) {
        console.error(`Error fetching status for job ${jobId}:`, error);
        next(error); // Pass to global error handler
    }
};

exports.downloadCard = async (req, res, next) => {
    const { cardId } = req.params;

    if (!cardId || isNaN(parseInt(cardId))) {
        return res.status(400).json({ message: 'Valid Card ID is required.' });
    }

    try {
        const card = await db('id_cards')
            .where({ id: cardId })
            .select('status', 'output_file_path', 'photo_identifier') // photo_identifier for filename
            .first();

        if (!card) {
            return res.status(404).json({ message: `Card with ID ${cardId} not found.` });
        }

        if (card.status !== 'completed') {
            return res.status(400).json({ message: `Card ${cardId} is not yet completed. Current status: ${card.status}` });
        }

        if (!card.output_file_path) {
            return res.status(404).json({ message: `Output file path not found for card ${cardId}.` });
        }

        // Check if file exists before attempting to download
        // fs.existsSync is synchronous, for async check use fs.access or fs.stat
        const fs = require('fs-extra'); // Ensure fs-extra is available
        if (!await fs.pathExists(card.output_file_path)) {
             console.error(`File not found at path for card ${cardId}: ${card.output_file_path}`);
             return res.status(404).json({ message: `Generated file for card ${cardId} not found on server.` });
        }
        
        // Suggest a filename for the user's download
        // e.g., card_101_alice.png (from the stored output_file_path basename)
        const filename = path.basename(card.output_file_path);

        // res.download() handles setting Content-Disposition and Content-Type
        res.download(card.output_file_path, filename, (err) => {
            if (err) {
                // Handle error, but headers might have already been sent
                console.error(`Error downloading file for card ${cardId}: ${card.output_file_path}`, err);
                if (!res.headersSent) {
                    // If headers not sent, maybe an issue finding file or permissions
                    // next(err) could be used, or send a specific error if known
                    res.status(500).json({ message: "Error occurred during file download."});
                }
            } else {
                console.log(`Successfully sent file ${filename} for card ${cardId}`);
            }
        });

    } catch (error) {
        console.error(`Error processing download request for card ${cardId}:`, error);
        next(error);
    }
};

exports.downloadJobZip = async (req, res, next) => {
    const { jobId } = req.params;

    try {
        // 1. Fetch the job and check its status
        const job = await db('jobs').where({ id: jobId }).first();
        if (!job) {
            return res.status(404).json({ message: `Job with ID ${jobId} not found.` });
        }

        // Only allow download if the job is finished (or finished with some errors)
        if (job.status !== 'completed' && job.status !== 'completed_with_errors') {
            return res.status(400).json({ message: `Job ${jobId} is not yet complete. Current status: ${job.status}` });
        }

        // 2. Fetch all successfully completed cards for this job
        const completedCards = await db('id_cards')
            .where({ job_id: jobId, status: 'completed' })
            .select('output_file_path');

        if (completedCards.length === 0) {
            return res.status(404).json({ message: `No successfully generated cards found to download for job ${jobId}.` });
        }

        // 3. Use archiver to create and stream a zip file
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // Set the response headers to trigger a file download
        res.attachment(`job_${jobId}_cards.zip`);

        // Good practice: handle errors and warnings from the archiver
        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn('Archiver warning:', err);
            } else {
                throw err;
            }
        });
        archive.on('error', (err) => {
            throw err;
        });

        // Pipe the archive data to the response
        archive.pipe(res);

        // 4. Append each file to the archive
        for (const card of completedCards) {
            if (card.output_file_path && await fs.pathExists(card.output_file_path)) {
                // The first argument is the path to the file on your server.
                // The second argument is an object specifying the file's name inside the zip.
                archive.file(card.output_file_path, { name: path.basename(card.output_file_path) });
            } else {
                 console.warn(`File not found for a completed card, skipping: ${card.output_file_path}`);
            }
        }

        // Finalize the archive (no more files can be appended).
        // This will trigger the 'end' event on the stream and send the response.
        await archive.finalize();

    } catch (error) {
        console.error(`Error generating ZIP for job ${jobId}:`, error);
        // If headers haven't been sent, we can send an error response.
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate ZIP file.' });
        }
    }
};
