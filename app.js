const db = require('./lib/db');
const server = require('./lib/server');
const { generateEmbeddings } = require('./scripts/generate-embeddings');

run();

async function run() {
  const dbConnection = await db();
  const { plants } = dbConnection;
  
  // Check if embeddings exist
  const embeddingCount = await plants.countDocuments({ 
    embedding: { $exists: true, $ne: null } 
  });
  
  if (embeddingCount === 0) {
    console.log('\n⚠️  No embeddings found in database.');
    console.log('🔄 Auto-generating embeddings... This may take a few minutes.\n');
    
    try {
      // Close the current connection since generateEmbeddings will create its own
      await dbConnection.close();
      
      // Generate embeddings (this will create its own DB connection)
      await generateEmbeddings();
      
      console.log('\n✅ Embeddings generated successfully!');
      console.log('🔄 Reconnecting to database...\n');
      
      // Reconnect to database
      const refreshedConnection = await db();
      await server(refreshedConnection);
    } catch (error) {
      console.error('\n❌ Error generating embeddings:', error);
      console.error('⚠️  Server will start without embeddings. Semantic search will not work.');
      console.error('💡 Run manually: npm run generate-embeddings\n');
      
      // Start server anyway (without embeddings)
      const refreshedConnection = await db();
      await server(refreshedConnection);
    }
  } else {
    console.log(`✅ Found ${embeddingCount} plants with embeddings.`);
    await server(dbConnection);
  }
}
