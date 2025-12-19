#!/usr/bin/env node

/**
 * Analyze Image Quality
 * Identifies images that are:
 * - Black and white / grayscale (low color saturation)
 * - Cell/microscope images (unusual patterns)
 * - Low quality or problematic images
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ sharp is not installed');
  console.error('   Please install it with: npm install sharp\n');
  process.exit(1);
}

const imagesDir = path.join(__dirname, '../images');

// Configuration
const config = {
  // Thresholds for detection
  grayscaleThreshold: 0.15, // If color variance is below this, consider it grayscale
  lowSaturationThreshold: 0.20, // If average saturation is below this, flag it
  cellImageThreshold: 0.3, // Threshold for detecting cell/microscope images
};

/**
 * Calculate color saturation and variance
 * Returns metrics about the image's colorfulness
 */
async function analyzeColorQuality(filePath) {
  try {
    // Sample pixels to calculate saturation
    // Get a smaller version for faster processing
    const { data, info } = await sharp(filePath)
      .resize(200, null, { withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = data;
    const channels = info.channels;
    const width = info.width;
    const height = info.height;
    
    let rSum = 0, gSum = 0, bSum = 0;
    let varianceSum = 0;
    let saturationSum = 0;
    
    // Sample every 10th pixel for performance
    for (let i = 0; i < pixels.length; i += channels * 10) {
      if (channels >= 3) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        rSum += r;
        gSum += g;
        bSum += b;
        
        // Calculate variance between channels (indicator of colorfulness)
        const avg = (r + g + b) / 3;
        const variance = Math.sqrt(
          ((r - avg) ** 2 + (g - avg) ** 2 + (b - avg) ** 2) / 3
        ) / 255; // Normalize to 0-1
        
        varianceSum += variance;
        
        // Calculate saturation (how far from gray)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        saturationSum += saturation;
        
        pixelCount++;
      }
    }
    
    const avgVariance = varianceSum / pixelCount;
    const avgSaturation = saturationSum / pixelCount;
    
    // Check if image is mostly grayscale
    const isGrayscale = avgVariance < config.grayscaleThreshold;
    const isLowSaturation = avgSaturation < config.lowSaturationThreshold;
    
    // Calculate average brightness
    const avgBrightness = (rSum + gSum + bSum) / (pixelCount * 3 * 255);
    
    // Detect cell/microscope images
    // These often have:
    // - High contrast between adjacent pixels
    // - Regular patterns
    // - Specific color distributions
    let edgeVariance = 0;
    let edgeCount = 0;
    
    // Sample edge detection (check adjacent pixel differences)
    for (let y = 1; y < height - 1; y += 5) {
      for (let x = 1; x < width - 1; x += 5) {
        const idx = (y * width + x) * channels;
        if (idx + channels * 2 < pixels.length) {
          const r1 = pixels[idx];
          const g1 = pixels[idx + 1];
          const b1 = pixels[idx + 2];
          
          const r2 = pixels[idx + channels];
          const g2 = pixels[idx + channels + 1];
          const b2 = pixels[idx + channels + 2];
          
          const diff = Math.sqrt(
            (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
          ) / (255 * Math.sqrt(3));
          
          edgeVariance += diff;
          edgeCount++;
        }
      }
    }
    
    const avgEdgeVariance = edgeVariance / edgeCount;
    
    // Cell images often have high edge variance and specific patterns
    // Also check if image has unusual aspect ratio or very high detail
    const metadata = await sharp(filePath).metadata();
    const aspectRatio = metadata.width / metadata.height;
    const isTall = aspectRatio < 0.5 || aspectRatio > 2.0;
    
    // Cell images might have very high detail (many edges) but low overall color
    const mightBeCellImage = avgEdgeVariance > config.cellImageThreshold && 
                            (isLowSaturation || isGrayscale) &&
                            metadata.width > 500; // Usually high resolution
    
    return {
      isGrayscale,
      isLowSaturation,
      mightBeCellImage,
      avgVariance,
      avgSaturation,
      avgBrightness,
      avgEdgeVariance,
      aspectRatio,
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function analyzeImages() {
  if (!fs.existsSync(imagesDir)) {
    console.error(`❌ Images directory not found: ${imagesDir}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(imagesDir);
  // Only analyze full images, not previews
  const imageFiles = files.filter(f => 
    /\.jpg$/i.test(f) && !f.includes('.preview.')
  );
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Image Quality Analysis');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Analyzing ${imageFiles.length} images...\n`);
  console.log('This may take a while. Analyzing color saturation and patterns...\n');
  
  const results = {
    grayscale: [],
    lowSaturation: [],
    cellImages: [],
    errors: []
  };
  
  let processed = 0;
  const total = imageFiles.length;
  
  for (const file of imageFiles) {
    processed++;
    const filePath = path.join(imagesDir, file);
    const progress = `[${processed}/${total}]`;
    
    process.stdout.write(`${progress} ${file}... `);
    
    const analysis = await analyzeColorQuality(filePath);
    
    if (analysis.error) {
      console.log(`❌ Error: ${analysis.error}`);
      results.errors.push({ file, error: analysis.error });
    } else {
      const issues = [];
      
      if (analysis.isGrayscale) {
        issues.push('grayscale');
        results.grayscale.push({
          file,
          variance: analysis.avgVariance.toFixed(3),
          saturation: analysis.avgSaturation.toFixed(3)
        });
      }
      
      if (analysis.isLowSaturation && !analysis.isGrayscale) {
        issues.push('low-saturation');
        results.lowSaturation.push({
          file,
          saturation: analysis.avgSaturation.toFixed(3),
          variance: analysis.avgVariance.toFixed(3)
        });
      }
      
      if (analysis.mightBeCellImage) {
        issues.push('cell-image');
        results.cellImages.push({
          file,
          saturation: analysis.avgSaturation.toFixed(3),
          edgeVariance: analysis.avgEdgeVariance.toFixed(3),
          dimensions: `${analysis.width}x${analysis.height}`
        });
      }
      
      if (issues.length > 0) {
        console.log(`⚠️  ${issues.join(', ')}`);
      } else {
        console.log('✅ OK');
      }
    }
  }
  
  // Generate reports
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  Analysis Results');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`📊 Summary:`);
  console.log(`   Total analyzed: ${total}`);
  console.log(`   Grayscale images: ${results.grayscale.length}`);
  console.log(`   Low saturation images: ${results.lowSaturation.length}`);
  console.log(`   Possible cell/microscope images: ${results.cellImages.length}`);
  console.log(`   Errors: ${results.errors.length}\n`);
  
  // Save results to files
  const outputDir = path.join(__dirname, '../image-analysis-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save grayscale images list
  if (results.grayscale.length > 0) {
    const grayscaleFile = path.join(outputDir, 'grayscale-images.json');
    fs.writeFileSync(grayscaleFile, JSON.stringify(results.grayscale, null, 2));
    console.log(`📄 Grayscale images list saved to: ${grayscaleFile}`);
    console.log(`   First 10: ${results.grayscale.slice(0, 10).map(r => r.file).join(', ')}`);
  }
  
  // Save low saturation images list
  if (results.lowSaturation.length > 0) {
    const lowSatFile = path.join(outputDir, 'low-saturation-images.json');
    fs.writeFileSync(lowSatFile, JSON.stringify(results.lowSaturation, null, 2));
    console.log(`📄 Low saturation images list saved to: ${lowSatFile}`);
    console.log(`   First 10: ${results.lowSaturation.slice(0, 10).map(r => r.file).join(', ')}`);
  }
  
  // Save cell images list
  if (results.cellImages.length > 0) {
    const cellFile = path.join(outputDir, 'cell-images.json');
    fs.writeFileSync(cellFile, JSON.stringify(results.cellImages, null, 2));
    console.log(`📄 Cell/microscope images list saved to: ${cellFile}`);
    console.log(`   First 10: ${results.cellImages.slice(0, 10).map(r => r.file).join(', ')}`);
  }
  
  // Create combined list for rescraping
  const allProblematic = [
    ...results.grayscale.map(r => r.file),
    ...results.lowSaturation.map(r => r.file),
    ...results.cellImages.map(r => r.file)
  ];
  
  // Remove duplicates
  const uniqueProblems = [...new Set(allProblematic)];
  
  if (uniqueProblems.length > 0) {
    const combinedFile = path.join(outputDir, 'all-problematic-images.json');
    fs.writeFileSync(combinedFile, JSON.stringify(uniqueProblems, null, 2));
    console.log(`\n📄 Combined list of all problematic images: ${combinedFile}`);
    console.log(`   Total unique problematic images: ${uniqueProblems.length}`);
    
    // Also create a simple text file with just filenames
    const textFile = path.join(outputDir, 'problematic-images.txt');
    fs.writeFileSync(textFile, uniqueProblems.join('\n'));
    console.log(`📄 Text file with just filenames: ${textFile}`);
  }
  
  if (results.errors.length > 0) {
    const errorFile = path.join(outputDir, 'errors.json');
    fs.writeFileSync(errorFile, JSON.stringify(results.errors, null, 2));
    console.log(`\n⚠️  Errors saved to: ${errorFile}`);
  }
  
  console.log('\n✅ Analysis complete!\n');
}

analyzeImages().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

