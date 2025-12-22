require("dotenv").config();
const express = require("express");
const fs = require("fs");
const quote = require("regexp-quote");
const path = require("path");
const { generateEmbedding, cosineSimilarity } = require("./embeddings");
const { parseNaturalLanguageQuery } = require("./keyword-mappings");

// Check if SSR build exists (production/Docker mode) or if we're in dev mode
const isDevelopment = process.env.NODE_ENV === "development" || !fs.existsSync(path.join(__dirname, "../ssr/ssr-manifest.json"));
let manifest = {};
let renderer = null;

if (!isDevelopment) {
  try {
    manifest = require("../ssr/ssr-manifest.json");
    const appPath = path.join(__dirname, "../ssr", manifest["app.js"]);
    renderer = require(appPath).default;
    
    // Override global.fetch AFTER SSR bundle loads to fix malformed URLs
    // The SSR bundle sets its own fetch that prepends localhost:3000 to HuggingFace URLs
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
    
    // Override on both global and globalThis to ensure it's caught
    global.fetch = fixedFetch;
    if (typeof globalThis !== 'undefined') {
      globalThis.fetch = fixedFetch;
    }
  } catch (e) {
    console.warn("SSR build not found, running in development mode");
  }
}

const pageSize = 20;
const versionFile = `${__dirname}/../version.txt`;
const version = fs.existsSync(versionFile)
  ? fs.readFileSync(versionFile, "utf8")
  : "0";
const axios = require("axios");

// Disabled for now because it causes confusion when we update the data
// const cache = {};

module.exports = async function ({ plants, nurseries }) {
  const port = process.env.PORT || 3000;
  const app = express();
  const publicDir = `${__dirname}/../public`;
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  app.use(express.static(publicDir));
  
  // Handle images directory - works for both Docker (/app/images) and local (./images)
  const imagesDir = path.join(__dirname, "../images");
  if (fs.existsSync(imagesDir)) {
    app.use("/images", express.static(imagesDir));
  }

  // Resolve plant image based on the requested mode, with graceful fallback.
  // This avoids client-side 404 handling for background images and centralizes
  // the mapping between habitat (images/) and studio (images/studio_full/).
  //
  // Usage:
  //  - /api/v1/plant-image/:id?mode=habitat&preview=1
  //  - /api/v1/plant-image/:id?mode=studio&preview=0
  app.get("/api/v1/plant-image/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "");
      // Basic traversal protection (allow spaces/etc, but disallow path tricks)
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return res.status(400).json({ error: "Invalid plant id" });
      }

      const mode = String(req.query.mode || "habitat") === "studio" ? "studio" : "habitat";
      const preview = String(req.query.preview || "0") === "1";

      const studioDir = path.join(imagesDir, "studio_full");
      /** @type {string[]} */
      const candidatePaths = [];

      if (mode === "studio") {
        // Studio images are generated with the same stem as the input (often the plant _id).
        // Support multiple formats since the generator can be configured.
        candidatePaths.push(
          path.join(studioDir, `${id}.webp`),
          path.join(studioDir, `${id}.jpg`),
          path.join(studioDir, `${id}.jpeg`),
          path.join(studioDir, `${id}.png`)
        );
      } else {
        // Habitat photos live at the root of /images
        if (preview) {
          candidatePaths.push(
            path.join(imagesDir, `${id}.preview.jpg`),
            path.join(imagesDir, `${id}.jpg`)
          );
        } else {
          candidatePaths.push(path.join(imagesDir, `${id}.jpg`));
        }
      }

      let chosen = null;
      for (const p of candidatePaths) {
        if (p && fs.existsSync(p)) {
          chosen = p;
          break;
        }
      }

      if (chosen) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.sendFile(chosen);
      }

      // Fallback to the public missing image asset
      const missing = path.join(publicDir, "assets", "images", "missing-image.png");
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.sendFile(missing);
    } catch (e) {
      console.error("error in /api/v1/plant-image:", e);
      return res.status(500).json({ error: "Failed to resolve plant image" });
    }
  });
  
  app.use(express.json());

  app.post("/get-vendors", async (req, res) => {
    try {
      if (!req.body.zipCode) {
        return res.status(400).json({ error: "zipCode is required" });
      }
      if (!req.body.plantName) {
        return res.status(400).json({ error: "plantName is required" });
      }
      const baseUrl = (process.env.PAC_API_BASE_URL || "").trim();
      const apiKey = (process.env.PAC_API_KEY || "").trim();
      const url = `${baseUrl}/Plant/FindVendorsForPlantName`;
      let response = await axios.get(url, {
        headers: { Authorization: "Bearer " + apiKey },
        params: { plantName: req.body.plantName, zipCode: req.body.zipCode, radius: req.body.radius, limit: 5}
      });
      return res.send(response.data);
    } catch (error) {
      console.error("Error in /get-vendors:", error.response?.data || error.message);
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data;
      // If errorData is already an object, send it directly; otherwise wrap in error property
      if (errorData && typeof errorData === 'object') {
        return res.status(statusCode).json(errorData);
      }
      return res.status(statusCode).json({ 
        error: errorData || error.message || "Internal server error"
      });
    }
  });
  app.post("/get-city", async (req, res) => {
    try {
      if (!req.body.zipCode) {
        return res.status(400).json({ error: "zipCode is required" });
      }
      const baseUrl = (process.env.PAC_API_BASE_URL || "").trim();
      const apiKey = (process.env.PAC_API_KEY || "").trim();
      const url = `${baseUrl}/vendor/FindCity`;
      let response = await axios.get(url, {
        headers: { Authorization: "Bearer " + apiKey },
        params: {zipCode: req.body.zipCode}
      });
      return res.send(response.data);
    } catch (error) {
      console.error("Error in /get-city:", error.response?.data || error.message);
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data;
      // If errorData is already an object, send it directly; otherwise wrap in error property
      if (errorData && typeof errorData === 'object') {
        return res.status(statusCode).json(errorData);
      }
      return res.status(statusCode).json({ 
        error: errorData || error.message || "Internal server error"
      });
    }
  });
  app.post("/get-zip", async (req, res) => {
    try {
      if (!req.body.latitude || !req.body.longitude) {
        return res.status(400).json({ error: "latitude and longitude are required" });
      }
      const baseUrl = (process.env.PAC_API_BASE_URL || "").trim();
      const apiKey = (process.env.PAC_API_KEY || "").trim();
      const url = `${baseUrl}/vendor/FindZip`;
      let response = await axios.get(url, {
        headers: { Authorization: "Bearer " + apiKey },
        params: {lat: req.body.latitude, lng: req.body.longitude}
      });
      return res.send(response.data);
    } catch (error) {
      console.error("Error in /get-zip:", error.response?.data || error.message);
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data;
      // If errorData is already an object, send it directly; otherwise wrap in error property
      if (errorData && typeof errorData === 'object') {
        return res.status(statusCode).json(errorData);
      }
      return res.status(statusCode).json({ 
        error: errorData || error.message || "Internal server error"
      });
    }
  });
  app.get("/api/v1/autocomplete", async (req, res) => {
    try {
      const query = req.query.q || "";
      if (query && query.length > 200) {
        return res.status(400).json({ error: "Query too long" });
      }
      if (!query || query.length < 2) {
        return res.json({ query, sections: [] });
      }

      const queryLower = query.toLowerCase();
      const queryRegex = new RegExp(queryLower, 'i');
      const sections = [];

      // Search Genus
      const genusValues = await plants.distinct("Genus");
      const matchingGenus = genusValues
        .filter(value => value && queryRegex.test(value))
        .slice(0, 10);

      if (matchingGenus.length > 0) {
        sections.push({
          type: "filter",
          filterName: "Genus",
          label: "Genus",
          items: matchingGenus.map(value => ({
            value: value,
            displayText: value,
            action: "applyFilter",
            filterName: "Genus",
            filterValue: value
          }))
        });
      }

      // Search Family
      const familyValues = await plants.distinct("Family");
      const matchingFamily = familyValues
        .filter(value => value && queryRegex.test(value))
        .slice(0, 10);

      if (matchingFamily.length > 0) {
        sections.push({
          type: "filter",
          filterName: "Family",
          label: "Family",
          items: matchingFamily.map(value => ({
            value: value,
            displayText: value,
            action: "applyFilter",
            filterName: "Family",
            filterValue: value
          }))
        });
      }

      // Search Soil Moisture Flags
      const soilMoistureValues = await plants.distinct("Soil Moisture Flags");
      const matchingSoilMoisture = soilMoistureValues
        .filter(value => value && queryRegex.test(value))
        .slice(0, 10);

      if (matchingSoilMoisture.length > 0) {
        sections.push({
          type: "filter",
          filterName: "Soil Moisture Flags",
          label: "Soil Moisture",
          items: matchingSoilMoisture.map(value => ({
            value: value,
            displayText: value,
            action: "applyFilter",
            filterName: "Soil Moisture Flags",
            filterValue: value,
            svg: value
          }))
        });
      }

      // Search Sun Exposure Flags
      const sunExposureValues = await plants.distinct("Sun Exposure Flags");
      const matchingSunExposure = sunExposureValues
        .filter(value => value && queryRegex.test(value))
        .slice(0, 10);

      if (matchingSunExposure.length > 0) {
        sections.push({
          type: "filter",
          filterName: "Sun Exposure Flags",
          label: "Sun Exposure",
          items: matchingSunExposure.map(value => ({
            value: value,
            displayText: value,
            action: "applyFilter",
            filterName: "Sun Exposure Flags",
            filterValue: value,
            svg: value
          }))
        });
      }

      // Search Plants by Common Name and Scientific Name (kept last so filters are shown first)
      const plantsByCommonName = await plants.find({
        "Common Name": queryRegex
      })
      .sort({ "Recommendation Score": -1 })
      .limit(10)
      .toArray();

      const plantsByScientificName = await plants.find({
        "Scientific Name": queryRegex
      })
      .sort({ "Recommendation Score": -1 })
      .limit(10)
      .toArray();

      // Combine and deduplicate plant results
      const plantMap = new Map();
      plantsByCommonName.forEach(plant => {
        plantMap.set(plant._id, {
          plantId: plant._id,
          commonName: plant["Common Name"],
          scientificName: plant["Scientific Name"],
          displayText: plant["Common Name"],
          subtitle: plant["Scientific Name"],
          action: "navigateToPlant"
        });
      });
      plantsByScientificName.forEach(plant => {
        if (!plantMap.has(plant._id)) {
          plantMap.set(plant._id, {
            plantId: plant._id,
            commonName: plant["Common Name"],
            scientificName: plant["Scientific Name"],
            displayText: plant["Common Name"],
            subtitle: plant["Scientific Name"],
            action: "navigateToPlant"
          });
        }
      });

      if (plantMap.size > 0) {
        sections.push({
          type: "plant",
          label: "Plant",
          items: Array.from(plantMap.values())
        });
      }

      res.json({ query, sections });
    } catch (error) {
      console.error("Autocomplete error:", error);
      res.status(500).json({ error: "Autocomplete search failed" });
    }
  });
  app.get("/api/v1/plants", async (req, res) => {
    try {
      const fetchResults = req.query.results !== "0";
      const fetchTotal = req.query.total !== "0";
      const query = {};
      const sorts = {
        "Sort by Common Name (A-Z)": {
          "Common Name": 1,
        },
        "Sort by Common Name (Z-A)": {
          "Common Name": -1,
        },
        "Sort by Scientific Name (A-Z)": {
          "Scientific Name": 1,
        },
        "Sort by Scientific Name (Z-A)": {
          "Scientific Name": -1,
        },
        "Sort by Recommendation Score": {
          "Recommendation Score": -1,
          "Common Name": 1,
        },
        "Sort by Search Relevance": {
          "_semanticScore": -1,
          "Common Name": 1,
        },
        "Sort by Flower Color": {
          "Flower Color": 1,
        },
        "Sort by Height (Shortest First)": {
          "Height (feet)": 1,
        },
        "Sort by Height (Tallest First)": {
          "Height (feet)": -1,
        },
        "Sort by Spread (Thinnest First)": {
          "Spread (feet)": 1,
        },
        "Sort by Spread (Widest First)": {
          "Spread (feet)": -1,
        },
        "Sort by Soil Moisture (Dry to Wet)": {
          "Soil Moisture Flags": 1,
        },
        "Sort by Soil Moisture (Wet to Dry)": {
          "Soil Moisture Flags": -1,
        },
      };
      let sort = sorts[req.query.sort]
        ? sorts[req.query.sort]
        : Object.values(sorts)[0];
      // Store the original sort preference before it might be overridden
      const originalSort = { ...sort };
      const originalSortKeys = Object.keys(sort);
      // Always avoid shipping large fields to the browser for list endpoints
      // (embedding is used server-side for semantic search only).
      let projection = { embedding: 0 };
      let page = parseInt(req.query.page);
      if (isNaN(page) || page < 1) {
        page = 1;
      }
      if (req.query.q && req.query.q.length) {
        if (req.query.q.length > 200) {
          return res.status(400).json({ error: "Query too long" });
        }
        // Parse natural language to extract trigger words and set filters
        const { filters: extractedFilters, remainingQuery } = parseNaturalLanguageQuery(req.query.q);
        
        // Merge extracted filters with existing query params (don't override)
        for (const [filterName, values] of Object.entries(extractedFilters)) {
          if (values && values.length > 0) {
            const existing = req.query[filterName];
            if (existing) {
              // Merge arrays, avoiding duplicates
              const existingArray = Array.isArray(existing) ? existing : [existing];
              const merged = [...new Set([...existingArray, ...values])];
              req.query[filterName] = merged;
            } else {
              req.query[filterName] = values;
            }
          }
        }
        
        // Only use semantic search if there's remaining query text after removing trigger words
        if (remainingQuery && remainingQuery.length > 0) {
          // Use semantic search for the remaining text
          try {
            console.log('Using semantic search for remaining query:', remainingQuery);
            console.log('Extracted filters from trigger words:', extractedFilters);
            
            // Generate embedding for the remaining query
            const queryEmbedding = await generateEmbedding(remainingQuery);
            
            // Store for later processing
            query._useSemantic = true;
            query._queryEmbedding = queryEmbedding;
            query._searchTerm = remainingQuery;
            query._originalSort = originalSort; // Store original sort for semantic search
            query._originalSortKeys = originalSortKeys; // Store original sort keys for semantic search
            
            // Only override sort if user hasn't explicitly chosen a sort
            // If they chose "Sort by Recommendation Score", we'll respect that in semantic search
            if (!req.query.sort || req.query.sort === "Sort by Recommendation Score") {
              // Keep the original sort (Recommendation Score) for semantic search
              // We'll apply it after calculating semantic scores
            } else {
              // For other sorts, use semantic score
              sort = { _semanticScore: -1 };
            }
            
          } catch (error) {
            console.error('Error in semantic search, falling back to regex:', error);
            // Fall through to regex search
            const searchRegex = new RegExp(remainingQuery, 'i');
            query.$or = [
              { 'Common Name': searchRegex },
              { 'Scientific Name': searchRegex }
            ];
          }
        } else {
          // Only trigger words matched, no semantic search needed
          console.log('Only trigger words found, using filter-based search only');
          console.log('Extracted filters:', extractedFilters);
          // Don't set _useSemantic, so it will just filter by the chips
        }
      }
      // Get max height from "Height (feet)" field
      const heightDoc = (
        await plants
          .find({})
          .project({ "Height (feet)": 1 })
          .sort({ "Height (feet)": -1 })
          .limit(1)
          .toArray()
      )[0];
      let maxHeight = 0;
      if (heightDoc && typeof heightDoc["Height (feet)"] === "number") {
        maxHeight = Math.ceil(heightDoc["Height (feet)"]);
      }
      const heights = [];
      for (let i = 0; i <= maxHeight; i++) {
        heights.push(i);
      }
      // Get max spread from "Spread (feet)" field
      const spreadDoc = (
        await plants
          .find({})
          .project({ "Spread (feet)": 1 })
          .sort({ "Spread (feet)": -1 })
          .limit(1)
          .toArray()
      )[0];
      let maxSpread = 0;
      if (spreadDoc && typeof spreadDoc["Spread (feet)"] === "number") {
        maxSpread = Math.floor(spreadDoc["Spread (feet)"]);
      }
      const spreads = [];
      for (let i = 0; i <= maxSpread; i++) {
        spreads.push(i);
      }
      const filters = [
        {
          name: "States",
          value: [],
          array: true,
        },
        {
          name: "Genus",
          value: [],
          array: true,
          unwind: false,
        },
        {
          name: "Family",
          value: [],
          array: true,
          unwind: false,
        },
        {
          name: "Sun Exposure Flags",
          value: [],
          array: true,
        },
        {
          name: "Soil Moisture Flags",
          value: [],
          array: true,
        },
        {
          name: "Plant Type Flags",
          value: [],
          array: true,
        },
        {
          name: "Life Cycle Flags",
          value: [],
          array: true,
        },
        {
          name: "Pollinator Flags",
          value: [],
          ignore: ["Wind"],
          array: true,
        },
        {
          name: "Superplant",
          choices: ["Super Plant"],
          value: [],
          boolean: true,
        },
        {
          name: "Flower Color Flags",
          value: [],
          array: true,
        },
        {
          name: "Availability Flags",
          value: [],
          array: true,
        },
        {
          name: "Flowering Months",
          range: true,
          byNumber: "Flowering Months By Number",
          choices: [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
          ],
          value: [],
        },
        {
          name: "Height (feet)",
          range: true,
          choices: heights,
          value: [],
        },
        {
          name: "Spread (feet)",
          range: true,
          choices: spreads,
          value: [],
        },
        {
          name: "Showy",
          choices: ["Showy"],
          value: [],
          boolean: true,
        },
      ];
      const $and = [];
      for (const filter of filters) {
        if (filter.range) {
          const min = parseInt(req.query?.[filter.name]?.min);
          const max = parseInt(req.query?.[filter.name]?.max);
          // Ignore invalid queries. Also ignore when the range is all possible values,
          // which is currently the only way to include plants for which there is
          // no flowering months data
          if (
            !isNaN(min) &&
            !isNaN(max) &&
            min <= max &&
            (min !== 0 || max !== filter.choices.length - 1)
          ) {
            // For filters with byNumber (like Flowering Months), use $in with array
            // For numeric range filters (like Height, Spread), use range query with $gte and $lte
            if (filter.byNumber) {
              const $in = [];
              for (let i = min; i <= max; i++) {
                $in.push(i);
              }
              if ($in.length) {
                $and.push({
                  [filter.byNumber]: {
                    $in,
                  },
                });
              }
            } else {
              // For "Height (feet)" and "Spread (feet)", query the numeric field directly with range
              const fieldName = filter.name;
              $and.push({
                [fieldName]: {
                  $gte: min,
                  $lte: max
                }
              });
            }
          }
        } else if (filter.boolean) {
          // For frontend convenience it arrives as an array, but
          // we only care if it has an element or not
          let input = req.query[filter.name] || [];
          if (input && input.length) {
            $and.push({
              [filter.name]: true,
            });
          }
        } else if (filter.array) {
          const input = req.query[filter.name] || [];
          const array = Array.isArray(input) ? input : [input];
          const values = array.map((value) => value.toString());
          if (values.length) {
            $and.push({
              [filter.name]: {
                $in: values,
              },
            });
          }
        } else {
          const input = req.query[filter.name] || [];
          const array = Array.isArray(input) ? input : [input];
          const values = array.map((value) => value.toString());
          const $or = values
            .map(
              (value) =>
                new RegExp(`(?:^|;|,)\\s*${quote(value)}\\s*(?:;|,|$)`, "i")
            )
            .map((value) => ({
              [filter.name]: value,
            }));
          if ($or.length) {
            $and.push({
              $or,
            });
          }
        }
      }
      // If we are sorting by a field we should not return results for which
      // its value is unknown, it's too confusing
      // Skip this for semantic search as _semanticScore is computed, not stored
      if (!query._useSemantic) {
        Object.keys(sort).forEach((key) => {
          $and.push({
            [key]: {
              $exists: 1,
            },
          });
        });
      }
      if (Array.isArray(req.query.favorites)) {
        $and.push({
          _id: {
            $in: req.query.favorites.map((v) =>
              typeof v == "string" ? v : ""
            ),
          },
        });
      }
      // Handle semantic search differently
      let results, total;
      let scoredResults = null; // Store semantic search results for filter count calculation
      
      if (query._useSemantic && query._queryEmbedding) {
        // Semantic search: fetch candidates, calculate similarity in JS
        const baseQuery = { embedding: { $exists: true, $ne: null } };
        if ($and.length > 0) {
          baseQuery.$and = $and;
        }
        
        // Fetch all candidates (we'll calculate similarity and sort in JS)
        // For performance, we might want to limit this, but for now get all matching filters
        const candidates = await plants.find(baseQuery).toArray();
        console.log(`Semantic search: Found ${candidates.length} candidates with embeddings`);
        
        // Calculate similarity scores
        const queryEmbedding = query._queryEmbedding;
        const originalSort = query._originalSort || {};
        const originalSortKeys = query._originalSortKeys || [];
        scoredResults = candidates
          .map(plant => {
            if (!plant.embedding || !Array.isArray(plant.embedding)) {
              return null;
            }
            const similarity = cosineSimilarity(queryEmbedding, plant.embedding);
            return {
              ...plant,
              _semanticScore: similarity
            };
          })
          .filter(plant => {
            if (!plant || plant._semanticScore < 0.3) {
              return false;
            }
            return true;
          }) // Minimum similarity threshold
          .sort((a, b) => {
            // If user wants to sort by Search Relevance, prioritize semantic score
            if (originalSortKeys.includes("_semanticScore") || req.query.sort === "Sort by Search Relevance") {
              // Sort by semantic score first
              if (b._semanticScore !== a._semanticScore) {
                return b._semanticScore - a._semanticScore;
              }
              // Then Common Name as tiebreaker
              if (originalSortKeys.includes("Common Name")) {
                const nameA = a["Common Name"] || "";
                const nameB = b["Common Name"] || "";
                if (nameA !== nameB) {
                  return originalSort["Common Name"] === -1 
                    ? (nameB > nameA ? 1 : -1)
                    : (nameA > nameB ? 1 : -1);
                }
              }
              return 0;
            }
            // If user wants to sort by Recommendation Score, prioritize that
            if (originalSortKeys.includes("Recommendation Score")) {
              const scoreA = a["Recommendation Score"] || 0;
              const scoreB = b["Recommendation Score"] || 0;
              if (scoreB !== scoreA) {
                return originalSort["Recommendation Score"] === -1 ? scoreB - scoreA : scoreA - scoreB;
              }
              // If scores are equal, use semantic score as tiebreaker, then Common Name
              if (b._semanticScore !== a._semanticScore) {
                return b._semanticScore - a._semanticScore;
              }
              // Then Common Name if specified
              if (originalSortKeys.includes("Common Name")) {
                const nameA = a["Common Name"] || "";
                const nameB = b["Common Name"] || "";
                if (nameA !== nameB) {
                  return originalSort["Common Name"] === -1 
                    ? (nameB > nameA ? 1 : -1)
                    : (nameA > nameB ? 1 : -1);
                }
              }
              return 0;
            }
            // Otherwise, sort by semantic score first
            if (b._semanticScore !== a._semanticScore) {
              return b._semanticScore - a._semanticScore;
            }
            // Then apply the original sort as tiebreaker
            for (const key of originalSortKeys) {
              const valA = a[key];
              const valB = b[key];
              if (valA !== valB) {
                const direction = originalSort[key];
                if (direction === -1) {
                  return valB > valA ? 1 : -1;
                } else {
                  return valA > valB ? 1 : -1;
                }
              }
            }
            return 0;
          });
        
        total = fetchTotal ? scoredResults.length : undefined;
        
        // Apply pagination
        if (fetchResults) {
          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          results = scoredResults.slice(start, end);
        } else {
          results = undefined;
        }
      } else {
        // Regular query-based search
        if ($and.length > 0) {
          query.$and = $and;
        }
        total = fetchTotal && (await plants.countDocuments(query));
        const qb = plants.find(query);
        if (projection) {
          qb.project(projection);
        }
        if (!req.query.favorites) {
          qb.skip((page - 1) * pageSize);
          qb.limit(pageSize);
        }
        results = fetchResults && (await qb.sort(sort).toArray());
      }
      if (!req.query.favorites) {
        // For semantic search, calculate counts from the matched results
        // For regular search, calculate counts from database queries
        if (query._useSemantic && scoredResults) {
          // Calculate filter counts from semantic search results
          for (const filter of filters) {
            if (filter.array) {
              const countsMap = new Map();
              // Count occurrences of each filter value in the semantic search results
              for (const plant of scoredResults) {
                const filterValues = plant[filter.name];
                if (Array.isArray(filterValues)) {
                  for (const value of filterValues) {
                    countsMap.set(value, (countsMap.get(value) || 0) + 1);
                  }
                } else if (filterValues) {
                  countsMap.set(filterValues, (countsMap.get(filterValues) || 0) + 1);
                }
              }
              // Convert to array format expected by frontend
              filter.counts = Array.from(countsMap.entries()).map(([value, count]) => ({
                _id: value,
                count: count
              }));
            } else if (filter.boolean) {
              // Count boolean filters
              let trueCount = 0;
              for (const plant of scoredResults) {
                if (plant[filter.name] === true) {
                  trueCount++;
                }
              }
              filter.counts = [{
                _id: filter.choices[0],
                count: trueCount
              }];
            }
            // Populate filter.choices from counts if not already set
            if (!filter.choices) {
              if (filter.counts) {
                // Avoid redundant query
                filter.choices = filter.counts.map((count) => count._id);
                filter.choices.sort();
              } else {
                if (filter.byNumber) {
                  filter.choices = (
                    await plants.distinct(filter.byNumber)
                  ).filter((choice) => typeof choice === "number");
                } else {
                  filter.choices = (await plants.distinct(filter.name)).filter(
                    (choice) => typeof choice === "string" && choice.length
                  );
                }
              }
            }
          }
        } else {
          // Regular query-based filter count calculation
          for (const filter of filters) {
            if (filter.array) {
              const matchQuery = { ...query };
              // Handle semantic search queries which don't have $and
              if (query._useSemantic) {
                // For semantic search, we need to build the match query differently
                // Remove the semantic search metadata
                delete matchQuery._useSemantic;
                delete matchQuery._queryEmbedding;
                delete matchQuery._searchTerm;
                // Add $and if it exists, otherwise create empty object
                if ($and.length > 0) {
                  const filteredAnd = $and.filter(
                    (clause) => clause[filter.name] === undefined
                  );
                  if (filteredAnd.length > 0) {
                    matchQuery.$and = filteredAnd;
                  }
                }
              } else {
                // Regular query - handle $and if it exists
                if (query.$and && query.$and.length > 0) {
                  const filteredAnd = query.$and.filter(
                    (clause) => clause[filter.name] === undefined
                  );
                  if (filteredAnd.length > 0) {
                    matchQuery.$and = filteredAnd;
                  }
                }
              }
              const aQuery = [
                {
                  $match: matchQuery,
                },
              ];
              // Some "array" filters are represented as scalar strings in MongoDB (e.g. Genus/Family).
              // Only unwind when the field is actually an array.
              if (filter.unwind !== false) {
                aQuery.push({
                  $unwind: `$${filter.name}`,
                });
              }
              aQuery.push({
                $group: {
                  _id: `$${filter.name}`,
                  count: { $sum: 1 },
                },
              });
              filter.counts = await plants.aggregate(aQuery).toArray();
            } else if (filter.boolean) {
              const matchQuery = { ...query };
              // Handle semantic search queries which don't have $and
              if (query._useSemantic) {
                // For semantic search, we need to build the match query differently
                // Remove the semantic search metadata
                delete matchQuery._useSemantic;
                delete matchQuery._queryEmbedding;
                delete matchQuery._searchTerm;
                // Add $and if it exists, otherwise create empty object
                if ($and.length > 0) {
                  const filteredAnd = $and.filter(
                    (clause) => clause[filter.name] === undefined
                  );
                  if (filteredAnd.length > 0) {
                    matchQuery.$and = filteredAnd;
                  }
                }
              } else {
                // Regular query - handle $and if it exists
                if (query.$and && query.$and.length > 0) {
                  const filteredAnd = query.$and.filter(
                    (clause) => clause[filter.name] === undefined
                  );
                  if (filteredAnd.length > 0) {
                    matchQuery.$and = filteredAnd;
                  }
                }
              }
              filter.counts = await plants
                .aggregate([
                  {
                    $match: matchQuery,
                  },
                  {
                    $group: {
                      _id: `$${filter.name}`,
                      count: {
                        $sum: 1,
                      },
                    },
                  },
                ])
                .toArray();
              const trueChoice = filter.counts.find((count) => !!count._id);
              if (trueChoice) {
                trueChoice._id = filter.choices[0];
              } else {
                filter.counts.push({
                  _id: filter.choices[0],
                  count: 0,
                });
              }
            }
            // Populate filter.choices from counts if not already set
            if (!filter.choices) {
              if (filter.counts) {
                // Avoid redundant query
                filter.choices = filter.counts.map((count) => count._id);
                filter.choices.sort();
              } else {
                if (filter.byNumber) {
                  filter.choices = (
                    await plants.distinct(filter.byNumber)
                  ).filter((choice) => typeof choice === "number");
                } else {
                  filter.choices = (await plants.distinct(filter.name)).filter(
                    (choice) => typeof choice === "string" && choice.length
                  );
                }
              }
            }
          }
        }
      }
      // Helper function to build filter query excluding a specific filter
      const buildFilterQueryExcluding = (excludeFilterName) => {
        const matchAnd = [];
        for (const filter of filters) {
          // Skip the excluded filter
          if (filter.name === excludeFilterName) {
            continue;
          }
          
          if (filter.range) {
            const min = parseInt(req.query?.[filter.name]?.min);
            const max = parseInt(req.query?.[filter.name]?.max);
            if (
              !isNaN(min) &&
              !isNaN(max) &&
              min <= max &&
              (min !== 0 || max !== filter.choices.length - 1)
            ) {
              // For filters with byNumber (like Flowering Months), use $in with array
              // For numeric range filters (like Height, Spread), use range query with $gte and $lte
              if (filter.byNumber) {
                const $in = [];
                for (let i = min; i <= max; i++) {
                  $in.push(i);
                }
                if ($in.length) {
                  matchAnd.push({
                    [filter.byNumber]: {
                      $in,
                    },
                  });
                }
              } else {
                // For "Height (feet)" and "Spread (feet)", query the numeric field directly with range
                const fieldName = filter.name;
                matchAnd.push({
                  [fieldName]: {
                    $gte: min,
                    $lte: max
                  }
                });
              }
            }
          } else if (filter.boolean) {
            let input = req.query[filter.name] || [];
            if (input && input.length) {
              matchAnd.push({
                [filter.name]: true,
              });
            }
          } else if (filter.array) {
            let input = req.query[filter.name] || [];
            if (!Array.isArray(input)) {
              input = [input];
            }
            if (input && input.length) {
              matchAnd.push({
                [filter.name]: {
                  $in: input,
                },
              });
            }
          }
        }
        const matchQuery = {};
        if (matchAnd.length > 0) {
          matchQuery.$and = matchAnd;
        }
        return matchQuery;
      };

      // Calculate min/max height from filtered plants (excluding height filter)
      let heightRange = { min: 0, max: 0 };
      if (!req.query.favorites) {
        const heightFilter = filters.find(f => f.name === "Height (feet)");
        if (heightFilter && heightFilter.range) {
          const matchQuery = buildFilterQueryExcluding("Height (feet)");
          
          // For semantic search, use scoredResults if available
          if (query._useSemantic && scoredResults) {
            const allHeights = [];
            for (const plant of scoredResults) {
              const heightValue = plant["Height (feet)"];
              if (heightValue !== undefined && heightValue !== null) {
                // Height is enforced numeric in MongoDB; no string parsing needed
                allHeights.push(heightValue);
              }
            }
            if (allHeights.length > 0) {
              heightRange.min = Math.floor(Math.min(...allHeights));
              heightRange.max = Math.ceil(Math.max(...allHeights));
            }
          } else {
            // Use aggregation to find min/max from filtered plants
            const heightAggregation = await plants.aggregate([
              { $match: matchQuery },
              {
                $group: {
                  _id: null,
                  minHeight: { $min: "$Height (feet)" },
                  maxHeight: { $max: "$Height (feet)" }
                }
              }
            ]).toArray();
            
            if (heightAggregation.length > 0 && heightAggregation[0].minHeight !== null) {
              heightRange.min = Math.floor(heightAggregation[0].minHeight);
              heightRange.max = Math.ceil(heightAggregation[0].maxHeight);
            }
          }
        }
      }

      // Calculate min/max spread from filtered plants (excluding spread filter)
      let spreadRange = { min: 0, max: 0 };
      if (!req.query.favorites) {
        const spreadFilter = filters.find(f => f.name === "Spread (feet)");
        if (spreadFilter && spreadFilter.range) {
          const matchQuery = buildFilterQueryExcluding("Spread (feet)");
          
          // For semantic search, use scoredResults if available
          if (query._useSemantic && scoredResults) {
            const allSpreads = [];
            for (const plant of scoredResults) {
              const spreadValue = plant["Spread (feet)"];
              if (spreadValue !== undefined && spreadValue !== null) {
                // Spread is enforced numeric in MongoDB; no string parsing needed
                allSpreads.push(Math.floor(spreadValue));
              }
            }
            if (allSpreads.length > 0) {
              spreadRange.min = Math.min(...allSpreads);
              spreadRange.max = Math.max(...allSpreads);
            }
          } else {
            // Use aggregation to find min/max from filtered plants using "Spread (feet)"
            const spreadAggregation = await plants.aggregate([
              { $match: matchQuery },
              {
                $group: {
                  _id: null,
                  minSpread: { $min: { $floor: "$Spread (feet)" } },
                  maxSpread: { $max: { $floor: "$Spread (feet)" } }
                }
              }
            ]).toArray();
            
            if (spreadAggregation.length > 0 && spreadAggregation[0].minSpread !== null) {
              spreadRange.min = spreadAggregation[0].minSpread;
              spreadRange.max = spreadAggregation[0].maxSpread;
            }
          }
        }
      }
      
      let response = {
        results,
        total,
      };
      if (!req.query.favorites) {
        response = {
          ...response,
          choices: Object.fromEntries(
            filters.map((filter) => [filter.name, filter.choices])
          ),
          counts: Object.fromEntries(
            filters.map((filter) => [
              filter.name,
              filter.counts &&
                Object.fromEntries(
                  filter.counts.map((item) => [item._id, item.count])
                ),
            ])
          ),
          heightRange: heightRange,
          spreadRange: spreadRange,
        };
      }
      for (const filter of filters) {
        const choices = response.choices && response.choices[filter.name];
        if (choices && filter.ignore) {
          response.choices[filter.name] = choices.filter(
            (choice) => !filter.ignore.includes(choice)
          );
        }
        const counts = response.counts && response.counts[filter.name];
        if (counts && filter.ignore) {
          response.counts[filter.name] = Object.fromEntries(
            Object.entries(counts).filter(
              (value, count) => !filter.ignore.includes(value)
            )
          );
        }
      }
      // setCache(req, response);
      return res.send(response);
    } catch (e) {
      console.error("error in /api/v1/plants:", e);
      return res.status(500).json({ 
        error: e.message || "Internal server error",
        details: process.env.NODE_ENV === 'development' ? e.stack : undefined
      });
    }
  });
  app.get("/api/v1/plants/:name", async (req, res) => {
    const result = await plants.findOne({
      _id: req.params.name,
    });
    if (!result) {
      return res.status(404).send("Not Found");
    } else {
      return res.send(result);
    }
  });
  app.get("/api/v1/nurseries", async (req, res) => {
   
    console.log("PARAMS", req.params)
    const baseUrl = process.env.PAC_API_BASE_URL;
    const apiKey = (process.env.PAC_API_KEY || "").trim();
    const url = `${baseUrl}/Vendor/FindByState`;
    let response = await axios.get(url, {
      headers: { Authorization: "Bearer " + apiKey },
      params: { state: req.query.state }
    });
    return res.send({results: response.data.map(x => {
       return {
        "SOURCE": x.storeName, 
        "Lat": x.lat, 
        "Long": x.lng, 
        "lon": x.lng, 
        "lat": x.lat,
        "PHONE": x.publicPhone,
        "URL": x.storeUrl,
        "ADDRESS": x.address,
        "STATE": x.state,
        "EMAIL": x.publicEmail
       }
    })});
  });
  app.get("*", async (req, res) => {
    // In development mode without SSR, serve a simple HTML that Vue dev server will handle
    if (isDevelopment || !renderer) {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width,initial-scale=1.0">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin="" />
          <link rel="icon" href="/favicon.ico">
          <title>Choose Native Plants (Development)</title>
        </head>
        <body>
          <noscript>
            <strong>We're sorry but this application doesn't work properly without JavaScript enabled. Please enable it to continue.</strong>
          </noscript>
          <div id="app"></div>
          <p style="text-align: center; padding: 20px; color: #666;">
            Development mode: Please ensure Vue dev server is running.
            <br>If you see this message, the Vue dev server may not be running.
            <br>Run: <code>npm run dev:client</code> or <code>npm run dev:local</code>
          </p>
        </body>
      </html>
      `.trim();
      return res.end(html);
    }

    // Production mode with SSR
    const appContent = await renderer({ port, url: req.url });
    const cssLink = manifest["app.css"] ? `<link rel="stylesheet" href="${manifest["app.css"]}?version=${version}" />` : "";
    const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        ${cssLink}
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin="" />
        <link rel="icon" href="/favicon.ico">
        <link rel="icon" href="/assets/images/logo-32x32.png" sizes="32x32" />
        <link rel="icon" href="/assets/images/logo-192x192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/assets/images/logo-192x192.png" />
        <meta name="msapplication-TileImage" content="/assets/images/logo-192x192.png" />
        <meta property="og:title" content="Choose Native Plants" />
        <meta property="og:description" content="Find out which native shrubs, plants and flowers have the right conditions to flourish in your garden." />
        <meta property="og:image" content="https://choosenativeplants.com/assets/images/og-image.png" />
        <meta property="og:url" content="https://choosenativeplants.com/" />
        <meta property="og:site_name" content="Choose Native Plants" />
        <meta name="twitter:image" content="https://choosenativeplants.com/assets/images/twitter-large-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CodeForPhilly" />
        <meta name="twitter:title" content="Choose Native Plants" />
        <meta name="twitter:description" content="Find out which native shrubs, plants and flowers from Pennsylvania have the right conditions to flourish in your garden." />
        <meta name="twitter:image:alt" content="Choose Native Plants logo" />
        <title>Choose Native Plants</title>
      </head>
      <body>
        <noscript>
          <strong>We're sorry but this application doesn't work properly without JavaScript enabled. Please enable it to continue.</strong>
        </noscript>
        <div id="app">${appContent}</div>
        <script src="/js/chunk-vendors.js?version=${version}"></script>
        <script src="/js/app.js?version=${version}"></script>
      </body>
    </html>
    `.trim();
    res.end(html);
  });
  console.log(`Listening on port ${port}`);
  app.listen(port);
  return app;
};

// function hashKey(req) {
//   return JSON.stringify(req.query);
// }

// function getCache(req) {
//   const key = hashKey(req);
//   if (cache[key]) {
//     cache[key].last = Date.now();
//     return cache[key].data;
//   }
// }

// function setCache(req, data) {
//   cache[hashKey(req)] = {
//     last: Date.now(),
//     data
//   };
//   if (Object.keys(cache).length > 100) {
//     const oldest = Object.entries(cache, (a, [key, value]) => {
//       if ((!a) || (value.last < a.last)) {
//         return [key, value];
//       }
//     }, null);
//     if (oldest) {
//       // console.log('Deleting:', oldest[0]);
//       delete cache[oldest[0]];
//     }
//   }
//   // Object.keys(cache).map(key => {
//   //   console.log(`${key} ${cache[key].last}`);
//   // });
// }
