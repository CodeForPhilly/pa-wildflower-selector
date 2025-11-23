const { MongoClient } = require('mongodb');

// Support both traditional DB_* variables and Docker MONGODB_* variables
const {
  // Docker environment variables (from docker-compose.yml)
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_DATABASE,
  MONGODB_DOCKER_PORT,
  // Traditional environment variables
  DB_HOST,
  DB_PORT=27017,
  DB_NAME='pa-wildflower-selector',
  DB_USER,
  DB_PASSWORD
} = process.env;

// Use Docker variables if available, fall back to traditional ones
// Default to 'mongodb' (Docker mode) unless DB_HOST is explicitly 'localhost'
const host = DB_HOST === 'localhost' ? 'localhost' : (DB_HOST || 'mongodb');
const port = MONGODB_DOCKER_PORT || DB_PORT;
const dbName = MONGODB_DATABASE || DB_NAME;
const user = MONGODB_USER || DB_USER;
const password = MONGODB_PASSWORD || DB_PASSWORD;

const credentials = user ? `${user}:${password}@` : '';
const uri = `mongodb://${credentials}${host}:${port}`;

console.log(`Connecting to MongoDB at ${host}:${port}/${dbName} ${user ? 'with authentication' : 'without authentication'}`);

module.exports = async () => {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
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
