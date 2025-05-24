/**
 * Optimized query functions for the PA Wildflower Selector
 * This module provides memory-efficient database query functions
 */

/**
 * Get filter counts using a single aggregation pipeline instead of multiple queries
 * @param {Object} plants - MongoDB collection for plants
 * @param {Object} query - Base query object
 * @param {Array} filters - Array of filter configurations
 * @returns {Object} - Object with counts for each filter
 */
async function getFilterCountsOptimized(plants, query, filters) {
  // Create a base match stage that excludes any existing filter conditions
  const baseMatch = { ...query };
  if (baseMatch.$and) {
    delete baseMatch.$and;
  }

  // Create a map of filter names to their configurations for easy lookup
  const filterMap = {};
  filters.forEach(filter => {
    filterMap[filter.name] = filter;
  });

  // Get all array-type filters that need counts
  const arrayFilters = filters.filter(f => f.array);
  const booleanFilters = filters.filter(f => f.boolean);
  
  // Results object to store all counts
  const results = {};

  // Process array filters in batches to avoid memory issues
  const BATCH_SIZE = 3; // Process 3 filters at a time
  for (let i = 0; i < arrayFilters.length; i += BATCH_SIZE) {
    const batchFilters = arrayFilters.slice(i, i + BATCH_SIZE);
    
    // Skip empty batches
    if (batchFilters.length === 0) continue;
    
    // Create a facet stage with one facet per filter
    const facetStage = {};
    
    batchFilters.forEach(filter => {
      facetStage[filter.name] = [
        { $match: baseMatch },
        { $unwind: { path: `$${filter.name}`, preserveNullAndEmptyArrays: false } },
        { $group: { _id: `$${filter.name}`, count: { $sum: 1 } } }
      ];
    });
    
    // Execute the aggregation with the facet stage
    const facetResults = await plants.aggregate([{ $facet: facetStage }]).toArray();
    
    // Process the results
    if (facetResults && facetResults.length > 0) {
      const batchResult = facetResults[0];
      
      // Add the counts to the results object
      batchFilters.forEach(filter => {
        results[filter.name] = batchResult[filter.name] || [];
      });
    }
  }

  // Process boolean filters in a similar way
  if (booleanFilters.length > 0) {
    const facetStage = {};
    
    booleanFilters.forEach(filter => {
      facetStage[filter.name] = [
        { $match: baseMatch },
        { $group: { _id: `$${filter.name}`, count: { $sum: 1 } } }
      ];
    });
    
    const facetResults = await plants.aggregate([{ $facet: facetStage }]).toArray();
    
    if (facetResults && facetResults.length > 0) {
      const batchResult = facetResults[0];
      
      booleanFilters.forEach(filter => {
        let counts = batchResult[filter.name] || [];
        const trueChoice = counts.find(count => !!count._id);
        
        if (trueChoice) {
          trueChoice._id = filter.choices[0];
        } else {
          counts.push({
            _id: filter.choices[0],
            count: 0
          });
        }
        
        results[filter.name] = counts;
      });
    }
  }

  return results;
}

/**
 * Get distinct values for filters with optimized memory usage
 * @param {Object} plants - MongoDB collection
 * @param {Array} filters - Array of filter configurations
 * @returns {Object} - Object with distinct values for each filter
 */
async function getDistinctValuesOptimized(plants, filters) {
  const results = {};
  
  // Process filters in batches to reduce memory pressure
  const BATCH_SIZE = 5;
  for (let i = 0; i < filters.length; i += BATCH_SIZE) {
    const batchFilters = filters.slice(i, i + BATCH_SIZE);
    
    // Process each filter in the batch
    await Promise.all(batchFilters.map(async (filter) => {
      // Skip if choices are already defined or if counts exist (which contain the choices)
      if (filter.choices || filter.counts) return;
      
      // Get distinct values
      if (filter.byNumber) {
        results[filter.name] = (await plants.distinct(filter.byNumber))
          .filter(choice => typeof choice === "number");
      } else {
        results[filter.name] = (await plants.distinct(filter.name))
          .filter(choice => typeof choice === "string" && choice.length);
      }
    }));
  }
  
  return results;
}

module.exports = {
  getFilterCountsOptimized,
  getDistinctValuesOptimized
};
