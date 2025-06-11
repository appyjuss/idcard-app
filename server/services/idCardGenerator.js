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
    console.log(`[IDCardGenerator] generateIdCard FUNCTION CALLED for cardId: ${cardRecord ? cardRecord.id : 'UNKNOWN'}, jobId: ${jobRecord ? jobRecord.id : 'UNKNOWN'}`);

    // Parameter validation (as before)
    if (!cardRecord || !jobRecord || !jobSpecificOutputBasePath) { /* ... */ throw new Error("Missing params"); }
    if (!jobRecord.server_template_path) { /* ... */ throw new Error("Missing template path"); }
    // ... other checks ...

    let svgTemplateContent;
    try {
        svgTemplateContent = await fs.readFile(jobRecord.server_template_path, 'utf-8');
        console.log(`[IDCardGenerator] SVG template ${jobRecord.server_template_path} read successfully.`);
    } catch (error) { /* ... */ throw error; }

    // Determine Photo Path (as before)
    let studentPhotoPath = null;
    // ... (your existing photo path logic) ...
    if (cardRecord.photo_identifier && jobRecord.server_photos_unzip_path) {
        const primaryPhotoPath = path.join(jobRecord.server_photos_unzip_path, cardRecord.photo_identifier);
        if (await fs.pathExists(primaryPhotoPath) && (await fs.lstat(primaryPhotoPath)).isFile()) {
            studentPhotoPath = primaryPhotoPath;
        } else {
            const fallbackPhotoPath = path.join(path.dirname(jobRecord.server_photos_unzip_path), 'cropped_photos', cardRecord.photo_identifier);
            if (await fs.pathExists(fallbackPhotoPath) && (await fs.lstat(fallbackPhotoPath)).isFile()) {
                studentPhotoPath = fallbackPhotoPath;
                console.log(`[IDCardGenerator] Using fallback photo: ${studentPhotoPath}`);
            } else { console.warn(`[IDCardGenerator] Photo not found for cardId ${cardRecord.id}`); }
        }
    } else { console.log(`[IDCardGenerator] No photo_identifier or path for cardId ${cardRecord.id}`); }


    if (studentPhotoPath) {
        console.log(`[IDCardGenerator] Determined photo path for cardId ${cardRecord.id}: ${studentPhotoPath}`);
        try {
            const preProcParseErrors = [];
            const parser = new DOMParser({ // CORRECTED instantiation
                onError: (level, msg) => {
                    console.log(`[@xmldom/idCardGenerator/DOMParser-PreProc] ${level}: ${msg.trim()}`);
                    if (level === 'error' || level === 'fatalError') {
                        preProcParseErrors.push({ level, msg: msg.trim() });
                    }
                }
            });
            const tempDoc = parser.parseFromString(svgTemplateContent, 'image/svg+xml');
            
            if (preProcParseErrors.length > 0) {
                console.warn(`[@xmldom/idCardGenerator] DOMParser (for pre-proc) encountered ${preProcParseErrors.length} issues (see logs above).`);
                // Check for fatal errors specifically if needed
            }
            const parseErrorElements = tempDoc ? tempDoc.getElementsByTagName('parsererror') : [];
            if (parseErrorElements.length > 0) {
                console.warn(`[IDCardGenerator] DOMParser (for pre-proc) found <parsererror> elements:`, 
                    parseErrorElements[0]?.textContent.trim());
            }

            const placeholderDim = getPlaceholderRectDetailsFromDOM(tempDoc, 'photo-placeholder'); 

            if (placeholderDim && typeof placeholderDim.width === 'number' && typeof placeholderDim.height === 'number') {
                console.log(`[IDCardGenerator] Placeholder dimensions for pre-processing photo: w=${placeholderDim.width}, h=${placeholderDim.height}`);
                studentPhotoPath = await preprocessPhoto(studentPhotoPath, placeholderDim.width, placeholderDim.height);
                // preprocessPhoto now returns null if photo doesn't exist, or original path on error
                if (!studentPhotoPath) { // If preprocessPhoto determined photo is unusable
                     console.warn(`[IDCardGenerator] Photo path became null after preprocessPhoto for cardId ${cardRecord.id}. Proceeding without photo.`);
                } else {
                    console.log(`[IDCardGenerator] Photo preprocessed, path: ${studentPhotoPath}`);
                }
            } else {
                console.warn(`[IDCardGenerator] Could not get valid placeholder dimensions for photo pre-processing (cardId ${cardRecord.id}). Found:`, placeholderDim);
            }
        } catch (e) {
            console.error(`[IDCardGenerator] Error during placeholder dimension retrieval or photo pre-processing (cardId ${cardRecord.id}):`, e);
        }
    }

    // Prepare output file path (as before)
    const photoBasename = studentPhotoPath // Use studentPhotoPath as it might be the processed one
        ? path.basename(studentPhotoPath, path.extname(studentPhotoPath))
        : 'no_photo';
    const baseOutputFileName = `card_${cardRecord.id}_${photoBasename.replace(/^processed_/, '')}`;
    // ... (rest of output path logic)
    const finalOutputFileName = `${baseOutputFileName}.${outputFormat.toLowerCase()}`;
    const outputFilePath = path.join(jobSpecificOutputBasePath, finalOutputFileName);
    console.log(`[IDCardGenerator] Output path set to: ${outputFilePath}`);
    await fs.ensureDir(jobSpecificOutputBasePath);


    // Process SVG (as before)
    const dataForText = { ...(cardRecord.card_data || {}) };
    let processedSvgString;
    try {
        console.log(`[IDCardGenerator] Calling svgProcessorService.processSvgWithEmbeddedImage for cardId ${cardRecord.id}. Photo path: ${studentPhotoPath}`);
        processedSvgString = await processSvgWithEmbeddedImage(svgTemplateContent, dataForText, studentPhotoPath);
        
        const debugSvgPath = path.join(jobSpecificOutputBasePath, `debug_processed_${baseOutputFileName}.svg`);
        await fs.writeFile(debugSvgPath, processedSvgString);
        console.log(`[IDCardGenerator] Saved debug processed SVG to: ${debugSvgPath}`);
    } catch (error) { /* ... */ throw error; }

    // Save or Rasterize (as before)
    try {
        if (outputFormat.toLowerCase() === 'svg') { /* ... */ }
        else { /* ... */ }
    } catch (error) { /* ... */ throw error; }

    return outputFilePath;
}

module.exports = { generateIdCard };
console.log("[idCardGenerator] Module loaded successfully. generateIdCard type:", typeof generateIdCard);