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
  await plants.createIndex({
    "$**": "text"
  });
  return {
    plants,
    close() {
      return client.close();
    }
  };
};
