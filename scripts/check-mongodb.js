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
  MONGODB_LOCAL_PORT,
  // Traditional environment variables
  DB_HOST,
  DB_PORT,
  DB_NAME = 'pa-wildflower-selector',
  DB_USER,
  DB_PASSWORD
} = process.env;

// Use Docker variables if available, fall back to traditional ones
// Default to 'mongodb' (Docker mode) unless DB_HOST is explicitly 'localhost'
const host = DB_HOST === 'localhost' ? 'localhost' : (DB_HOST || 'mongodb');
function toPort(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}
// For localhost: prefer explicitly-set DB_PORT; otherwise MONGODB_LOCAL_PORT; else 27017
// For Docker service: prefer MONGODB_DOCKER_PORT; otherwise DB_PORT; else 27017
const port = host === 'localhost'
  ? (toPort(DB_PORT) ?? toPort(MONGODB_LOCAL_PORT) ?? 27017)
  : (toPort(MONGODB_DOCKER_PORT) ?? toPort(DB_PORT) ?? 27017);
const dbName = MONGODB_DATABASE || DB_NAME;
const user = MONGODB_USER || DB_USER;
const password = MONGODB_PASSWORD || DB_PASSWORD;

const isDockerMode = host === 'mongodb';
const isLocalhost = host === 'localhost';
const mode = isDockerMode ? 'Docker' : 'Local';

const credentials = user ? `${user}:${password}@` : '';
const authSource = user ? '?authSource=admin' : '';
const uriWithAuth = `mongodb://${credentials}${host}:${port}${authSource}`;
const uriWithoutAuth = `mongodb://${host}:${port}`;

console.log(`\n🔍 Checking MongoDB connection (${mode} mode)...`);
console.log(`   Host: ${host}:${port}`);
console.log(`   Database: ${dbName}`);
console.log(`   Authentication: ${user ? 'Yes' : 'No'}\n`);

async function checkMongoDB() {
  let client;
  let uri = user ? uriWithAuth : uriWithoutAuth;
  
  // Try with authentication first if credentials are provided
  if (user) {
    client = new MongoClient(uri, {
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
      // If authentication fails and we're in local mode, try without auth
      // Check for various authentication-related error messages (case-insensitive)
      const errorMessage = error.message.toLowerCase();
      const isAuthError = errorMessage.includes('authentication') || 
                         errorMessage.includes('auth') ||
                         error.code === 18 || // Authentication failed error code
                         error.code === 8000; // Authentication mechanism failed
      
      if (isLocalhost && isAuthError) {
        console.log('⚠️  Authentication failed. Trying without authentication for local development...\n');
        await client.close();
        uri = uriWithoutAuth;
        client = new MongoClient(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
        try {
          await client.connect();
          const db = client.db(dbName);
          await db.admin().ping();
          console.log('✅ MongoDB connection successful (without authentication)!\n');
          await client.close();
          process.exit(0);
        } catch (retryError) {
          console.error('❌ MongoDB connection failed!\n');
          console.error(`   Error: ${retryError.message}\n`);
          await client.close();
          showHelp();
          process.exit(1);
        }
      } else {
        console.error('❌ MongoDB connection failed!\n');
        console.error(`   Error: ${error.message}\n`);
        await client.close();
        showHelp();
        process.exit(1);
      }
    }
  } else {
    client = new MongoClient(uri, {
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
      await client.close();
      showHelp();
      process.exit(1);
    }
  }
}

function showHelp() {
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
}

checkMongoDB();












