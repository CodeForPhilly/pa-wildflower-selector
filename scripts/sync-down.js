#!/usr/bin/env node

/**
 * Sync Database Down from Linode
 * Downloads the latest database backup from Linode Object Storage and restores it to local MongoDB
 * This is the reverse of sync-up - it restores the last backup that was uploaded
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

// Configuration
const dbName = process.env.MONGODB_DATABASE || process.env.DB_NAME || 'pa-wildflower-selector';

// Load environment variables
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  LINODE_BUCKET_NAME,
  LINODE_ENDPOINT_URL = 'https://us-east-1.linodeobjects.com',
  // MongoDB connection settings
  DB_HOST = 'localhost',
  DB_PORT = 27017,
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_DOCKER_PORT,
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
const host = DB_HOST;
const port = MONGODB_DOCKER_PORT || DB_PORT;
const user = MONGODB_USER || DB_USER;
const password = MONGODB_PASSWORD || DB_PASSWORD;

// Detect mode
const isDockerMode = host === 'mongodb';
const mode = isDockerMode ? 'Docker' : 'Local';

// Use appropriate temp directory for the platform
const tmpDir = os.tmpdir();
const backupDir = path.join(__dirname, '../db_backups');

console.log('\n📥 Syncing Database from Linode to Local MongoDB\n');
console.log(`Mode: ${mode} (DB_HOST=${host})`);
console.log(`Database: ${dbName}`);
console.log(`Linode Bucket: ${LINODE_BUCKET_NAME}\n`);

async function syncDatabase() {
  try {
    // Create backup directory
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${backupDir}\n`);
    }

    // Step 1: List available backups
    console.log('🔍 Finding latest backup...');
    const listCommand = `aws s3 ls s3://${LINODE_BUCKET_NAME}/db_backups/ --endpoint-url ${LINODE_ENDPOINT_URL}`;
    
    let backups;
    try {
      const listOutput = execSync(listCommand, { 
        encoding: 'utf-8',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY
        }
      });
      
      // Parse backup files (format: date time size filename)
      const lines = listOutput.trim().split('\n').filter(Boolean);
      if (lines.length === 0) {
        console.error('❌ No backups found in Linode Object Storage');
        console.error('   Run sync-up first to create a backup\n');
        process.exit(1);
      }
      
      // Sort by filename (which includes timestamp) to get latest
      backups = lines
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1]; // Last part is filename
        })
        .filter(name => name.endsWith('.gz'))
        .sort()
        .reverse(); // Latest first
      
      if (backups.length === 0) {
        console.error('❌ No .gz backup files found');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Failed to list backups from Linode');
      console.error(`   Error: ${error.message}\n`);
      console.error('💡 Make sure AWS CLI is installed and configured:');
      console.error('   - Install: https://aws.amazon.com/cli/');
      console.error('   - Or use: brew install awscli (macOS)');
      console.error('   - Or use: choco install awscli (Windows)\n');
      process.exit(1);
    }

    const latestBackup = backups[0];
    console.log(`✅ Found latest backup: ${latestBackup}\n`);

    // Step 2: Download backup
    const localBackupPath = path.join(backupDir, latestBackup);
    console.log(`📥 Downloading backup...`);
    
    try {
      execSync(
        `aws s3 cp s3://${LINODE_BUCKET_NAME}/db_backups/${latestBackup} "${localBackupPath}" --endpoint-url ${LINODE_ENDPOINT_URL}`,
        {
          stdio: 'inherit',
          env: {
            ...process.env,
            AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY
          }
        }
      );
      console.log(`✅ Downloaded to: ${localBackupPath}\n`);
    } catch (error) {
      console.error('❌ Failed to download backup');
      console.error(`   Error: ${error.message}\n`);
      process.exit(1);
    }

    // Step 3: Restore to MongoDB
    console.log('🔄 Restoring to local MongoDB...');
    console.log(`   Host: ${host}:${port}`);
    console.log(`   Database: ${dbName}`);
    if (user) {
      console.log(`   User: ${user}`);
    }
    console.log('');
    
    // Build mongorestore command
    // Use quotes around paths for Windows compatibility
    const archivePath = path.isAbsolute(localBackupPath) 
      ? localBackupPath 
      : path.resolve(localBackupPath);
    
    let restoreCommand = `mongorestore --host=${host} --port=${port} --db=${dbName} --archive="${archivePath}" --gzip --drop`;
    
    // Add authentication if configured
    if (user && password) {
      restoreCommand += ` --username=${user} --password=${password} --authenticationDatabase=admin`;
    }
    
    try {
      execSync(restoreCommand, { stdio: 'inherit' });
      console.log('\n✅ Database restored successfully!\n');
      
      // Optionally clean up downloaded backup (commented out by default)
      // Uncomment the next line if you want to auto-delete after restore
      // fs.unlinkSync(localBackupPath);
      // console.log('🧹 Cleaned up downloaded backup file\n');
      
    } catch (error) {
      console.error('\n❌ Failed to restore database');
      console.error(`   Error: ${error.message}\n`);
      console.error('💡 Make sure:');
      console.error('   - MongoDB is running locally');
      console.error('   - mongorestore is installed (comes with MongoDB)');
      console.error('   - Connection settings are correct in .env');
      if (isDockerMode) {
        console.error('   - Docker containers are running: docker compose up -d\n');
      } else {
        console.error('   - MongoDB service is running on your machine\n');
      }
      process.exit(1);
    }

    console.log('===== Sync Down Process Completed =====\n');
    console.log('💡 Note: To sync images from Linode, run:');
    if (isDockerMode) {
      console.log('   docker compose exec app npm run sync-images\n');
    } else {
      console.log('   npm run sync-images\n');
    }

  } catch (error) {
    console.error('\n❌ Sync failed');
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
}

syncDatabase();





