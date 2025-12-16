#!/usr/bin/env node

/**
 * Sync Database Up to Linode
 * Creates a MongoDB backup from local database and uploads it to Linode Object Storage
 * This is the reverse of sync-down - it backs up the local database to Linode
 * Cross-platform Node.js version (works on Windows, macOS, Linux)
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Configuration
const dbName = process.env.MONGODB_DATABASE || process.env.DB_NAME || 'pa-wildflower-selector';

// Load environment variables
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  LINODE_BUCKET_NAME,
  LINODE_ENDPOINT_URL = 'https://us-east-1.linodeobjects.com',
  // MongoDB connection settings
  DB_HOST,
  DB_PORT = 27017,
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_DOCKER_PORT,
  MONGODB_LOCAL_PORT,
  DB_USER,
  DB_PASSWORD
} = process.env;

// Check required environment variables
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !LINODE_BUCKET_NAME) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, LINODE_BUCKET_NAME');
  console.error('   Please check your .env file\n');
  process.exit(1);
}

// MongoDB connection settings
// Default to 'mongodb' (Docker mode) unless DB_HOST is explicitly 'localhost'
const host = DB_HOST === 'localhost' ? 'localhost' : (DB_HOST || 'mongodb');
// For localhost: prefer DB_PORT (local MongoDB), fall back to MONGODB_LOCAL_PORT (Docker port mapping)
// For Docker service: use MONGODB_DOCKER_PORT or DB_PORT
const port = host === 'localhost' 
  ? (DB_PORT || MONGODB_LOCAL_PORT || 27017)
  : (MONGODB_DOCKER_PORT || DB_PORT || 27017);
const user = MONGODB_USER || DB_USER;
const password = MONGODB_PASSWORD || DB_PASSWORD;

// Detect mode
const isDockerMode = host === 'mongodb';
const mode = isDockerMode ? 'Docker' : 'Local';

// Only use authentication if explicitly required (Docker mode or MONGODB_REQUIRE_AUTH is set)
// Local MongoDB instances often don't require authentication
const requireAuth = isDockerMode || process.env.MONGODB_REQUIRE_AUTH === 'true';

// Use appropriate temp directory for the platform
const tmpDir = os.tmpdir();
const backupDir = path.join(__dirname, '../db_backups');

console.log('\n📤 Syncing Database from Local MongoDB to Linode\n');
console.log(`Mode: ${mode} (DB_HOST=${host})`);
console.log(`Database: ${dbName}`);
console.log(`Host: ${host}:${port}`);
if (user) {
  console.log(`User: ${user}`);
}
console.log(`Linode Bucket: ${LINODE_BUCKET_NAME}\n`);

// Check if flags are passed
const skipImages = process.argv.includes('--skip-images') || process.argv.includes('--db-only');
const skipDatabase = process.argv.includes('--images-only') || process.argv.includes('--skip-db');

async function syncDatabase() {
  try {
    // Step 0: Verify AWS CLI is available and configured before creating backup
    console.log('🔍 Checking AWS CLI availability...\n');
    
    try {
      // Check if AWS CLI is installed
      execSync('aws --version', { stdio: 'pipe' });
      console.log('✅ AWS CLI is installed\n');
    } catch (error) {
      console.error('❌ AWS CLI is not installed or not in PATH');
      console.error('💡 Please install AWS CLI:');
      console.error('   - Windows: choco install awscli');
      console.error('   - macOS: brew install awscli');
      console.error('   - Linux: https://aws.amazon.com/cli/\n');
      process.exit(1);
    }

    // Test AWS credentials by attempting to list the bucket (or at least verify credentials)
    console.log('🔍 Verifying AWS credentials and Linode access...\n');
    try {
      execSync(
        `aws s3 ls s3://${LINODE_BUCKET_NAME}/ --endpoint-url ${LINODE_ENDPOINT_URL}`,
        {
          stdio: 'pipe',
          env: {
            ...process.env,
            AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY
          }
        }
      );
      console.log('✅ AWS credentials verified and Linode bucket is accessible\n');
    } catch (error) {
      console.error('❌ Failed to access Linode Object Storage');
      console.error('💡 Make sure:');
      console.error('   - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct in .env');
      console.error('   - LINODE_BUCKET_NAME is correct');
      console.error('   - Your Linode credentials have proper permissions\n');
      process.exit(1);
    }

    // Skip database backup if --images-only flag is set
    if (skipDatabase) {
      console.log('ℹ️  Skipping database backup (--images-only flag set)\n');
    } else {
      // Create backup directory
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`📁 Created backup directory: ${backupDir}\n`);
      }

      // Step 1: Create MongoDB dump
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dumpFilename = `mongodb_dump_${timestamp}.gz`;
    const localBackupPath = path.join(backupDir, dumpFilename);
    
    console.log('🔄 Creating MongoDB backup...');
    console.log(`   Backup file: ${dumpFilename}\n`);
    
    // Build mongodump command
    // Use quotes around paths for Windows compatibility
    const archivePath = path.isAbsolute(localBackupPath) 
      ? localBackupPath 
      : path.resolve(localBackupPath);
    
    let dumpCommand = `mongodump --host=${host} --port=${port} --db=${dbName} --archive="${archivePath}" --gzip`;
    
    // Add authentication only if required (Docker mode or explicitly enabled)
    // Local MongoDB instances often don't require authentication
    if (requireAuth && user && password) {
      dumpCommand += ` --username=${user} --password=${password} --authenticationDatabase=admin`;
    } else if (!requireAuth && (user || password)) {
      console.log('ℹ️  Skipping authentication (local MongoDB mode - auth not required)');
    }
    
    try {
      execSync(dumpCommand, { stdio: 'inherit' });
      console.log(`✅ Backup created: ${localBackupPath}\n`);
    } catch (error) {
      console.error('\n❌ Failed to create MongoDB backup');
      console.error(`   Error: ${error.message}\n`);
      console.error('💡 Make sure:');
      console.error('   - MongoDB is running locally');
      console.error('   - mongodump is installed (comes with MongoDB)');
      console.error('   - Connection settings are correct in .env');
      if (isDockerMode) {
        console.error('   - Docker containers are running: docker compose up -d\n');
      } else {
        console.error('   - MongoDB service is running on your machine\n');
      }
      process.exit(1);
    }

    // Step 2: Upload database dump to Linode Object Storage using AWS SDK
    console.log('📤 Uploading database backup to Linode Object Storage...');
    
    try {
      // Create S3 client configured for Linode Object Storage
      const s3Client = new S3Client({
        endpoint: LINODE_ENDPOINT_URL,
        region: 'us-east-1', // Linode uses us-east-1 as default
        credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
        forcePathStyle: false, // Linode uses virtual-hosted-style
      });

      // Read the file as a buffer
      const fileBuffer = fs.readFileSync(archivePath);
      
      // Upload using PutObjectCommand
      const uploadCommand = new PutObjectCommand({
        Bucket: LINODE_BUCKET_NAME,
        Key: `db_backups/${dumpFilename}`,
        Body: fileBuffer,
        ACL: 'private',
        ContentLength: fileBuffer.length, // Explicitly set Content-Length to avoid 411 error
      });

      await s3Client.send(uploadCommand);
      console.log(`\n✅ Database backup uploaded to: s3://${LINODE_BUCKET_NAME}/db_backups/${dumpFilename}\n`);
    } catch (error) {
      console.error('\n❌ Failed to upload backup to Linode');
      console.error(`   Error: ${error.message}\n`);
      console.error('💡 Troubleshooting:');
      console.error('   - Check file path and permissions');
      console.error('   - Verify Linode bucket access and credentials');
      console.error('   - Ensure @aws-sdk/client-s3 is installed: npm install\n');
      process.exit(1);
    }
    }

    // Step 3: Optionally sync images to Linode Object Storage (skip if --skip-images flag is set)
    if (skipImages) {
      console.log('ℹ️  Skipping image sync (--skip-images flag set)\n');
    } else {
      const imagesDir = isDockerMode ? '/app/images' : path.join(__dirname, '../images');
      if (fs.existsSync(imagesDir)) {
      console.log('📤 Syncing images to Linode Object Storage...');
      console.log(`   Images directory: ${imagesDir}\n`);
      
      try {
        execSync(
          `aws s3 sync "${imagesDir}/" s3://${LINODE_BUCKET_NAME}/images/ --endpoint-url ${LINODE_ENDPOINT_URL} --acl public-read`,
          {
            stdio: 'inherit',
            env: {
              ...process.env,
              AWS_ACCESS_KEY_ID,
              AWS_SECRET_ACCESS_KEY
            }
          }
        );
        console.log(`\n✅ Images synced to: s3://${LINODE_BUCKET_NAME}/images/`);
        console.log(`   Images available at: https://${LINODE_BUCKET_NAME}.${LINODE_ENDPOINT_URL.replace('https://', '').split('/')[0]}/images/\n`);
      } catch (error) {
        console.error('\n⚠️  Failed to sync images (non-critical)');
        console.error(`   Error: ${error.message}\n`);
        // Don't exit on image sync failure, as it's not critical
      }
      } else {
        console.log('ℹ️  Images directory not found, skipping image sync');
        console.log(`   Expected: ${imagesDir}\n`);
      }
    }

    // Step 4: Cleanup (optional - keep local backup by default)
    // Uncomment the next line if you want to auto-delete after upload
    // fs.unlinkSync(localBackupPath);
    // console.log('🧹 Cleaned up local backup file\n');

    console.log('===== Sync Up Process Completed =====\n');
    console.log('💡 The sandbox instance can now pull this backup using:');
    console.log('   npm run sync:down\n');

  } catch (error) {
    console.error('\n❌ Sync failed');
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
}

syncDatabase();




