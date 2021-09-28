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
  try {
    await plants.createIndex({
      "$**": "text"
    });
  } catch (e) {
    console.error('\nThe following error may be OK if you are also testing PRs with the newer text index:\n');
    console.error(e);
  }
  return {
    plants,
    close() {
      return client.close();
    }
  };
};
