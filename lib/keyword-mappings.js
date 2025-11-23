/**
 * Maps natural language keywords to filter values
 * Similar to queryrules.ini in the reference repository
 */

const keywordMappings = [
  // Sun Exposure
  {
    keywords: ['shade', 'shady', 'full shade', 'deep shade', 'shade tolerant'],
    filter: 'Sun Exposure Flags',
    values: ['Shade'],
  },
  {
    keywords: ['sun', 'sunny', 'full sun', 'all day sun'],
    filter: 'Sun Exposure Flags',
    values: ['Sun'],
  },
  {
    keywords: ['part shade', 'partial shade', 'partial sun', 'part sun', 'filtered light'],
    filter: 'Sun Exposure Flags',
    values: ['Part Shade'],
  },
  
  // Soil Moisture
  {
    keywords: ['wet', 'wet soil', 'wet feet', 'puddles', 'rain garden'],
    filter: 'Soil Moisture Flags',
    values: ['Wet'],
  },
  {
    keywords: ['dry', 'dry soil', 'cracks', 'drought', 'drought tolerant'],
    filter: 'Soil Moisture Flags',
    values: ['Dry'],
  },
  {
    keywords: ['moist', 'moist soil', 'slightly moist', 'damp'],
    filter: 'Soil Moisture Flags',
    values: ['Moist'],
  },
  
  // Life Cycle
  {
    keywords: ['perennial', 'perennials'],
    filter: 'Life Cycle Flags',
    values: ['Perennial'],
  },
  {
    keywords: ['annual', 'annuals'],
    filter: 'Life Cycle Flags',
    values: ['Annual'],
  },
  {
    keywords: ['biennial', 'biennials'],
    filter: 'Life Cycle Flags',
    values: ['Biennial'],
  },
  
  // Pollinators
  {
    keywords: ['butterfly', 'butterflies'],
    filter: 'Pollinator Flags',
    values: ['Butterflies'],
  },
  {
    keywords: ['hummingbird', 'hummingbirds'],
    filter: 'Pollinator Flags',
    values: ['Hummingbirds'],
  },
  {
    keywords: ['bees', 'bee', 'honey bees', 'native bees'],
    filter: 'Pollinator Flags',
    values: ['Native Bees', 'Honey Bees'],
  },
  {
    keywords: ['beetle', 'beetles'],
    filter: 'Pollinator Flags',
    values: ['Beetles'],
  },
  {
    keywords: ['bombus', 'bumblebee', 'bumblebees', 'bumble bee', 'bumble bees'],
    filter: 'Pollinator Flags',
    values: ['Bombus'],
  },
  {
    keywords: ['fly', 'flies'],
    filter: 'Pollinator Flags',
    values: ['Flies'],
  },
  {
    keywords: ['monarch butterfly', 'monarch butterflies'],
    filter: 'Pollinator Flags',
    values: ['Monarchs'],
  },
  {
    keywords: ['monarch', 'monarchs'],
    filter: 'Pollinator Flags',
    values: ['Monarchs'],
  },
  {
    keywords: ['moth', 'moths'],
    filter: 'Pollinator Flags',
    values: ['Moths'],
  },
  {
    keywords: ['wasp', 'wasps'],
    filter: 'Pollinator Flags',
    values: ['Wasps'],
  },
  {
    keywords: ['larval host butterfly', 'larval host butterflies', 'butterfly host', 'butterfly hosts'],
    filter: 'Pollinator Flags',
    values: ['Larval Host (Butterfly)'],
  },
  {
    keywords: ['larval host monarch', 'larval host monarchs', 'monarch host', 'monarch hosts', 'monarch waystation'],
    filter: 'Pollinator Flags',
    values: ['Larval Host (Monarch)'],
  },
  {
    keywords: ['larval host moth', 'larval host moths', 'moth host', 'moth hosts'],
    filter: 'Pollinator Flags',
    values: ['Larval Host (Moth)'],
  },
  {
    keywords: ['nesting bees', 'nesting structure bees', 'bee nesting', 'bee nesting structure', 'nesting and structure bees'],
    filter: 'Pollinator Flags',
    values: ['Nesting And Structure (Bees)'],
  },
  
  // Plant Type
  {
    keywords: ['tree', 'trees'],
    filter: 'Plant Type Flags',
    values: ['Tree'],
  },
  {
    keywords: ['shrub', 'shrubs', 'bush', 'bushes'],
    filter: 'Plant Type Flags',
    values: ['Shrub'],
  },
  {
    keywords: ['vine', 'vines', 'climbing', 'trellis'],
    filter: 'Plant Type Flags',
    values: ['Vine'],
  },
  {
    keywords: ['grass', 'grasses', 'graminoid'],
    filter: 'Plant Type Flags',
    values: ['Graminoid'],
  },
  {
    keywords: ['herb', 'herbs'],
    filter: 'Plant Type Flags',
    values: ['Herb'],
  },
  
  // Flower Color
  {
    keywords: ['yellow', 'yellow flowers'],
    filter: 'Flower Color Flags',
    values: ['Yellow'],
  },
  {
    keywords: ['red', 'red flowers'],
    filter: 'Flower Color Flags',
    values: ['Red'],
  },
  {
    keywords: ['purple', 'purple flowers', 'violet'],
    filter: 'Flower Color Flags',
    values: ['Purple'],
  },
  {
    keywords: ['orange', 'orange flowers'],
    filter: 'Flower Color Flags',
    values: ['Orange'],
  },
  {
    keywords: ['pink', 'pink flowers'],
    filter: 'Flower Color Flags',
    values: ['Pink'],
  },
  {
    keywords: ['white', 'white flowers'],
    filter: 'Flower Color Flags',
    values: ['White'],
  },
  {
    keywords: ['blue', 'blue flowers'],
    filter: 'Flower Color Flags',
    values: ['Blue'],
  },
  
  // Other filters
  {
    keywords: ['showy', 'showy flowers'],
    filter: 'Showy',
    values: ['Showy'],
  },
  {
    keywords: ['super plant', 'superplant'],
    filter: 'Superplant',
    values: ['Super Plant'],
  },
  
  // States
  {
    keywords: ['alabama', 'al', 'al native', 'alabama native'],
    filter: 'States',
    values: ['AL'],
  },
  {
    keywords: ['alaska', 'ak', 'ak native', 'alaska native'],
    filter: 'States',
    values: ['AK'],
  },
  {
    keywords: ['arizona', 'az', 'az native', 'arizona native'],
    filter: 'States',
    values: ['AZ'],
  },
  {
    keywords: ['arkansas', 'ar', 'ar native', 'arkansas native'],
    filter: 'States',
    values: ['AR'],
  },
  {
    keywords: ['california', 'ca', 'ca native', 'california native'],
    filter: 'States',
    values: ['CA'],
  },
  {
    keywords: ['colorado', 'co', 'co native', 'colorado native'],
    filter: 'States',
    values: ['CO'],
  },
  {
    keywords: ['connecticut', 'ct', 'ct native', 'connecticut native'],
    filter: 'States',
    values: ['CT'],
  },
  {
    keywords: ['delaware', 'de', 'de native', 'delaware native'],
    filter: 'States',
    values: ['DE'],
  },
  {
    keywords: ['district of columbia', 'dc', 'dc native', 'district of columbia native', 'washington dc', 'washington d.c.'],
    filter: 'States',
    values: ['DC'],
  },
  {
    keywords: ['florida', 'fl', 'fl native', 'florida native'],
    filter: 'States',
    values: ['FL'],
  },
  {
    keywords: ['georgia', 'ga', 'ga native', 'georgia native'],
    filter: 'States',
    values: ['GA'],
  },
  {
    keywords: ['hawaii', 'hi', 'hi native', 'hawaii native'],
    filter: 'States',
    values: ['HI'],
  },
  {
    keywords: ['idaho', 'id', 'id native', 'idaho native'],
    filter: 'States',
    values: ['ID'],
  },
  {
    keywords: ['illinois', 'il', 'il native', 'illinois native'],
    filter: 'States',
    values: ['IL'],
  },
  {
    keywords: ['indiana', 'in', 'in native', 'indiana native'],
    filter: 'States',
    values: ['IN'],
  },
  {
    keywords: ['iowa', 'ia', 'ia native', 'iowa native'],
    filter: 'States',
    values: ['IA'],
  },
  {
    keywords: ['kansas', 'ks', 'ks native', 'kansas native'],
    filter: 'States',
    values: ['KS'],
  },
  {
    keywords: ['kentucky', 'ky', 'ky native', 'kentucky native'],
    filter: 'States',
    values: ['KY'],
  },
  {
    keywords: ['louisiana', 'la', 'la native', 'louisiana native'],
    filter: 'States',
    values: ['LA'],
  },
  {
    keywords: ['maine', 'me', 'me native', 'maine native'],
    filter: 'States',
    values: ['ME'],
  },
  {
    keywords: ['maryland', 'md', 'md native', 'maryland native'],
    filter: 'States',
    values: ['MD'],
  },
  {
    keywords: ['massachusetts', 'ma', 'ma native', 'massachusetts native'],
    filter: 'States',
    values: ['MA'],
  },
  {
    keywords: ['michigan', 'mi', 'mi native', 'michigan native'],
    filter: 'States',
    values: ['MI'],
  },
  {
    keywords: ['minnesota', 'mn', 'mn native', 'minnesota native'],
    filter: 'States',
    values: ['MN'],
  },
  {
    keywords: ['mississippi', 'ms', 'ms native', 'mississippi native'],
    filter: 'States',
    values: ['MS'],
  },
  {
    keywords: ['missouri', 'mo', 'mo native', 'missouri native'],
    filter: 'States',
    values: ['MO'],
  },
  {
    keywords: ['montana', 'mt', 'mt native', 'montana native'],
    filter: 'States',
    values: ['MT'],
  },
  {
    keywords: ['nebraska', 'ne', 'ne native', 'nebraska native'],
    filter: 'States',
    values: ['NE'],
  },
  {
    keywords: ['nevada', 'nv', 'nv native', 'nevada native'],
    filter: 'States',
    values: ['NV'],
  },
  {
    keywords: ['new hampshire', 'nh', 'nh native', 'new hampshire native'],
    filter: 'States',
    values: ['NH'],
  },
  {
    keywords: ['new jersey', 'nj', 'nj native', 'new jersey native'],
    filter: 'States',
    values: ['NJ'],
  },
  {
    keywords: ['new mexico', 'nm', 'nm native', 'new mexico native'],
    filter: 'States',
    values: ['NM'],
  },
  {
    keywords: ['new york', 'ny', 'ny native', 'new york native'],
    filter: 'States',
    values: ['NY'],
  },
  {
    keywords: ['north carolina', 'nc', 'nc native', 'north carolina native'],
    filter: 'States',
    values: ['NC'],
  },
  {
    keywords: ['north dakota', 'nd', 'nd native', 'north dakota native'],
    filter: 'States',
    values: ['ND'],
  },
  {
    keywords: ['ohio', 'oh', 'oh native', 'ohio native'],
    filter: 'States',
    values: ['OH'],
  },
  {
    keywords: ['oklahoma', 'ok', 'ok native', 'oklahoma native'],
    filter: 'States',
    values: ['OK'],
  },
  {
    keywords: ['oregon', 'or', 'or native', 'oregon native'],
    filter: 'States',
    values: ['OR'],
  },
  {
    keywords: ['pennsylvania', 'pa', 'pa native', 'pennsylvania native'],
    filter: 'States',
    values: ['PA'],
  },
  {
    keywords: ['rhode island', 'ri', 'ri native', 'rhode island native'],
    filter: 'States',
    values: ['RI'],
  },
  {
    keywords: ['south carolina', 'sc', 'sc native', 'south carolina native'],
    filter: 'States',
    values: ['SC'],
  },
  {
    keywords: ['south dakota', 'sd', 'sd native', 'south dakota native'],
    filter: 'States',
    values: ['SD'],
  },
  {
    keywords: ['tennessee', 'tn', 'tn native', 'tennessee native'],
    filter: 'States',
    values: ['TN'],
  },
  {
    keywords: ['texas', 'tx', 'tx native', 'texas native'],
    filter: 'States',
    values: ['TX'],
  },
  {
    keywords: ['utah', 'ut', 'ut native', 'utah native'],
    filter: 'States',
    values: ['UT'],
  },
  {
    keywords: ['vermont', 'vt', 'vt native', 'vermont native'],
    filter: 'States',
    values: ['VT'],
  },
  {
    keywords: ['virginia', 'va', 'va native', 'virginia native'],
    filter: 'States',
    values: ['VA'],
  },
  {
    keywords: ['washington', 'wa', 'wa native', 'washington native'],
    filter: 'States',
    values: ['WA'],
  },
  {
    keywords: ['west virginia', 'wv', 'wv native', 'west virginia native'],
    filter: 'States',
    values: ['WV'],
  },
  {
    keywords: ['wisconsin', 'wi', 'wi native', 'wisconsin native'],
    filter: 'States',
    values: ['WI'],
  },
  {
    keywords: ['wyoming', 'wy', 'wy native', 'wyoming native'],
    filter: 'States',
    values: ['WY'],
  },
  
  // Availability
  {
    keywords: ['local', 'local store', 'local nursery', 'nearby', 'near me', 'in store', 'brick and mortar'],
    filter: 'Availability Flags',
    values: ['Local'],
  },
  {
    keywords: ['online', 'online store', 'buy online', 'order online', 'shipping', 'delivery', 'ecommerce'],
    filter: 'Availability Flags',
    values: ['Online'],
  },
];

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse natural language query and extract filter values
 * Also returns the remaining query text after removing matched keywords
 * @param {string} query - Natural language search query
 * @returns {Object} - { filters: Object with filter names as keys, remainingQuery: string }
 */
function parseNaturalLanguageQuery(query) {
  if (!query || typeof query !== 'string') {
    return { filters: {}, remainingQuery: '' };
  }
  
  const queryLower = query.toLowerCase().trim();
  const extractedFilters = {};
  const matchedKeywords = [];
  
  // Sort keywords by length (longest first) to match phrases before single words
  const sortedMappings = [...keywordMappings].sort((a, b) => {
    const aMaxLen = Math.max(...a.keywords.map(k => k.length));
    const bMaxLen = Math.max(...b.keywords.map(k => k.length));
    return bMaxLen - aMaxLen;
  });
  
  // Try to match keywords (phrases first, then words)
  for (const mapping of sortedMappings) {
    for (const keyword of mapping.keywords) {
      const keywordLower = keyword.toLowerCase();
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');
      if (regex.test(queryLower)) {
        // Check if this keyword hasn't already been matched
        // (avoid matching "shade" when "part shade" was already matched)
        const alreadyMatched = matchedKeywords.some(mk => {
          const mkLower = mk.toLowerCase();
          return queryLower.includes(mkLower) && 
                 (mkLower.includes(keywordLower) || keywordLower.includes(mkLower));
        });
        
        if (!alreadyMatched) {
          if (!extractedFilters[mapping.filter]) {
            extractedFilters[mapping.filter] = [];
          }
          // Add values that aren't already in the array
          mapping.values.forEach(value => {
            if (!extractedFilters[mapping.filter].includes(value)) {
              extractedFilters[mapping.filter].push(value);
            }
          });
          matchedKeywords.push(keyword);
        }
      }
    }
  }
  
  // Remove matched keywords from the query to get remaining text
  let remainingQuery = query;
  for (const keyword of matchedKeywords) {
    // Remove the keyword (case-insensitive) from remaining query
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
    remainingQuery = remainingQuery.replace(regex, '').trim();
  }
  // Clean up extra spaces
  remainingQuery = remainingQuery.replace(/\s+/g, ' ').trim();
  
  return {
    filters: extractedFilters,
    remainingQuery: remainingQuery,
  };
}

module.exports = {
  keywordMappings,
  parseNaturalLanguageQuery,
};






