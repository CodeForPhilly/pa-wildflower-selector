const { MongoClient } = require('mongodb');
const {
  DB_HOST='localhost',
  DB_PORT=27017,
  DB_NAME='pa-wildflower-selector',
  DB_USER,
  DB_PASSWORD
} = process.env;
const credentials = DB_USER ? `${DB_USER}:${DB_PASSWORD}@` : '';
const uri = `mongodb://${credentials}${DB_HOST || ''}:${DB_PORT || ''}`;

module.exports = async () => {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db(DB_NAME);
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
