const { MongoClient } = require('mongodb');
const {
  DB_HOST='127.0.0.1', // Changed from 'localhost' to '127.0.0.1'
  DB_PORT=27017,
  DB_NAME='pa-wildflower-selector',
  DB_USER,
  DB_PASSWORD
} = process.env;
const credentials = DB_USER && DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}@` : '';
// Updated URI to include `127.0.0.1` explicitly and removed deprecated options
const uri = `mongodb://${credentials}${DB_HOST}:${DB_PORT}/${DB_NAME}`;

module.exports = async () => {
  const client = new MongoClient(uri); // Removed useNewUrlParser
  await client.connect();
  const db = client.db(DB_NAME);
  const plants = db.collection('plants');
  const nurseries = db.collection('nurseries');
  
  // Your existing code for migrations and index creation can remain as is
  
  return {
    plants,
    nurseries,
    close() {
      return client.close();
    }
  };
};
