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
// For localhost: prefer explicitly-set DB_PORT; otherwise prefer MONGODB_LOCAL_PORT (Docker port mapping); else 27017
// For Docker service: prefer MONGODB_DOCKER_PORT; otherwise DB_PORT; else 27017
const port = host === 'localhost'
  ? (toPort(DB_PORT) ?? toPort(MONGODB_LOCAL_PORT) ?? 27017)
  : (toPort(MONGODB_DOCKER_PORT) ?? toPort(DB_PORT) ?? 27017);
const dbName = MONGODB_DATABASE || DB_NAME;
const user = MONGODB_USER || DB_USER;
const password = MONGODB_PASSWORD || DB_PASSWORD;

const isLocalhost = host === 'localhost';
const credentials = user ? `${user}:${password}@` : '';
const authSource = user ? '?authSource=admin' : '';
const uriWithAuth = `mongodb://${credentials}${host}:${port}${authSource}`;
const uriWithoutAuth = `mongodb://${host}:${port}`;

console.log(`Connecting to MongoDB at ${host}:${port}/${dbName} ${user ? 'with authentication' : 'without authentication'}`);

module.exports = async () => {
  let client;
  let uri = user ? uriWithAuth : uriWithoutAuth;
  
  // Try with authentication first if credentials are provided
  if (user) {
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    try {
      await client.connect();
      // Test the connection
      await client.db(dbName).admin().ping();
    } catch (error) {
      // If authentication fails and we're in local mode, try without auth
      // Check for various authentication-related error messages (case-insensitive)
      const errorMessage = error.message.toLowerCase();
      const isAuthError = errorMessage.includes('authentication') || 
                         errorMessage.includes('auth') ||
                         error.code === 18 || // Authentication failed error code
                         error.code === 8000; // Authentication mechanism failed
      
      if (isLocalhost && isAuthError) {
        console.log('⚠️  Authentication failed. Trying without authentication for local development...');
        await client.close();
        uri = uriWithoutAuth;
        client = new MongoClient(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        await client.connect();
        // Verify the connection works without auth
        await client.db(dbName).admin().ping();
      } else {
        throw error;
      }
    }
  } else {
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
  }
  
  const db = client.db(dbName);
  const plants = db.collection('plants');
  const nurseries = db.collection('nurseries');
  // Migration from the old universal text index
  try {
    await plants.dropIndex('$**_text');
  } catch (e) {
    // Already gone, that's fine
  }
  // By request, just on scientific name and common name
  await plants.createIndex({
    'Scientific Name': 'text',
    'Common Name': 'text'
  });
  return {
    plants,
    nurseries,
    close() {
      return client.close();
    }
  };
};
