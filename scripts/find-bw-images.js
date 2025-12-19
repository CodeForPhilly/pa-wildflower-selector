#!/usr/bin/env node

/**
 * Find Black & White or Low-Color Images
 * Identifies images that are likely grayscale, black & white, or have very low color saturation
 * These should be replaced with vibrant color photos
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

// Configuration
const imagesDir = path.join(__dirname, '../images');
const outputFile = path.join(__dirname, '../bw-images-report.json');

// Thresholds for detection
const thresholds = {
  // Average saturation below this = likely B&W
  minSaturation: 0.1, // 0-1 scale, 0.1 = very low color
  // Standard deviation of saturation below this = mostly grayscale
  minSaturationStdDev: 0.05,
  // If more than this % of pixels are essentially grayscale, flag it
  grayscalePixelThreshold: 0.85,
  // For low-color images (herbarium sheets, old documents)
  lowColorSaturation: 0.2, // Lower threshold for "low color" category
  // Herbarium sheets: mostly white/light backgrounds
  whiteBackgroundThreshold: 0.6, // If >60% of pixels are very light, likely herbarium
  whitePixelBrightness: 200, // Pixels brighter than this are considered "white"
  // Very uniform/boring images (solid colors, abstract)
  lowBrightnessVariance: 20, // If brightness variance is very low, image is too uniform
  // Sepia/old document detection
  sepiaSaturationRange: [0.05, 0.15] // Sepia images have low but not zero saturation
};

/**
 * Calculate color saturation statistics from an image
 */
async function analyzeImageColor(filePath) {
  try {
    // Get image metadata
    const metadata = await sharp(filePath).metadata();
    
    // Resize to a manageable size for analysis (faster processing)
    const analysisSize = 200; // Analyze at 200px width max
    const resizeWidth = Math.min(metadata.width, analysisSize);
    
    // Extract raw pixel data
    const { data, info } = await sharp(filePath)
      .resize(resizeWidth, null, { withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = data;
    const channels = info.channels;
    const pixelCount = info.width * info.height;
    
    // Calculate saturation for each pixel
    const saturations = [];
    let grayscalePixels = 0;
    
    for (let i = 0; i < pixels.length; i += channels) {
      let r, g, b;
      
      if (channels >= 3) {
        r = pixels[i];
        g = pixels[i + 1];
        b = pixels[i + 2];
      } else {
        // Grayscale image
        r = g = b = pixels[i];
      }
      
      // Convert RGB to HSV to get saturation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      
      // Saturation calculation (0-1 scale)
      const saturation = max === 0 ? 0 : delta / max;
      saturations.push(saturation);
      
      // Check if pixel is essentially grayscale (very low saturation)
      if (saturation < 0.1) {
        grayscalePixels++;
      }
    }
    
    // Calculate statistics
    const avgSaturation = saturations.reduce((a, b) => a + b, 0) / saturations.length;
    const variance = saturations.reduce((sum, s) => sum + Math.pow(s - avgSaturation, 2), 0) / saturations.length;
    const stdDev = Math.sqrt(variance);
    const grayscaleRatio = grayscalePixels / pixelCount;
    
    // Calculate brightness statistics (for detecting very dark, very light, or uniform images)
    const brightnesses = [];
    let whitePixels = 0;
    let veryLightPixels = 0;
    
    for (let i = 0; i < pixels.length; i += channels) {
      const r = channels >= 3 ? pixels[i] : pixels[i];
      const g = channels >= 3 ? pixels[i + 1] : pixels[i];
      const b = channels >= 3 ? pixels[i + 2] : pixels[i];
      const brightness = (r + g + b) / 3;
      brightnesses.push(brightness);
      
      // Count white/very light pixels (herbarium sheets have lots of white)
      if (brightness > thresholds.whitePixelBrightness) {
        whitePixels++;
      }
      if (brightness > 220) {
        veryLightPixels++;
      }
    }
    
    const avgBrightness = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
    const brightnessVariance = brightnesses.reduce((sum, b) => sum + Math.pow(b - avgBrightness, 2), 0) / brightnesses.length;
    const brightnessStdDev = Math.sqrt(brightnessVariance);
    const whiteBackgroundRatio = whitePixels / pixelCount;
    const veryLightRatio = veryLightPixels / pixelCount;
    
    // Calculate color diversity (how many distinct colors)
    const colorMap = new Map();
    for (let i = 0; i < pixels.length; i += channels) {
      const r = channels >= 3 ? pixels[i] : pixels[i];
      const g = channels >= 3 ? pixels[i + 1] : pixels[i];
      const b = channels >= 3 ? pixels[i + 2] : pixels[i];
      // Quantize to reduce memory (group similar colors)
      const quantized = `${Math.floor(r/16)*16},${Math.floor(g/16)*16},${Math.floor(b/16)*16}`;
      colorMap.set(quantized, (colorMap.get(quantized) || 0) + 1);
    }
    const uniqueColors = colorMap.size;
    const colorDiversity = uniqueColors / pixelCount; // Lower = less diverse
    
    return {
      avgSaturation,
      stdDev,
      grayscaleRatio,
      avgBrightness,
      brightnessStdDev,
      whiteBackgroundRatio,
      veryLightRatio,
      colorDiversity,
      uniqueColors,
      pixelCount
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Determine if an image is likely B&W, low-color, herbarium sheet, or poor quality
 */
function isBlackAndWhite(stats) {
  if (stats.error) return false;
  
  // Check multiple criteria
  const checks = {
    // Classic B&W detection
    lowSaturation: stats.avgSaturation < thresholds.minSaturation,
    lowSaturationVariance: stats.stdDev < thresholds.minSaturationStdDev,
    mostlyGrayscale: stats.grayscaleRatio > thresholds.grayscalePixelThreshold,
    
    // Herbarium sheet detection (mostly white background with muted plants)
    mostlyWhiteBackground: stats.whiteBackgroundRatio > thresholds.whiteBackgroundThreshold,
    veryLightImage: stats.veryLightRatio > 0.5, // More than 50% very light pixels
    
    // Uniform/boring image detection (solid colors, abstract images)
    lowBrightnessVariance: stats.brightnessStdDev < thresholds.lowBrightnessVariance,
    lowColorDiversity: stats.colorDiversity < 0.01, // Very few distinct colors
    
    // Sepia/old document detection (low but not zero saturation)
    sepiaTone: stats.avgSaturation >= thresholds.sepiaSaturationRange[0] && 
               stats.avgSaturation <= thresholds.sepiaSaturationRange[1] &&
               stats.stdDev < 0.08,
    
    // Document/catalog page detection: moderate saturation but very low color diversity
    // These are old documents, catalog pages, etc. that have some color but aren't vibrant photos
    // More restrictive: require BOTH uniform background AND significant white areas (documents have both)
    // Also require low saturation variance (documents are uniformly colored, not vibrant photos with blurred backgrounds)
    documentLike: stats.colorDiversity < 0.006 && // Very low color diversity (more restrictive)
                  stats.avgSaturation >= 0.15 && // Some color (not pure B&W)
                  stats.avgSaturation < 0.30 && // More restrictive upper bound (documents are less vibrant)
                  stats.uniqueColors < 300 && // Fewer unique colors (more restrictive)
                  stats.whiteBackgroundRatio > 0.20 && // Has significant white background (documents have paper)
                  stats.brightnessStdDev < 40 && // AND very uniform brightness (typical of documents)
                  stats.stdDev < 0.07 // Low saturation variance (documents are uniformly colored, not vibrant photos)
  };
  
  // Count how many criteria are met
  const criteriaMet = Object.values(checks).filter(Boolean).length;
  
  // More aggressive: if 2+ criteria met, or specific problematic patterns
  const isBW = criteriaMet >= 2 || 
               checks.mostlyWhiteBackground || // Herbarium sheets
               (checks.lowBrightnessVariance && checks.lowColorDiversity) || // Uniform/abstract
               checks.sepiaTone || // Old documents
               checks.documentLike; // Document/catalog pages (moderate color but low diversity)
  
  return {
    isBW,
    checks,
    criteriaMet,
    stats
  };
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
  console.log('  Analyzing Images for Black & White Detection');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📁 Analyzing ${imageFiles.length} images...\n`);
  
  const results = {
    blackAndWhite: [],
    lowColor: [],
    normal: [],
    errors: []
  };
  
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const filePath = path.join(imagesDir, file);
    const progress = `[${i + 1}/${imageFiles.length}]`;
    
    process.stdout.write(`${progress} ${file}... `);
    
    const stats = await analyzeImageColor(filePath);
    
    if (stats.error) {
      console.log(`❌ Error: ${stats.error}`);
      results.errors.push({ file, error: stats.error });
    } else {
      const analysis = isBlackAndWhite(stats);
      
      if (analysis.isBW) {
        // Determine reason for flagging
        let reason = 'B&W';
        if (analysis.checks.mostlyWhiteBackground || analysis.checks.veryLightImage) {
          reason = 'Herbarium/White Background';
        } else if (analysis.checks.documentLike) {
          reason = 'Document/Catalog Page';
        } else if (analysis.checks.lowBrightnessVariance && analysis.checks.lowColorDiversity) {
          reason = 'Uniform/Abstract';
        } else if (analysis.checks.sepiaTone) {
          reason = 'Sepia/Old Document';
        } else if (stats.avgSaturation < thresholds.minSaturation) {
          reason = 'Low Saturation';
        }
        
        console.log(`⚠️  ${reason} (sat: ${stats.avgSaturation.toFixed(3)}, white: ${(stats.whiteBackgroundRatio * 100).toFixed(1)}%, diversity: ${stats.uniqueColors})`);
        results.blackAndWhite.push({
          file,
          reason,
          ...analysis
        });
      } else if (stats.avgSaturation < thresholds.lowColorSaturation) {
        // Only flag as "low color" if saturation is very low OR if it's low with low variance
        // (low variance = uniformly low color, not just a blurred background)
        // Images with good saturation variance have vibrant subject matter even if average is lower
        const isTrulyLowColor = stats.avgSaturation < 0.12 || // Very low saturation regardless
                                (stats.avgSaturation < thresholds.lowColorSaturation && 
                                 stats.stdDev < 0.06 && // Low variance = uniformly low color
                                 !analysis.checks.lowBrightnessVariance); // Not just a uniform abstract image
        
        if (isTrulyLowColor) {
          console.log(`⚠️  Low Color (sat: ${stats.avgSaturation.toFixed(3)})`);
          results.lowColor.push({
            file,
            ...analysis
          });
        } else {
          // Has good saturation variance, so it's a vibrant photo with blurred background
          console.log(`✅ Color (sat: ${stats.avgSaturation.toFixed(3)}, variance: ${stats.stdDev.toFixed(3)})`);
          results.normal.push({ file, stats });
        }
      } else {
        console.log(`✅ Color (sat: ${stats.avgSaturation.toFixed(3)})`);
        results.normal.push({ file, stats });
      }
    }
  }
  
  // Save results
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  // Print summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  Analysis Complete');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`📊 Summary:`);
  console.log(`   ✅ Normal color images: ${results.normal.length}`);
  console.log(`   ⚠️  Black & White images: ${results.blackAndWhite.length}`);
  console.log(`   ⚠️  Low color images: ${results.lowColor.length}`);
  console.log(`   ❌ Errors: ${results.errors.length}`);
  
  const totalProblematic = results.blackAndWhite.length + results.lowColor.length;
  if (totalProblematic > 0) {
    console.log(`\n⚠️  Total images needing replacement: ${totalProblematic}`);
    console.log(`\n📄 Detailed report saved to: ${outputFile}`);
    
    // Show sample of problematic images grouped by reason
    console.log(`\n📋 Sample of problematic images (first 20):`);
    const problematic = [...results.blackAndWhite, ...results.lowColor].slice(0, 20);
    problematic.forEach((item, i) => {
      const type = results.blackAndWhite.includes(item) ? (item.reason || 'B&W') : 'Low Color';
      console.log(`   ${i + 1}. ${item.file} (${type})`);
    });
    
    // Group by reason
    const byReason = {};
    results.blackAndWhite.forEach(item => {
      const reason = item.reason || 'B&W';
      if (!byReason[reason]) byReason[reason] = [];
      byReason[reason].push(item.file);
    });
    
    if (Object.keys(byReason).length > 0) {
      console.log(`\n📊 Breakdown by type:`);
      Object.entries(byReason).forEach(([reason, files]) => {
        console.log(`   ${reason}: ${files.length} images`);
      });
    }
    
    // Generate a simple list file
    const listFile = path.join(__dirname, '../bw-images-list.txt');
    const allProblematic = [
      ...results.blackAndWhite.map(r => r.file),
      ...results.lowColor.map(r => r.file)
    ];
    fs.writeFileSync(listFile, allProblematic.join('\n'));
    console.log(`\n📝 Simple list saved to: ${listFile}`);
  } else {
    console.log(`\n✨ All images appear to be color photos!`);
  }
  
  console.log('\n');
}

analyzeImages().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

