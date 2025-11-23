#!/usr/bin/env node

/**
 * Development Environment Setup Checker
 * Verifies environment is ready for local development
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Check for required environment variables
const requiredEnvVars = [
  'MASTER_CSV_URL',
  'ARTICLES_CSV_URL',
  'LOCAL_MAP_CSV_URL',
  'ONLINE_STORES_CSV_URL'
];

// MongoDB connection variables
const {
  DB_HOST,
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_DATABASE,
  MONGODB_DOCKER_PORT,
  DB_PORT = 27017,
  DB_NAME = 'pa-wildflower-selector',
  DB_USER,
  DB_PASSWORD
} = process.env;

// Detect mode - default to Docker unless explicitly localhost
const host = DB_HOST === 'localhost' ? 'localhost' : (DB_HOST || 'mongodb');
const isDockerMode = host === 'mongodb';
const mode = isDockerMode ? 'Docker' : 'Local';

console.log('\n🔧 Development Environment Setup Check\n');
console.log(`Mode: ${mode} (DB_HOST=${host})\n`);

let hasErrors = false;

// Check environment variables
console.log('📋 Checking environment variables...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('   Please check your .env file\n');
  hasErrors = true;
} else {
  console.log('✅ All required environment variables are set\n');
}

// Check MongoDB connection
console.log('🔍 Checking MongoDB connection...');
try {
  execSync('node scripts/check-mongodb.js', { stdio: 'inherit' });
  console.log('');
} catch (error) {
  hasErrors = true;
  console.log('');
}

// Check for Docker containers if in local mode
if (!isDockerMode) {
  console.log('🐳 Checking Docker containers...');
  try {
    const dockerPs = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf-8' });
    const containerNames = dockerPs.trim().split('\n').filter(Boolean);
    const relevantContainers = containerNames.filter(name => 
      name.includes('mongodb') || name.includes('pa-wildflower') || name.includes('wildflower')
    );
    
    if (relevantContainers.length > 0) {
      console.warn('⚠️  Warning: Docker containers are running while in Local mode:');
      relevantContainers.forEach(name => console.warn(`   - ${name}`));
      console.warn('   This may cause port conflicts. Consider stopping them:');
      console.warn('   Run: docker compose down\n');
    } else {
      console.log('✅ No conflicting Docker containers detected\n');
    }
  } catch (error) {
    // Docker might not be installed or available, that's okay for local mode
    console.log('ℹ️  Docker not available (this is okay for local mode)\n');
  }
}

// Check/create necessary directories
console.log('📁 Checking directories...');
const directories = [
  path.join(__dirname, '../images'),
  path.join(__dirname, '../public')
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`   Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});
console.log('✅ Directories ready\n');

// Summary
if (hasErrors) {
  console.error('❌ Setup check completed with errors. Please fix the issues above before starting development.\n');
  process.exit(1);
} else {
  console.log('✅ Development environment is ready!\n');
  console.log('   You can now run: npm run dev:local\n');
  process.exit(0);
}












