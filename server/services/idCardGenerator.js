// server/services/idCardGenerator.js
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const xmlJs = require('xml-js');

/**
 * Finds a rectangle element within an SVG group designated as a photo placeholder.
 * @param {object} svgJsObject - The SVG structure parsed by xml-js.
 * @param {string} placeholderGroupId - The ID of the group element containing the placeholder rect.
 * @returns {object|null} An object with {x, y, width, height} or null if not found.
 */
function findPlaceholderRectDetails(svgJsObject, placeholderGroupId = 'photo-placeholder') {
    let photoGroupNode;

    // Recursive helper to find an element by its ID
    function findElementById(element, id) {
        if (!element) return null;
        // Check current element's attributes
        if (element._attributes && element._attributes.id === id) {
            return element;
        }
        // Iterate over child elements (keys that are not _attributes, _text, etc.)
        for (const key in element) {
            if (key.startsWith('_')) continue; // Skip internal xml-js keys like _attributes

            const children = Array.isArray(element[key]) ? element[key] : [element[key]];
            for (const child of children) {
                if (typeof child === 'object' && child !== null) {
                    const found = findElementById(child, id);
                    if (found) return found;
                }
            }
        }
        return null;
    }

    if (svgJsObject.svg) { // Start search from the root <svg> element
        photoGroupNode = findElementById(svgJsObject.svg, placeholderGroupId);
    }

    if (photoGroupNode && photoGroupNode.rect) {
        // Assuming the first <rect> inside the group is the placeholder
        const rectNode = Array.isArray(photoGroupNode.rect) ? photoGroupNode.rect[0] : photoGroupNode.rect;
        if (rectNode && rectNode._attributes) {
            const attrs = rectNode._attributes;
            // Important: Ensure these attributes exist and are numbers.
            // SVG units are typically unitless pixels for x, y, width, height.
            const x = parseFloat(attrs.x);
            const y = parseFloat(attrs.y);
            const width = parseFloat(attrs.width);
            const height = parseFloat(attrs.height);

            if (![x, y, width, height].every(val => !isNaN(val))) {
                 console.error("Invalid or missing x, y, width, or height attributes on placeholder rect:", attrs);
                 return null;
            }
            return { x, y, width, height };
        }
    }
    console.warn(`Placeholder rect not found within group ID '${placeholderGroupId}'`);
    return null;
}


/**
 * Generates an ID card image.
 * @param {object} cardRecord - The ID card record from the database.
 * @param {object} jobRecord - The job record from the database (contains paths to template, photos).
 * @param {string} jobSpecificOutputBasePath - The base path where generated cards for this job should be saved.
 * @returns {Promise<string>} The full path to the generated ID card image.
 */
async function generateIdCard(cardRecord, jobRecord, jobSpecificOutputBasePath) {
    // 1. Read SVG Template file content
    const svgTemplateContent = await fs.readFile(jobRecord.server_template_path, 'utf-8');

    // 2. Replace text placeholders in SVG content
    //    Data for replacement comes from cardRecord.card_data and potentially direct fields on cardRecord
    let populatedSvgContent = svgTemplateContent;
    const dataForReplacement = {
        ...(cardRecord.card_data || {}), // Data from JSONB column
        // Add any direct fields from cardRecord if your template uses them
        // e.g., name: cardRecord.name (if 'name' is a direct column on id_cards)
    };
    // Ensure all expected placeholders in your SVG (like {{name}}, {{student_id}}, etc.)
    // have corresponding keys in `dataForReplacement`.
    // Example: If 'student_id' is a top-level column in your id_cards table,
    // you might need to add `student_id: cardRecord.student_id` to dataForReplacement.
    // For the provided SVG, it seems 'name' is a direct placeholder. Let's assume 'name' is in card_data.

    for (const [key, value] of Object.entries(dataForReplacement)) {
        const placeholder = `{{${key}}}`; // Simpler placeholder format {{key}}
        const replacementValue = (value === null || value === undefined) ? '' : String(value);
        populatedSvgContent = populatedSvgContent.split(placeholder).join(replacementValue); // Global replace
    }
     // If you have a specific format like {{ student_id }} (with spaces), adjust the regex:
     // populatedSvgContent = populatedSvgContent.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));


    // 3. Parse SVG to find photo placeholder dimensions
    const svgJs = xmlJs.xml2js(svgTemplateContent, { compact: true }); // Parse original for stable geometry
    const placeholderDetails = findPlaceholderRectDetails(svgJs, 'photo-placeholder');

    if (!placeholderDetails) {
        throw new Error('Failed to find photo placeholder details in SVG template.');
    }

    // 4. Load and prepare the student's photo
    const studentPhotoPath = path.join(jobRecord.server_photos_unzip_path, cardRecord.photo_identifier);
    if (!await fs.pathExists(studentPhotoPath)) {
        console.warn(`[IDCardGenerator] Photo not found for card ${cardRecord.id}: ${studentPhotoPath}. Card will be generated without photo.`);
        // Set studentPhotoBuffer to null or handle differently if photo is mandatory
        // For now, we'll proceed and the composite step will be skipped if no photoBuffer.
    }

    let resizedPhotoBuffer;
    if (await fs.pathExists(studentPhotoPath)) {
        const studentPhotoBuffer = await fs.readFile(studentPhotoPath);
        resizedPhotoBuffer = await sharp(studentPhotoBuffer)
            .resize({
                width: Math.round(placeholderDetails.width),
                height: Math.round(placeholderDetails.height),
                fit: sharp.fit.cover, // 'cover' will fill dimensions, cropping if necessary
                                      // 'contain' will fit inside, possibly leaving empty space
                position: sharp.strategy.attention // Tries to focus on the most "interesting" part
            })
            .png() // Convert to PNG buffer for compositing (or match desired output)
            .toBuffer();
    }


    // 5. Composite the photo onto the (text-populated) SVG and convert to final image format (e.g., PNG)
    const svgBufferForSharp = Buffer.from(populatedSvgContent);
    let sharpInstance = sharp(svgBufferForSharp, {
        density: 300 // Increase DPI for better quality of SVG rendering, default is 72
    });

    if (resizedPhotoBuffer) {
        sharpInstance = sharpInstance.composite([{
            input: resizedPhotoBuffer,
            top: Math.round(placeholderDetails.y),
            left: Math.round(placeholderDetails.x),
        }]);
    }

    const finalImageBuffer = await sharpInstance.png().toBuffer(); // Output as PNG

    // 6. Save the generated image
    await fs.ensureDir(jobSpecificOutputBasePath); // Ensure output directory exists
    const outputFileName = `card_${cardRecord.id}_${path.basename(cardRecord.photo_identifier, path.extname(cardRecord.photo_identifier))}.png`;
    const outputFilePath = path.join(jobSpecificOutputBasePath, outputFileName);
    await fs.writeFile(outputFilePath, finalImageBuffer);

    console.log(`[IDCardGenerator] Generated card: ${outputFilePath}`);
    return outputFilePath;
}

module.exports = { generateIdCard };