// server/routes/jobRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path'); // For joining paths
const fs = require('fs'); // For ensuring directory exists
const jobController = require('../controllers/jobController');

const router = express.Router();

// Ensure the base uploads directory exists
const baseUploadsPath = path.join(__dirname, '..', 'uploads'); // Get absolute path to server/uploads
if (!fs.existsSync(baseUploadsPath)) {
    fs.mkdirSync(baseUploadsPath, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Temporarily store all uploads in the base 'uploads/' directory.
        // We will move them to job-specific folders in the controller.
        cb(null, baseUploadsPath);
    },
    filename: function (req, file, cb) {
        // Use a unique name to avoid collisions in the temp folder.
        // fieldname-timestamp-originalname
        cb(null, `${file.fieldname}-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
    }
});

/**input validation testing */
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "csvFile") {
            if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type for CSV. Only .csv allowed.'), false);
            }
        } else if (file.fieldname === "templateFile") {
            if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type for Template. Only .svg allowed.'), false);
            }
        } else if (file.fieldname === "photosZip") {
            if (['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.zip')) {
                // 'application/octet-stream' is sometimes used for zip files
                cb(null, true);
            } else {
                cb(new Error('Invalid file type for Photos. Only .zip allowed.'), false);
            }
        } else {
            // Should not happen if fieldnames are correct
            cb(new Error('Unexpected file field.'), false);
        }
    },
    limits: {
        fileSize: 1024 * 1024 * 50 // 50MB limit per file (adjust as needed for large photo zips)
    }
});

// Route for creating a new job by uploading CSV, SVG template, and Photos ZIP
router.post('/',
    upload.fields([
        { name: 'csvFile', maxCount: 1 },
        { name: 'templateFile', maxCount: 1 },
        { name: 'photosZip', maxCount: 1 }
    ]),
    jobController.createJob // Controller will handle moving files and further processing
);

router.delete('/:jobId', jobController.deleteJob); // New route for deleting a job
router.get('/:jobId/status', jobController.getJobStatus);
router.get('/cards/:cardId/download', jobController.downloadCard);
// router.get('/:jobId/status', jobController.getJobStatus);

module.exports = router;