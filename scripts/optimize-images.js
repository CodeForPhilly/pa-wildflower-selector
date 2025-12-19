#!/usr/bin/env node

/**
 * Optimize Image Sizes
 * Reduces image dimensions and file sizes for better web performance
 * - Full plant images: max 800px width (from 1140px)
 * - Person photos: max 600px width (from 3600px+)
 * - Preview images: left as-is (already optimized)
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
const config = {
  // Full plant images: reduce to 800px max width
  plantImages: {
    dir: path.join(__dirname, '../images'),
    maxWidth: 800,
    quality: 85, // Good balance of quality and file size
    filter: (filename) => {
      // Only process full images, not previews
      return /\.jpg$/i.test(filename) && !filename.includes('.preview.');
    }
  },
  // Person photos: reduce to 600px max width
  personPhotos: {
    dir: path.join(__dirname, '../public/assets/images'),
    maxWidth: 600,
    quality: 85,
    filter: (filename) => {
      // Only process person photos (jpg files that are likely photos)
      const personPhotos = [
        'charles-leahan.jpg',
        'kio-p.jpg',
        'ella-heron.jpg',
        'cristina-zanoni.jpg',
        'zach-leahan.jpg',
        'anthony-hopkins.jpg',
        'anne-marie-lloyd.jpg',
        'roxanne-g.jpg',
        'tom-boutell.jpg'
      ];
      return personPhotos.includes(filename.toLowerCase());
    }
  }
};

async function optimizeImage(filePath, maxWidth, quality) {
  try {
    const metadata = await sharp(filePath).metadata();
    
    // Skip if already smaller than max width
    if (metadata.width <= maxWidth) {
      return { 
        skipped: true, 
        reason: `Already ${metadata.width}px (max: ${maxWidth}px)` 
      };
    }
    
    const originalSize = fs.statSync(filePath).size;
    
    // Resize and optimize
    await sharp(filePath)
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ 
        quality: quality,
        mozjpeg: true // Better compression
      })
      .toFile(filePath + '.tmp');
    
    // Replace original with optimized version
    fs.renameSync(filePath + '.tmp', filePath);
    
    const newSize = fs.statSync(filePath).size;
    const savings = originalSize - newSize;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
    
    return {
      skipped: false,
      originalSize,
      newSize,
      savings,
      savingsPercent,
      originalWidth: metadata.width,
      newWidth: maxWidth
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function optimizeDirectory(config) {
  const { dir, maxWidth, quality, filter } = config;
  
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return null;
  }
  
  const files = fs.readdirSync(dir);
  const imageFiles = files.filter(filter);
  
  if (imageFiles.length === 0) {
    console.log(`ℹ️  No images to optimize in ${dir}`);
    return null;
  }
  
  console.log(`\n📁 Processing ${imageFiles.length} images in ${path.basename(dir)}`);
  console.log(`   Target: max ${maxWidth}px width, ${quality}% quality\n`);
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const filePath = path.join(dir, file);
    const progress = `[${i + 1}/${imageFiles.length}]`;
    
    process.stdout.write(`${progress} ${file}... `);
    
    const result = await optimizeImage(filePath, maxWidth, quality);
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
      errors++;
    } else if (result.skipped) {
      console.log(`⏭️  ${result.reason}`);
      skipped++;
    } else {
      const sizeInfo = `${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} (${result.savingsPercent}% saved)`;
      console.log(`✅ ${sizeInfo}`);
      processed++;
      totalOriginalSize += result.originalSize;
      totalNewSize += result.newSize;
    }
  }
  
  const totalSavings = totalOriginalSize - totalNewSize;
  const totalSavingsPercent = totalOriginalSize > 0 
    ? ((totalSavings / totalOriginalSize) * 100).toFixed(1) 
    : 0;
  
  console.log(`\n📊 Summary:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  if (processed > 0) {
    console.log(`   Total savings: ${formatBytes(totalSavings)} (${totalSavingsPercent}%)`);
  }
  
  return {
    processed,
    skipped,
    errors,
    totalSavings,
    totalSavingsPercent
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Image Optimization Script');
  console.log('═══════════════════════════════════════════════════════════');
  
  const results = {
    plantImages: null,
    personPhotos: null
  };
  
  // Optimize plant images
  console.log('\n🌿 Optimizing Plant Images');
  console.log('───────────────────────────────────────────────────────────');
  results.plantImages = await optimizeDirectory(config.plantImages);
  
  // Optimize person photos
  console.log('\n👤 Optimizing Person Photos');
  console.log('───────────────────────────────────────────────────────────');
  results.personPhotos = await optimizeDirectory(config.personPhotos);
  
  // Final summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  Optimization Complete');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let totalProcessed = 0;
  let totalSavings = 0;
  
  if (results.plantImages) {
    totalProcessed += results.plantImages.processed;
    totalSavings += results.plantImages.totalSavings || 0;
    console.log(`🌿 Plant Images: ${results.plantImages.processed} optimized, ${formatBytes(results.plantImages.totalSavings || 0)} saved`);
  }
  
  if (results.personPhotos) {
    totalProcessed += results.personPhotos.processed;
    totalSavings += results.personPhotos.totalSavings || 0;
    console.log(`👤 Person Photos: ${results.personPhotos.processed} optimized, ${formatBytes(results.personPhotos.totalSavings || 0)} saved`);
  }
  
  console.log(`\n✨ Total: ${totalProcessed} images optimized, ${formatBytes(totalSavings)} saved`);
  console.log('\n💡 Next steps:');
  console.log('   - Test the website to ensure images look good');
  console.log('   - If deploying, sync optimized images to Linode: npm run sync:up:images');
  console.log('\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});



