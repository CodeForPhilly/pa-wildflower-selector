#!/usr/bin/env node

/**
 * Scrape Color Images from Multiple Sources
 * 
 * For each plant in bw-images-list.txt:
 * 1. Try Wikimedia Commons first
 * 2. If no results, try Wikipedia articles
 * 3. If no results, try iNaturalist
 * 4. Filter results to find color photos (not B&W illustrations/maps)
 * 5. Download the best color photo
 * 6. Validate it's actually color
 * 7. Create full and preview versions
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { RateLimiter } = require('limiter');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ sharp is not installed');
  console.error('   Please install it with: npm install sharp\n');
  process.exit(1);
}

// Configuration
const config = {
  bwImagesList: path.join(__dirname, '../bw-images-list.txt'),
  imagesDir: path.join(__dirname, '../images'),
  // API endpoints
  wikimediaApiUrl: 'https://commons.wikimedia.org/w/api.php',
  wikipediaApiUrl: 'https://en.wikipedia.org/w/api.php',
  inaturalistApiUrl: 'https://api.inaturalist.org/v1',
  // Rate limiting: 1 request per second (be respectful)
  limiter: new RateLimiter({ tokensPerInterval: 1, interval: 'second' }),
  // Image quality settings
  fullImageMaxWidth: 800,
  previewImageWidth: 248,
  jpegQuality: 85,
  // Color detection thresholds (same as find-bw-images.js)
  minSaturation: 0.15, // Must have at least this saturation to be considered color
  minSaturationStdDev: 0.05
};

// Ensure images directory exists
if (!fs.existsSync(config.imagesDir)) {
  fs.mkdirSync(config.imagesDir, { recursive: true });
}

/**
 * Search Wikimedia Commons for images
 */
async function searchWikimediaCommons(plantName) {
  await config.limiter.removeTokens(1);
  
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'search',
    srsearch: plantName,
    srnamespace: 6, // File namespace
    srlimit: 20,
    srprop: 'size|timestamp',
    origin: '*'
  });
  
  try {
    const response = await fetch(`${config.wikimediaApiUrl}?${params}`);
    const data = await response.json();
    
    if (data.query && data.query.search) {
      return data.query.search.map(result => ({
        title: result.title,
        size: result.size,
        timestamp: result.timestamp
      }));
    }
    return [];
  } catch (error) {
    console.error(`   Error searching: ${error.message}`);
    return [];
  }
}

/**
 * Get image info and download URL from Wikimedia Commons
 */
async function getImageInfo(filename) {
  await config.limiter.removeTokens(1);
  
  // Remove "File:" prefix if present
  const cleanFilename = filename.replace(/^File:/, '');
  
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: `File:${cleanFilename}`,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '800', // Get URL for 800px width
    origin: '*'
  });
  
  try {
    const response = await fetch(`${config.wikimediaApiUrl}?${params}`);
    const data = await response.json();
    
    const pages = data.query?.pages;
    if (!pages) return null;
    
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (page.missing || !page.imageinfo || page.imageinfo.length === 0) {
      return null;
    }
    
    const imageInfo = page.imageinfo[0];
    const metadata = imageInfo.extmetadata || {};
    
    // First, check MIME type - only accept actual image files
    const mimeType = imageInfo.mime || '';
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return { skip: true, reason: `Not an image file (${mimeType})` };
    }
    
    // Also check file extension as backup
    const filenameLower = cleanFilename.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const hasImageExtension = imageExtensions.some(ext => filenameLower.endsWith(ext));
    
    if (!hasImageExtension) {
      return { skip: true, reason: 'Not an image file extension' };
    }
    
    // Check if it's likely a photo (not illustration/map/herbarium)
    const description = (metadata.ImageDescription?.value || '').toLowerCase();
    const categories = (metadata.Categories?.value || '').toLowerCase();
    
    // Skip if it's clearly not a photo
    const skipKeywords = [
      'illustration', 'drawing', 'sketch', 'map', 'range map', 
      'distribution map', 'diagram', 'chart', 'graph',
      'herbarium', 'specimen', 'pressed', 'dried', 'sheet',
      'catalog', 'catalogue', 'document', 'scan', 'archive',
      'microscope', 'microscopic', 'cell', 'cross-section',
      // Book/document related
      'book', 'cover', 'jaquette', 'édition', 'edition', 'ouvrage',
      'title page', 'frontispiece', 'page', 'volume', 'vol.',
      'publication', 'monograph', 'treatise',
      'dissertation', 'thesis', 'manuscript', 'text', 'text page',
      'flore', 'flora', 'manual', 'guide', 'atlas',
      // Wood/sample related (not living plant photos)
      'wood', 'wood sample', 'wood cross-section', 'wood grain', 'wood anatomy',
      'tree ring', 'annual ring', 'growth ring', 'timber', 'lumber',
      'section', 'cut', 'sample', 'anatomy', 'anatomical',
      'scale bar', 'scalebar', 'cm scale', 'mm scale',
      'longitudinal', 'transverse', 'radial', 'tangential',
      'xylem', 'phloem', 'bark sample', 'stem cross', 'root cross'
    ];
    
    // Check filename patterns that suggest books/documents or non-plant photos
    const filenamePatterns = [
      /(cover|jaquette|frontispiece)/i,
      /(édition|edition)\s*\d+/i,
      /(volume|vol\.)\s*\d+/i,
      /(page|p\.)\s*\d+/i,
      /(title|titre)\s*(page)?/i,
      /(book|livre|ouvrage)/i,
      // Wood/sample patterns
      /(wood|timber|lumber)\s*(sample|section|cut|anatomy|grain)/i,
      /(cross-section|crosssection|cross_section)/i,
      /(tree\s*ring|annual\s*ring|growth\s*ring)/i,
      /(scale\s*bar|scalebar)/i,
      /(longitudinal|transverse|radial|tangential)\s*(cut|section|view)/i
    ];
    
    const matchesFilenamePattern = filenamePatterns.some(pattern => pattern.test(cleanFilename));
    
    // Check for scale bars combined with specimen indicators (wood samples, cross-sections, etc.)
    // Plant photos might have scale bars too, so only skip if combined with other specimen keywords
    const specimenIndicators = ['wood', 'cross-section', 'sample', 'anatomy', 'section', 'cut', 'specimen', 'grain', 'ring'];
    const hasScaleBar = /\d+\s*(cm|mm|m)\s*(scale|bar)/i.test(description) || /scale\s*bar/i.test(description);
    const hasSpecimenIndicator = specimenIndicators.some(indicator => 
      description.includes(indicator) || filenameLower.includes(indicator)
    );
    const isSpecimenWithScale = hasScaleBar && hasSpecimenIndicator;
    
    const shouldSkip = skipKeywords.some(keyword => 
      description.includes(keyword) || 
      categories.includes(keyword) ||
      filenameLower.includes(keyword)
    ) || matchesFilenamePattern || isSpecimenWithScale;
    
    if (shouldSkip) {
      return { skip: true, reason: 'Not a photo' };
    }
    
    return {
      url: imageInfo.thumburl || imageInfo.url, // Use thumburl if available (800px), otherwise full
      fullUrl: imageInfo.url,
      width: imageInfo.width,
      height: imageInfo.height,
      mime: imageInfo.mime,
      size: imageInfo.size,
      description: metadata.ImageDescription?.value,
      artist: metadata.Artist?.value,
      license: metadata.LicenseShortName?.value,
      licenseUrl: metadata.LicenseUrl?.value
    };
  } catch (error) {
    console.error(`   Error getting image info: ${error.message}`);
    return null;
  }
}

/**
 * Search iNaturalist for plant observations with photos
 */
async function searchiNaturalist(plantName) {
  await config.limiter.removeTokens(1);
  
  try {
    const params = new URLSearchParams({
      taxon_name: plantName,
      photos: 'true',
      quality_grade: 'research,needs_id', // Prefer research-grade observations
      per_page: '20',
      order: 'desc',
      order_by: 'created_at'
    });
    
    const response = await fetch(`${config.inaturalistApiUrl}/observations?${params}`);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results
        .filter(obs => obs.photos && obs.photos.length > 0)
        .map(obs => ({
          id: obs.id,
          photo: obs.photos[0], // Use first photo
          observationUrl: obs.uri,
          user: obs.user?.login || 'Unknown',
          license: obs.license_code || 'Unknown'
        }));
    }
    return [];
  } catch (error) {
    console.error(`   Error searching iNaturalist: ${error.message}`);
    return [];
  }
}

/**
 * Get image URL from iNaturalist photo object
 */
function getiNaturalistImageUrl(photo, size = 'large') {
  // iNaturalist photo sizes: thumb, small, medium, large, original
  // Prefer large (1024px) for quality, fallback to medium
  if (photo.url) {
    // Replace size in URL
    return photo.url.replace(/square|small|medium|large|original/, size);
  }
  return null;
}

/**
 * Download image from URL
 */
async function downloadImage(url, outputPath) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const buffer = await response.buffer();
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    console.error(`   Download error: ${error.message}`);
    return false;
  }
}

/**
 * Analyze image color (same logic as find-bw-images.js)
 */
async function analyzeImageColor(filePath) {
  try {
    const analysisSize = 200;
    const metadata = await sharp(filePath).metadata();
    
    // Verify it's actually an image format that sharp can process
    if (!metadata.format || !['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(metadata.format.toLowerCase())) {
      return { error: `Unsupported image format: ${metadata.format}` };
    }
    
    const resizeWidth = Math.min(metadata.width, analysisSize);
    
    const { data, info } = await sharp(filePath)
      .resize(resizeWidth, null, { withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = data;
    const channels = info.channels;
    const pixelCount = info.width * info.height;
    
    const saturations = [];
    let grayscalePixels = 0;
    
    for (let i = 0; i < pixels.length; i += channels) {
      let r, g, b;
      
      if (channels >= 3) {
        r = pixels[i];
        g = pixels[i + 1];
        b = pixels[i + 2];
      } else {
        r = g = b = pixels[i];
      }
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const saturation = max === 0 ? 0 : delta / max;
      saturations.push(saturation);
      
      if (saturation < 0.1) {
        grayscalePixels++;
      }
    }
    
    const avgSaturation = saturations.reduce((a, b) => a + b, 0) / saturations.length;
    const variance = saturations.reduce((sum, s) => sum + Math.pow(s - avgSaturation, 2), 0) / saturations.length;
    const stdDev = Math.sqrt(variance);
    const grayscaleRatio = grayscalePixels / pixelCount;
    
    return {
      avgSaturation,
      stdDev,
      grayscaleRatio
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Check if image is color (not B&W)
 */
function isColorImage(stats) {
  if (stats.error) return false;
  
  return (
    stats.avgSaturation >= config.minSaturation &&
    stats.stdDev >= config.minSaturationStdDev &&
    stats.grayscaleRatio < 0.85
  );
}

/**
 * Process and save image (create full and preview versions)
 */
async function processImage(tempPath, plantName) {
  try {
    const fullPath = path.join(config.imagesDir, `${plantName}.jpg`);
    const previewPath = path.join(config.imagesDir, `${plantName}.preview.jpg`);
    
    // Create full image (max 800px width)
    await sharp(tempPath)
      .resize(config.fullImageMaxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality: config.jpegQuality, mozjpeg: true })
      .toFile(fullPath);
    
    // Create preview image (248px width, square)
    await sharp(tempPath)
      .resize(config.previewImageWidth, config.previewImageWidth, {
        withoutEnlargement: true,
        fit: 'cover'
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(previewPath);
    
    return true;
  } catch (error) {
    console.error(`   Processing error: ${error.message}`);
    return false;
  }
}

/**
 * Download, validate, and process an image
 */
async function downloadAndValidateImage(imageUrl, plantName, sourceName) {
  // Download to temp file
  const tempPath = path.join(config.imagesDir, `temp_${plantName}.jpg`);
  console.log(`   📥 Downloading from ${sourceName}...`);
  
  const downloaded = await downloadImage(imageUrl, tempPath);
  if (!downloaded) return null;
  
  // Analyze color
  const colorStats = await analyzeImageColor(tempPath);
  if (!isColorImage(colorStats)) {
    console.log(`   ⚠️  Image is not color (sat: ${colorStats.avgSaturation?.toFixed(3)})`);
    fs.unlinkSync(tempPath);
    return null;
  }
  
  // Process and save
  console.log(`   ✅ Found color photo! Processing...`);
  const processed = await processImage(tempPath, plantName);
  fs.unlinkSync(tempPath); // Clean up temp file
  
  if (processed) {
    console.log(`   ✨ Successfully replaced image for ${plantName}`);
    return { 
      success: true, 
      source: sourceName,
      saturation: colorStats.avgSaturation
    };
  }
  
  return null;
}

/**
 * Process Wikimedia result
 */
async function processWikimediaResult(result, plantName) {
  const imageInfo = await getImageInfo(result.title);
  
  if (!imageInfo) return null;
  if (imageInfo.skip) {
    console.log(`   ⏭️  Skipping ${result.title}: ${imageInfo.reason}`);
    return null;
  }
  
  return await downloadAndValidateImage(imageInfo.url, plantName, `Wikimedia: ${result.title}`);
}

/**
 * Process iNaturalist result
 */
async function processiNaturalistResult(result, plantName) {
  const imageUrl = getiNaturalistImageUrl(result.photo, 'large');
  if (!imageUrl) return null;
  
  return await downloadAndValidateImage(imageUrl, plantName, `iNaturalist obs ${result.id}`);
}

/**
 * Search Wikipedia for articles about the plant
 */
async function searchWikipedia(plantName) {
  await config.limiter.removeTokens(1);
  
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'search',
    srsearch: plantName,
    srlimit: 5, // Limit to top 5 results
    origin: '*'
  });
  
  try {
    const response = await fetch(`${config.wikipediaApiUrl}?${params}`);
    const data = await response.json();
    
    if (data.query && data.query.search) {
      return data.query.search.map(result => ({
        title: result.title,
        snippet: result.snippet
      }));
    }
    return [];
  } catch (error) {
    console.error(`   Error searching Wikipedia: ${error.message}`);
    return [];
  }
}

/**
 * Get images from a Wikipedia article
 */
async function getWikipediaImages(articleTitle) {
  await config.limiter.removeTokens(1);
  
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: articleTitle,
    prop: 'images',
    imlimit: 20, // Get up to 20 images from the article
    origin: '*'
  });
  
  try {
    const response = await fetch(`${config.wikipediaApiUrl}?${params}`);
    const data = await response.json();
    
    const pages = data.query?.pages;
    if (!pages) return [];
    
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (page.missing || !page.images) {
      return [];
    }
    
    // Filter to only image files (not SVG, PDF, etc.)
    return page.images
      .filter(img => {
        const filename = img.title.toLowerCase();
        return filename.endsWith('.jpg') || filename.endsWith('.jpeg') || 
               filename.endsWith('.png') || filename.endsWith('.webp');
      })
      .map(img => ({
        title: img.title.replace(/^File:/, ''),
        filename: img.title
      }));
  } catch (error) {
    console.error(`   Error getting Wikipedia images: ${error.message}`);
    return [];
  }
}

/**
 * Process Wikipedia result
 */
async function processWikipediaResult(result, plantName) {
  // Get images from the Wikipedia article
  const images = await getWikipediaImages(result.title);
  
  if (images.length === 0) {
    return null;
  }
  
  // Try each image from the article
  for (const image of images.slice(0, 5)) { // Limit to first 5 images
    // Use the same getImageInfo function from Wikimedia Commons
    // Wikipedia images are stored on Wikimedia Commons
    const imageInfo = await getImageInfo(image.filename);
    
    if (!imageInfo) continue;
    if (imageInfo.skip) {
      console.log(`   ⏭️  Skipping ${image.filename}: ${imageInfo.reason}`);
      continue;
    }
    
    const downloadResult = await downloadAndValidateImage(imageInfo.url, plantName, `Wikipedia: ${image.filename}`);
    if (downloadResult && downloadResult.success) {
      return downloadResult;
    }
  }
  
  return null;
}

/**
 * Process a single plant - tries multiple sources in order
 */
async function processPlant(plantName, index, total) {
  console.log(`\n[${index}/${total}] ${plantName}`);
  
  // Try sources in order: Wikimedia → Wikipedia → iNaturalist
  const sources = [
    { name: 'Wikimedia Commons', search: searchWikimediaCommons, process: processWikimediaResult },
    { name: 'Wikipedia', search: searchWikipedia, process: processWikipediaResult },
    { name: 'iNaturalist', search: searchiNaturalist, process: processiNaturalistResult }
  ];
  
  for (const source of sources) {
    console.log(`   Searching ${source.name}...`);
    const searchResults = await source.search(plantName);
    
    if (searchResults.length === 0) {
      console.log(`   ⚠️  No results found on ${source.name}`);
      continue;
    }
    
    console.log(`   Found ${searchResults.length} results on ${source.name}, checking for color photos...`);
    
    // Try each result until we find a good color photo
    for (const result of searchResults.slice(0, 10)) { // Limit to first 10 results
      const imageResult = await source.process(result, plantName);
      
      if (imageResult && imageResult.success) {
        return imageResult;
      }
    }
  }
  
  console.log('   ❌ No suitable color photos found from any source');
  return { success: false, reason: 'No color photos found' };
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Multi-Source Plant Image Scraper');
  console.log('  (Wikimedia Commons → Wikipedia → iNaturalist)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Read list of plants to process
  if (!fs.existsSync(config.bwImagesList)) {
    console.error(`❌ File not found: ${config.bwImagesList}`);
    console.error('   Run scripts/find-bw-images.js first to generate the list\n');
    process.exit(1);
  }
  
  const plantNames = fs.readFileSync(config.bwImagesList, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace('.jpg', '')); // Remove .jpg extension
  
  console.log(`📋 Found ${plantNames.length} plants to process\n`);
  console.log('⚠️  This will take a while (rate limited to 1 request/second)');
  console.log('   Estimated time: ~' + Math.ceil(plantNames.length / 60) + ' minutes\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  for (let i = 0; i < plantNames.length; i++) {
    const plantName = plantNames[i];
    const result = await processPlant(plantName, i + 1, plantNames.length);
    
    if (result.success) {
      results.success.push({ plantName, ...result });
    } else {
      results.failed.push({ plantName, reason: result.reason });
    }
    
    // Small delay between plants to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ Successfully replaced: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.success.length > 0) {
    console.log('\n📄 Successfully replaced images:');
    results.success.slice(0, 10).forEach(r => {
      console.log(`   - ${r.plantName} (from ${r.source})`);
    });
    if (results.success.length > 10) {
      console.log(`   ... and ${results.success.length - 10} more`);
    }
  }
  
  // Save results to file
  const resultsFile = path.join(__dirname, '../scrape-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Full results saved to: ${resultsFile}\n`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

