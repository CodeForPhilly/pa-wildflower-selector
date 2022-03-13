const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017/pa-wildflower-selector';

module.exports = async () => {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db('pa-wildflower-selector');
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
