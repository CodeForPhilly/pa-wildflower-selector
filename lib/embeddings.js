// Cache the transformers module and model to avoid reloading
let transformersModule = null;
let embeddingModel = null;

/**
 * Ensure global.fetch is properly overridden to fix malformed URLs
 * This is a backup in case the SSR bundle overwrites it
 */
function ensureFetchOverride() {
  if (typeof global !== 'undefined') {
    const nodeFetch = require('node-fetch');
    
    const fixedFetch = function(url, options) {
      let fetchUrl = url;
      
      if (typeof url === 'string') {
        // Fix malformed URLs like "http://localhost:3000https://huggingface.co/..."
        if (url.includes('localhost') && url.includes('huggingface.co')) {
          // Extract the actual HuggingFace URL (everything from https:// onwards)
          const httpsMatch = url.match(/https?:\/\/[^/]*huggingface\.co\/.*/);
          if (httpsMatch) {
            fetchUrl = httpsMatch[0];
          } else {
            // Fallback: find https:// in the string and use everything from there
            const httpsIndex = url.indexOf('https://');
            if (httpsIndex !== -1) {
              fetchUrl = url.substring(httpsIndex);
            }
          }
        }
      }
      
      // Use node-fetch for all requests (more reliable in Node.js environment)
      return nodeFetch(fetchUrl, options);
    };
    
    // Always override to ensure it's set correctly
    global.fetch = fixedFetch;
    if (typeof globalThis !== 'undefined') {
      globalThis.fetch = fixedFetch;
    }
  }
}

/**
 * Get the transformers module using dynamic import (required for ES modules)
 */
async function getTransformersModule() {
  if (!transformersModule) {
    // Ensure fetch is overridden before importing transformers
    ensureFetchOverride();
    transformersModule = await import('@xenova/transformers');
  }
  return transformersModule;
}

/**
 * Initialize the embedding model
 * Uses a lightweight sentence transformer model optimized for search
 */
async function getEmbeddingModel() {
  if (!embeddingModel) {
    console.log('Loading embedding model...');
    const { pipeline } = await getTransformersModule();
    
    // global.fetch is already overridden at the top of this file
    // to fix malformed URLs from SSR webpack polyfills
    
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



