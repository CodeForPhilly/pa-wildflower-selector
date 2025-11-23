require('dotenv').config();
const db = require('../lib/db');
const { generateEmbedding, createSearchableText } = require('../lib/embeddings');

/**
 * Generate embeddings for all plants and store them in MongoDB
 * This script should be run once to populate embeddings, and can be re-run
 * to update embeddings when plant data changes.
 */
async function generateEmbeddings() {
  const { plants, close } = await db();
  
  console.log('Fetching all plants...');
  const allPlants = await plants.find({}).toArray();
  console.log(`Found ${allPlants.length} plants`);
  
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const plant of allPlants) {
    try {
      // Skip if embedding already exists and we're not forcing regeneration
      if (plant.embedding && !process.env.FORCE_REGENERATE) {
        skipped++;
        if (skipped % 100 === 0) {
          process.stdout.write(`\rProcessed: ${processed}, Updated: ${updated}, Skipped: ${skipped}`);
        }
        continue;
      }
      
      const searchableText = createSearchableText(plant);
      if (!searchableText.trim()) {
        console.warn(`\nWarning: No searchable text for plant ${plant._id}`);
        skipped++;
        continue;
      }
      
      // Generate embedding
      const embedding = await generateEmbedding(searchableText);
      
      // Update the plant document with the embedding
      await plants.updateOne(
        { _id: plant._id },
        { $set: { embedding } }
      );
      
      updated++;
      processed++;
      
      if (processed % 10 === 0) {
        process.stdout.write(`\rProcessed: ${processed}, Updated: ${updated}, Skipped: ${skipped}`);
      }
    } catch (error) {
      console.error(`\nError processing plant ${plant._id}:`, error.message);
      processed++;
    }
  }
  
  console.log(`\n\nCompleted!`);
  console.log(`Total processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  
  // Create index on embedding field for better performance
  try {
    console.log('\nCreating index on embedding field...');
    await plants.createIndex({ embedding: '2dsphere' });
    console.log('Index created successfully');
  } catch (error) {
    console.warn('Note: Could not create 2dsphere index (this is okay for vector search)');
  }
  
  await close();
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

generateEmbeddings();





















