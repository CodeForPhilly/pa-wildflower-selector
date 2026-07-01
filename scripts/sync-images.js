#!/usr/bin/env node

/**
 * Sync Images from Linode Object Storage
 * Downloads images from Linode Object Storage to local images directory
 * Cross-platform Node.js version (works on Windows, macOS, Linux)
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

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

    const endpoint = new URL(LINODE_ENDPOINT_URL);
    const regionMatch = endpoint.hostname.match(/^([a-z0-9-]+)\.linodeobjects\.com$/);
    const s3 = new S3Client({
      endpoint: LINODE_ENDPOINT_URL,
      region: regionMatch ? regionMatch[1] : (process.env.AWS_DEFAULT_REGION || 'us-east-1'),
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
      }
    });

    // Sync images from Linode bucket
    console.log('🔄 Syncing images from Linode Object Storage...');

    let continuationToken;
    let downloaded = 0;
    let skipped = 0;

    do {
      const page = await s3.send(new ListObjectsV2Command({
        Bucket: LINODE_BUCKET_NAME,
        Prefix: 'images/',
        ContinuationToken: continuationToken
      }));

      for (const object of page.Contents || []) {
        if (!object.Key || object.Key.endsWith('/')) {
          continue;
        }

        const relativePath = object.Key.slice('images/'.length);
        const localPath = path.resolve(imagesDir, relativePath);
        const imagesRoot = path.resolve(imagesDir) + path.sep;

        if (!localPath.startsWith(imagesRoot)) {
          throw new Error(`Unsafe object key: ${object.Key}`);
        }

        const existing = await fs.promises.stat(localPath).catch(() => null);
        if (existing && existing.isFile() && existing.size === object.Size) {
          skipped += 1;
          continue;
        }

        await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
        const result = await s3.send(new GetObjectCommand({
          Bucket: LINODE_BUCKET_NAME,
          Key: object.Key
        }));
        const temporaryPath = `${localPath}.download`;

        await pipeline(result.Body, fs.createWriteStream(temporaryPath));
        await fs.promises.rename(temporaryPath, localPath);
        downloaded += 1;
      }

      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);

    console.log(`\n✅ Images have been downloaded to ${imagesDir}/`);
    console.log(`   Downloaded: ${downloaded}; already current: ${skipped}`);
    console.log('===== Images Sync Process Completed =====\n');

    if (typeof s3.destroy === 'function') {
      s3.destroy();
    }

  } catch (error) {
    console.error('\n❌ Sync failed');
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
}

syncImages();







