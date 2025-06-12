// server/services/svgProcessorService.js
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

async function preprocessPhoto(photoPath, targetWidth, targetHeight) {
    // ... (no changes to this function's core logic, keep as is) ...
    if (!photoPath || !(await fs.pathExists(photoPath))) {
        console.warn(`[@xmldom/SVGProcessor] PreprocessPhoto: Photo path invalid or file does not exist: ${photoPath}`);
        return null;
    }
    if (isNaN(targetWidth) || isNaN(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
        console.warn(`[@xmldom/SVGProcessor] PreprocessPhoto: Invalid target dimensions (${targetWidth}x${targetHeight}). Skipping resize, using original photo.`);
        return photoPath;
    }
    try {
        const processedBuffer = await sharp(photoPath)
            .resize({
                width: Math.round(targetWidth),
                height: Math.round(targetHeight),
                fit: sharp.fit.cover,
                position: sharp.strategy.attention
            })
            .png()
            .toBuffer();
        const tempDir = path.join(path.dirname(photoPath), 'temp_processed_photos');
        await fs.ensureDir(tempDir);
        const originalExt = path.extname(photoPath);
        const baseName = path.basename(photoPath, originalExt);
        const tempPhotoPath = path.join(tempDir, `processed_${baseName}.png`);
        await fs.writeFile(tempPhotoPath, processedBuffer);
        console.log(`[@xmldom/SVGProcessor] Preprocessed photo saved to ${tempPhotoPath}`);
        return tempPhotoPath;
    } catch (error) {
        console.error(`[@xmldom/SVGProcessor] Error preprocessing photo ${photoPath}:`, error);
        return photoPath;
    }
}

function getPlaceholderRectDetailsFromDOM(doc, placeholderGroupId = 'photo-placeholder') {
    // ... (no changes to this function's core logic, keep as is from your last working version of this func) ...
    if (!doc || typeof doc.getElementById !== 'function') {
        console.warn(`[@xmldom/SVGProcessor] Invalid DOM document provided to getPlaceholderRectDetailsFromDOM.`);
        return null;
    }
    const placeholderGroup = doc.getElementById(placeholderGroupId);
    if (!placeholderGroup) {
        return null;
    }
    let placeholderRect = null;
    if (placeholderGroup.childNodes && placeholderGroup.childNodes.length > 0) {
        for (let i = 0; i < placeholderGroup.childNodes.length; i++) {
            if (placeholderGroup.childNodes[i].nodeType === 1 && placeholderGroup.childNodes[i].nodeName === 'rect') {
                placeholderRect = placeholderGroup.childNodes[i];
                break;
            }
        }
    }
    if (!placeholderRect) {
        console.warn(`[@xmldom/SVGProcessor] No <rect> element found within placeholder group '${placeholderGroupId}'.`);
        return null;
    }
    try {
        const xStr = placeholderRect.getAttribute('x');
        const yStr = placeholderRect.getAttribute('y');
        const widthStr = placeholderRect.getAttribute('width');
        const heightStr = placeholderRect.getAttribute('height');
        const x = parseFloat(xStr);
        const y = parseFloat(yStr);
        const width = parseFloat(widthStr);
        const height = parseFloat(heightStr);
        if ([x, y, width, height].some(isNaN)) {
            console.warn(`[@xmldom/SVGProcessor] Invalid or missing geometric attributes for placeholder rect in group '${placeholderGroupId}'. Attrs: x='${xStr}', y='${yStr}', width='${widthStr}', height='${heightStr}'.`);
            return null;
        }
        const originalAttributes = {};
        if (placeholderRect.attributes) {
            for (let i = 0; i < placeholderRect.attributes.length; i++) {
                const attr = placeholderRect.attributes[i];
                originalAttributes[attr.name] = attr.value;
            }
        }
        return { x, y, width, height, originalAttributes };
    } catch (e) {
        console.error(`[@xmldom/SVGProcessor] Error parsing placeholder rect attributes for group '${placeholderGroupId}':`, e);
        return null;
    }
}

async function processSvgWithEmbeddedImage(svgTemplateContent, dataForText, photoPath) {
    const errors = [];
    const parser = new DOMParser({ // CORRECTED instantiation
        onError: (level, msg) => {
            console.log(`[@xmldom/SVGProcessor/DOMParser-Main] ${level}: ${msg.trim()}`); // Added trim()
            if (level === 'error' || level === 'fatalError') {
                errors.push({ level, msg: msg.trim() }); // Added trim()
            }
        }
    });
    const serializer = new XMLSerializer();
    let doc;

    try {
        doc = parser.parseFromString(svgTemplateContent, 'image/svg+xml');
        if (errors.length > 0) {
            console.warn(`[@xmldom/SVGProcessor] DOMParser encountered ${errors.length} issues during main parsing (see logs above).`);
            const fatalErrors = errors.filter(e => e.level === 'fatalError');
            if (fatalErrors.length > 0) {
                throw new Error(`SVG template parsing failed with fatal errors: ${fatalErrors.map(e => e.msg).join('; ')}`);
            }
        }
        const parseErrorElements = doc.getElementsByTagName('parsererror');
        if (parseErrorElements.length > 0) {
            console.warn("[@xmldom/SVGProcessor] SVG parsing (main) resulted in <parsererror> elements:", parseErrorElements[0].textContent.trim());
        }
    } catch (e) {
        console.error("[@xmldom/SVGProcessor] Critical error parsing SVG template content (main):", e);
        throw new Error(`SVG template parsing failed (main): ${e.message}`);
    }
    
    if (!doc || !doc.documentElement) {
        throw new Error("SVG document or documentElement is null after main parsing. Template might be invalid.");
    }
    const svgElement = doc.documentElement;

    // 1. Text Replacement (keep your existing logic for this)
    // ... (ensure this part is correct as per your previous working version)
    const textElements = svgElement.getElementsByTagName('text');
    for (let i = 0; i < textElements.length; i++) {
        const textNode = textElements[i];
        let targetTextContentNode = textNode;
        const tspans = textNode.getElementsByTagName('tspan');
        if (tspans.length > 0) {
            targetTextContentNode = tspans[0];
        }
        if (targetTextContentNode.textContent) {
            let currentText = targetTextContentNode.textContent;
            for (const [key, value] of Object.entries(dataForText)) {
                const placeholder = `{{${key}}}`;
                const replacementValue = (value === null || typeof value === 'undefined') ? '' : String(value);
                currentText = currentText.split(placeholder).join(replacementValue);
            }
            targetTextContentNode.textContent = currentText;
        }
    }
    console.log("[@xmldom/SVGProcessor] Text replacement phase completed.");

    // 2. Photo Injection (keep your existing logic for this)
    // ... (ensure this part is correct as per your previous working version)
    if (photoPath && await fs.pathExists(photoPath) && (await fs.lstat(photoPath)).isFile()) {
        const placeholderDetails = getPlaceholderRectDetailsFromDOM(doc, 'photo-placeholder');
        if (placeholderDetails) {
            const photoGroupElement = doc.getElementById('photo-placeholder');
            if (photoGroupElement) {
                const imageBuffer = await fs.readFile(photoPath);
                const base64Image = imageBuffer.toString('base64');
                const ext = path.extname(photoPath).toLowerCase();
                let mimeType = 'image/png';
                if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                const photoDataUrl = `data:${mimeType};base64,${base64Image}`;
                while (photoGroupElement.firstChild) {
                    photoGroupElement.removeChild(photoGroupElement.firstChild);
                }
                const svgNS = 'http://www.w3.org/2000/svg';
                const imageElement = doc.createElementNS(svgNS, 'image');
                imageElement.setAttributeNS(null, 'href', photoDataUrl);
                imageElement.setAttributeNS(null, 'x', String(placeholderDetails.x));
                imageElement.setAttributeNS(null, 'y', String(placeholderDetails.y));
                imageElement.setAttributeNS(null, 'width', String(placeholderDetails.width));
                imageElement.setAttributeNS(null, 'height', String(placeholderDetails.height));
                imageElement.setAttributeNS(null, 'preserveAspectRatio', 'xMidYMid slice');
                const originalRectAttrs = placeholderDetails.originalAttributes;
                const bgRect = doc.createElementNS(svgNS, 'rect');
                bgRect.setAttributeNS(null, 'x', String(placeholderDetails.x));
                bgRect.setAttributeNS(null, 'y', String(placeholderDetails.y));
                bgRect.setAttributeNS(null, 'width', String(placeholderDetails.width));
                bgRect.setAttributeNS(null, 'height', String(placeholderDetails.height));
                bgRect.setAttributeNS(null, 'fill', originalRectAttrs.fill || 'white');
                photoGroupElement.appendChild(bgRect);
                photoGroupElement.appendChild(imageElement);
                const borderRect = doc.createElementNS(svgNS, 'rect');
                borderRect.setAttributeNS(null, 'x', String(placeholderDetails.x));
                borderRect.setAttributeNS(null, 'y', String(placeholderDetails.y));
                borderRect.setAttributeNS(null, 'width', String(placeholderDetails.width));
                borderRect.setAttributeNS(null, 'height', String(placeholderDetails.height));
                borderRect.setAttributeNS(null, 'fill', 'none');
                borderRect.setAttributeNS(null, 'stroke', originalRectAttrs.stroke || 'black');
                if (originalRectAttrs['stroke-width']) {
                     borderRect.setAttributeNS(null, 'stroke-width', originalRectAttrs['stroke-width']);
                } else if (originalRectAttrs.stroke) {
                     borderRect.setAttributeNS(null, 'stroke-width', '1');
                }
                photoGroupElement.appendChild(borderRect);
                photoGroupElement.setAttributeNS(null, 'id', 'photo');
                console.log("[@xmldom/SVGProcessor] Photo injected and placeholder group ID updated.");
            } else { console.warn("[@xmldom/SVGProcessor] Photo placeholder group 'photo-placeholder' not found for modification."); }
        } else { console.warn('[@xmldom/SVGProcessor] Photo placeholder details could not be retrieved. Photo not embedded.'); }
    } else { /* ... logging for no photo ... */ }
    
    const finalSvgString = serializer.serializeToString(doc);
    console.log(`[@xmldom/SVGProcessor] Final SVG string length: ${finalSvgString.length}`);
    return finalSvgString;
}

module.exports = { 
    processSvgWithEmbeddedImage, 
    preprocessPhoto, 
    getPlaceholderRectDetailsFromDOM 
};

console.log("[svgProcessorService using @xmldom/xmldom] Module loaded. Exports:", 
    typeof processSvgWithEmbeddedImage, 
    typeof preprocessPhoto, 
    typeof getPlaceholderRectDetailsFromDOM
);