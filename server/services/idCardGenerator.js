// server/services/idCardGenerator.js
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

const {
    processSvgWithEmbeddedImage,
    preprocessPhoto,
    getPlaceholderRectDetailsFromDOM
} = require('./svgProcessorService');

const { DOMParser } = require('@xmldom/xmldom');

console.log("[idCardGenerator] Attempting to load...");
console.log("[idCardGenerator] Modules required. svgProcessorService exports check:",
    typeof processSvgWithEmbeddedImage,
    typeof preprocessPhoto,
    typeof getPlaceholderRectDetailsFromDOM
);

async function generateIdCard(cardRecord, jobRecord, jobSpecificOutputBasePath, outputFormat = 'png') {
    // Add a log at the very start of the function execution
    console.log(`[IDCardGenerator C${cardRecord ? cardRecord.id : 'UNKNOWN'}] generateIdCard FUNCTION CALLED. JobId: ${jobRecord ? jobRecord.id : 'UNKNOWN'}, OutputFormat: ${outputFormat}`);

    if (!cardRecord || !jobRecord || !jobSpecificOutputBasePath) {
        console.error("[IDCardGenerator] CRITICAL: Missing required parameters (cardRecord, jobRecord, or jobSpecificOutputBasePath).");
        throw new Error("Missing required parameters for ID card generation.");
    }
    if (!jobRecord.server_template_path) {
         console.error(`[IDCardGenerator C${cardRecord.id}] CRITICAL: jobRecord.server_template_path is missing.`);
         throw new Error("jobRecord.server_template_path is missing.");
    }
    if (cardRecord.photo_identifier && !jobRecord.server_photos_unzip_path) {
        console.warn(`[IDCardGenerator C${cardRecord.id}] WARNING: cardRecord.photo_identifier exists but jobRecord.server_photos_unzip_path is missing. Cannot locate photo.`);
    }

    // 1. Read SVG Template file content
    let svgTemplateContent;
    try {
        svgTemplateContent = await fs.readFile(jobRecord.server_template_path, 'utf-8');
        console.log(`[IDCardGenerator C${cardRecord.id}] SVG template ${jobRecord.server_template_path} read successfully.`);
    } catch (error) {
        console.error(`[IDCardGenerator C${cardRecord.id}] Error reading SVG template ${jobRecord.server_template_path}:`, error);
        throw new Error(`Failed to read SVG template for card ${cardRecord.id}: ${error.message}`);
    }

    // 2. Determine Photo Path
    let studentPhotoPath = null;
    if (cardRecord.photo_identifier && jobRecord.server_photos_unzip_path) {
        const primaryPhotoPath = path.join(jobRecord.server_photos_unzip_path, cardRecord.photo_identifier);
        if (await fs.pathExists(primaryPhotoPath) && (await fs.lstat(primaryPhotoPath)).isFile()) {
            studentPhotoPath = primaryPhotoPath;
        } else {
            const fallbackPhotoPath = path.join(path.dirname(jobRecord.server_photos_unzip_path), 'cropped_photos', cardRecord.photo_identifier);
            if (await fs.pathExists(fallbackPhotoPath) && (await fs.lstat(fallbackPhotoPath)).isFile()) {
                studentPhotoPath = fallbackPhotoPath;
                console.log(`[IDCardGenerator C${cardRecord.id}] Using fallback photo: ${studentPhotoPath}`);
            } else {
                console.warn(`[IDCardGenerator C${cardRecord.id}] Photo not found. Primary: ${primaryPhotoPath}, Fallback: ${fallbackPhotoPath}`);
                // studentPhotoPath remains null
            }
        }
    } else if (cardRecord.photo_identifier && !jobRecord.server_photos_unzip_path) {
        console.warn(`[IDCardGenerator C${cardRecord.id}] photo_identifier present but server_photos_unzip_path missing. Cannot process photo.`);
    } else {
        console.log(`[IDCardGenerator C${cardRecord.id}] No photo_identifier or required paths. Proceeding without photo.`);
        // studentPhotoPath remains null
    }

    if (studentPhotoPath) {
        console.log(`[IDCardGenerator C${cardRecord.id}] Determined photo path: ${studentPhotoPath}`);
        try {
            const preProcParseErrors = [];
            const parser = new DOMParser({
                onError: (level, msg) => {
                    console.log(`[@xmldom/idCardGenerator/DOMParser-PreProc C${cardRecord.id}] ${level}: ${msg.trim()}`);
                    if (level === 'error' || level === 'fatalError') {
                        preProcParseErrors.push({ level, msg: msg.trim() });
                    }
                }
            });
            const tempDoc = parser.parseFromString(svgTemplateContent, 'image/svg+xml');

            if (preProcParseErrors.length > 0) {
                console.warn(`[@xmldom/idCardGenerator C${cardRecord.id}] DOMParser (pre-proc) encountered ${preProcParseErrors.length} issues.`);
            }
            const parseErrorElements = tempDoc ? tempDoc.getElementsByTagName('parsererror') : [];
            if (parseErrorElements.length > 0) {
                console.warn(`[IDCardGenerator C${cardRecord.id}] DOMParser (pre-proc) found <parsererror> elements:`,
                    parseErrorElements[0]?.textContent.trim());
            }

            const placeholderDim = getPlaceholderRectDetailsFromDOM(tempDoc, 'photo-placeholder');

            if (placeholderDim && typeof placeholderDim.width === 'number' && typeof placeholderDim.height === 'number') {
                console.log(`[IDCardGenerator C${cardRecord.id}] Placeholder dims for pre-proc: w=${placeholderDim.width}, h=${placeholderDim.height}`);
                const processedPath = await preprocessPhoto(studentPhotoPath, placeholderDim.width, placeholderDim.height);
                if (processedPath !== studentPhotoPath && processedPath !== null) {
                     console.log(`[IDCardGenerator C${cardRecord.id}] Photo preprocessed, new path: ${processedPath}`);
                     studentPhotoPath = processedPath; // Update to the processed path
                } else if (processedPath === null) {
                    console.warn(`[IDCardGenerator C${cardRecord.id}] preprocessPhoto returned null. Will proceed without photo or with original if it failed.`);
                    studentPhotoPath = null; // Ensure it's null if preprocessing failed to produce a usable path
                } else {
                    console.log(`[IDCardGenerator C${cardRecord.id}] Photo not preprocessed (or preprocess failed and returned original). Path: ${studentPhotoPath}`);
                }
            } else {
                console.warn(`[IDCardGenerator C${cardRecord.id}] Could not get valid placeholder dimensions for photo pre-processing. Found:`, placeholderDim, `. Using original photo if available.`);
            }
        } catch (e) {
            console.error(`[IDCardGenerator C${cardRecord.id}] Error during photo pre-processing stage:`, e);
            // Depending on severity, you might nullify studentPhotoPath or re-throw
            // For now, let's allow proceeding with potentially unprocessed photo if path still exists
        }
    }

    // 3. Prepare output file path
    const photoBasenamePart = studentPhotoPath
        ? path.basename(studentPhotoPath, path.extname(studentPhotoPath))
        : 'no_photo';
    // Clean "processed_" prefix from the basename part if it exists
    const finalPhotoBasename = photoBasenamePart.replace(/^processed_/, '');
    const baseOutputFileName = `card_${cardRecord.id}_${finalPhotoBasename}`;
    const finalOutputFileNameWithExt = `${baseOutputFileName}.${outputFormat.toLowerCase()}`;
    const outputFilePath = path.join(jobSpecificOutputBasePath, finalOutputFileNameWithExt);

    console.log(`[IDCardGenerator C${cardRecord.id}] Final Output path set to: ${outputFilePath}`);
    try {
        await fs.ensureDir(jobSpecificOutputBasePath);
    } catch (dirError) {
        console.error(`[IDCardGenerator C${cardRecord.id}] Error creating output directory ${jobSpecificOutputBasePath}:`, dirError);
        throw dirError;
    }


    // 4. Process SVG: Inject text and embed Base64 photo using svgProcessorService
    const dataForText = { ...(cardRecord.card_data || {}) };
    // Add any other direct fields from cardRecord if your template uses them:
    // dataForText.employee_id_from_record = cardRecord.employee_id;

    let processedSvgString;
    try {
        console.log(`[IDCardGenerator C${cardRecord.id}] Calling svgProcessorService.processSvgWithEmbeddedImage. Photo path for embedding: ${studentPhotoPath}`);
        processedSvgString = await processSvgWithEmbeddedImage(svgTemplateContent, dataForText, studentPhotoPath); // studentPhotoPath might be null

        const debugSvgPath = path.join(jobSpecificOutputBasePath, `debug_processed_${baseOutputFileName}.svg`);
        await fs.writeFile(debugSvgPath, processedSvgString);
        console.log(`[IDCardGenerator C${cardRecord.id}] Saved debug processed SVG to: ${debugSvgPath}`);
    } catch (error) {
        console.error(`[IDCardGenerator C${cardRecord.id}] Error from svgProcessorService.processSvgWithEmbeddedImage:`, error);
        throw error;
    }

    // 5. Save or Rasterize the processed SVG
    console.log(`[IDCardGenerator C${cardRecord.id}] Preparing to save/rasterize. Output format: ${outputFormat}, Output path: ${outputFilePath}`);
    try {
        const targetFormat = outputFormat.toLowerCase();
        console.log(`[IDCardGenerator C${cardRecord.id}] Target format determined as: ${targetFormat}`);

        if (targetFormat === 'svg') {
            console.log(`[IDCardGenerator C${cardRecord.id}] Saving as SVG directly.`);
            await fs.writeFile(outputFilePath, processedSvgString);
            console.log(`[IDCardGenerator C${cardRecord.id}] Successfully wrote SVG file: ${outputFilePath}`);
        } else if (['png', 'jpeg', 'jpg', 'webp', 'tiff', 'gif'].includes(targetFormat)) { // Check against known Sharp formats
            console.log(`[IDCardGenerator C${cardRecord.id}] Attempting to rasterize to ${targetFormat.toUpperCase()}.`);

            if (!processedSvgString || processedSvgString.trim() === '') {
                console.error(`[IDCardGenerator C${cardRecord.id}] CRITICAL: processedSvgString is empty before Sharp. Cannot rasterize.`);
                throw new Error(`Processed SVG string is empty for card ${cardRecord.id}.`);
            }
            // Check if the sharp instance has the method for the target format
            const sharpInstance = sharp(Buffer.from(processedSvgString), { density: 300 });
            if (typeof sharpInstance[targetFormat] !== 'function') {
                console.error(`[IDCardGenerator C${cardRecord.id}] Sharp does not support format function: .${targetFormat}()`);
                throw new Error(`Sharp does not support format function .${targetFormat}() for card ${cardRecord.id}`);
            }

            console.log(`[IDCardGenerator C${cardRecord.id}] Calling sharp().${targetFormat}().toFile(). SVG length: ${processedSvgString.length}`);
            
            await sharpInstance[targetFormat]().toFile(outputFilePath);
            
            console.log(`[IDCardGenerator C${cardRecord.id}] sharp.toFile() promise resolved for ${outputFilePath}.`);

            if (await fs.pathExists(outputFilePath) && (await fs.lstat(outputFilePath)).isFile()) {
                console.log(`[IDCardGenerator C${cardRecord.id}] CONFIRMED: Rasterized file ${outputFilePath} exists.`);
            } else {
                console.error(`[IDCardGenerator C${cardRecord.id}] RASTERIZATION FAILED: File ${outputFilePath} NOT FOUND after sharp operation reported success.`);
                throw new Error(`Rasterized file ${outputFilePath} not created for card ${cardRecord.id}. Sharp might have failed silently or permissions issue.`);
            }
        } else {
            console.error(`[IDCardGenerator C${cardRecord.id}] Unhandled outputFormat: '${outputFormat}'. Cannot save or rasterize.`);
            throw new Error(`Unhandled outputFormat '${outputFormat}' for card ${cardRecord.id}.`);
        }
    } catch (error) {
        console.error(`[IDCardGenerator C${cardRecord.id}] Error during final save or rasterization step:`, error);
        throw new Error(`Failed to save or rasterize output for card ${cardRecord.id} (format: ${outputFormat}): ${error.message}`);
    }

    console.log(`[IDCardGenerator C${cardRecord.id}] Successfully generated and saved output: ${outputFilePath}`);
    return outputFilePath;
}

module.exports = { generateIdCard };
console.log("[idCardGenerator] Module loaded successfully. generateIdCard type:", typeof generateIdCard);