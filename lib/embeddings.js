const { pipeline } = require('@xenova/transformers');

// Cache the model to avoid reloading
let embeddingModel = null;

/**
 * Initialize the embedding model
 * Uses a lightweight sentence transformer model optimized for search
 */
async function getEmbeddingModel() {
  if (!embeddingModel) {
    console.log('Loading embedding model...');
    embeddingModel = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2' // Lightweight model, ~80MB, good for semantic search
    );
    console.log('Embedding model loaded');
  }
  return embeddingModel;
}

/**
 * Generate an embedding vector for a given text
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} - The embedding vector
 */
async function generateEmbedding(text) {
  const model = await getEmbeddingModel();
  const output = await model(text, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data);
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Cosine similarity score (0-1)
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Create a searchable text from plant data
 * @param {Object} plant - Plant document
 * @returns {string} - Combined searchable text
 */
function createSearchableText(plant) {
  const parts = [
    plant['Common Name'] || '',
    plant['Scientific Name'] || '',
  ].filter(Boolean);
  
  return parts.join(' ');
}

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  createSearchableText,
  getEmbeddingModel,
};



