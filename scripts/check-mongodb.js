#!/usr/bin/env node

/**
 * MongoDB Connection Checker
 * Verifies MongoDB connection for both Docker and Local development modes
 */

require("dotenv").config();
const { MongoClient } = require('mongodb');

// Support both traditional DB_* variables and Docker MONGODB_* variables
const {
  // Docker environment variables (from docker-compose.yml)
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_DATABASE,
  MONGODB_DOCKER_PORT,
  // Traditional environment variables
  DB_HOST = 'localhost',
  DB_PORT = 27017,
  DB_NAME = 'pa-wildflower-selector',
  DB_USER,
  DB_PASSWORD
} = process.env;

// Use Docker variables if available, fall back to traditional ones
const host = DB_HOST || 'mongodb'; // Use 'mongodb' as default in Docker
const port = MONGODB_DOCKER_PORT || DB_PORT;
const dbName = MONGODB_DATABASE || DB_NAME;
const user = MONGODB_USER || DB_USER;
const password = MONGODB_PASSWORD || DB_PASSWORD;

const credentials = user ? `${user}:${password}@` : '';
const uri = `mongodb://${credentials}${host}:${port}`;

// Detect mode
const isDockerMode = host === 'mongodb';
const mode = isDockerMode ? 'Docker' : 'Local';

console.log(`\n🔍 Checking MongoDB connection (${mode} mode)...`);
console.log(`   Host: ${host}:${port}`);
console.log(`   Database: ${dbName}`);
console.log(`   Authentication: ${user ? 'Yes' : 'No'}\n`);

async function checkMongoDB() {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // 5 second timeout
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    await db.admin().ping();
    console.log('✅ MongoDB connection successful!\n');
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed!\n');
    console.error(`   Error: ${error.message}\n`);
    
    // Provide helpful instructions based on mode and platform
    if (isDockerMode) {
      console.log('💡 Docker Mode: Make sure Docker containers are running:');
      console.log('   Run: docker compose up -d\n');
    } else {
      console.log('💡 Local Mode: Make sure MongoDB is running on your machine.\n');
      
      // Platform-specific instructions
      const platform = process.platform;
      if (platform === 'win32') {
        console.log('   Windows:');
        console.log('   - Check if MongoDB service is running: services.msc');
        console.log('   - Start MongoDB service: net start MongoDB');
        console.log('   - Or start manually: mongod --dbpath <path-to-data>\n');
      } else if (platform === 'darwin') {
        console.log('   macOS:');
        console.log('   - If installed via Homebrew: brew services start mongodb-community');
        console.log('   - Or start manually: mongod --config /usr/local/etc/mongod.conf\n');
      } else {
        console.log('   Linux:');
        console.log('   - Start MongoDB service: sudo systemctl start mongod');
        console.log('   - Or: sudo service mongod start');
        console.log('   - Check status: sudo systemctl status mongod\n');
      }
      
      console.log('   Verify MongoDB is running:');
      console.log('   - Try: mongosh (or mongo)');
      console.log('   - Or check: mongosh mongodb://localhost:27017\n');
    }
    
    await client.close();
    process.exit(1);
  }
}

checkMongoDB();









