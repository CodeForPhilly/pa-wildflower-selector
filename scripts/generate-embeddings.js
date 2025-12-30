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
  
  // NOTE: Do not create a 2dsphere index on embedding. 2dsphere is for geo, not vector similarity.
  // If/when we adopt a real vector index (e.g. Atlas Search vector), create that instead.
  
  await close();
  return { processed, updated, skipped };
}

// Export for use in other modules
module.exports = { generateEmbeddings };

// If run directly as a script, execute it
if (require.main === module) {
  // Handle errors for standalone execution
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });

  generateEmbeddings()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

























