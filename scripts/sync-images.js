#!/usr/bin/env node

/**
 * Sync Images from Linode Object Storage
 * Downloads images from Linode Object Storage to local images directory
 * Cross-platform Node.js version (works on Windows, macOS, Linux)
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

// Load environment variables
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  LINODE_BUCKET_NAME,
  LINODE_ENDPOINT_URL = 'https://us-east-1.linodeobjects.com'
} = process.env;

// Check required environment variables
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !LINODE_BUCKET_NAME) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, LINODE_BUCKET_NAME');
  console.error('   Please check your .env file\n');
  process.exit(1);
}

// Use appropriate images directory
// In Docker: /app/images, locally: ./images
const isDockerMode = fs.existsSync('/app');
const imagesDir = isDockerMode ? '/app/images' : path.join(__dirname, '../images');

console.log('\n📥 Syncing Images from Linode Object Storage\n');
console.log(`Mode: ${isDockerMode ? 'Docker' : 'Local'}`);
console.log(`Linode Bucket: ${LINODE_BUCKET_NAME}`);
console.log(`Images Directory: ${imagesDir}\n`);

async function syncImages() {
  try {
    // Create images directory if it doesn't exist
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`📁 Created images directory: ${imagesDir}\n`);
    }

    // Sync images from Linode bucket
    console.log('🔄 Syncing images from Linode Object Storage...');
    const syncCommand = `aws s3 sync s3://${LINODE_BUCKET_NAME}/images/ "${imagesDir}/" --endpoint-url ${LINODE_ENDPOINT_URL}`;
    
    try {
      execSync(syncCommand, {
        stdio: 'inherit',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY
        }
      });
      console.log(`\n✅ Images have been downloaded to ${imagesDir}/`);
      console.log('===== Images Sync Process Completed =====\n');
    } catch (error) {
      console.error('\n❌ Failed to sync images');
      console.error(`   Error: ${error.message}\n`);
      console.error('💡 Make sure AWS CLI is installed and configured:');
      console.error('   - Install: https://aws.amazon.com/cli/');
      console.error('   - Or use: brew install awscli (macOS)');
      console.error('   - Or use: choco install awscli (Windows)\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Sync failed');
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
}

syncImages();








