#!/usr/bin/env node
/**
 * Ensures MongoDB indexes that match the app's query patterns for /api/v1/plants.
 *
 * Also drops the legacy embedding_2dsphere index (not useful for vector embeddings).
 *
 * Safe to re-run.
 */

require("dotenv").config();
const db = require("../lib/db");

async function main() {
  const { plants, close } = await db();
  try {
    const existing = await plants.indexes();

    // Drop the wrong index type for embeddings (2dsphere is for geo, not cosine similarity vectors)
    const embedding2d = existing.find(
      (idx) => idx.name === "embedding_2dsphere" || (idx.key && idx.key.embedding === "2dsphere")
    );
    if (embedding2d) {
      console.log(`Dropping index ${embedding2d.name}...`);
      try {
        await plants.dropIndex(embedding2d.name);
        console.log("Dropped.");
      } catch (e) {
        console.warn(`Could not drop ${embedding2d.name}: ${e.message}`);
      }
    }

    // Sort indexes (used frequently)
    await plants.createIndex({ "Recommendation Score": -1, "Common Name": 1 }, { name: "sort_reco_common" });
    await plants.createIndex({ "Height (feet)": 1, "Common Name": 1 }, { name: "sort_height_asc_common" });
    await plants.createIndex({ "Height (feet)": -1, "Common Name": 1 }, { name: "sort_height_desc_common" });
    await plants.createIndex({ "Spread (feet)": 1, "Common Name": 1 }, { name: "sort_spread_asc_common" });
    await plants.createIndex({ "Spread (feet)": -1, "Common Name": 1 }, { name: "sort_spread_desc_common" });
    await plants.createIndex({ "Flower Color": 1, "Common Name": 1 }, { name: "sort_flower_color_common" });

    // Filter indexes (multikey for array fields)
    await plants.createIndex({ States: 1 }, { name: "filter_states" });
    await plants.createIndex({ Genus: 1 }, { name: "filter_genus" });
    await plants.createIndex({ Family: 1 }, { name: "filter_family" });
    await plants.createIndex({ Superplant: 1 }, { name: "filter_superplant" });
    await plants.createIndex({ Showy: 1 }, { name: "filter_showy" });

    await plants.createIndex({ "Sun Exposure Flags": 1 }, { name: "filter_sun_exposure_flags" });
    await plants.createIndex({ "Soil Moisture Flags": 1 }, { name: "filter_soil_moisture_flags" });
    await plants.createIndex({ "Plant Type Flags": 1 }, { name: "filter_plant_type_flags" });
    await plants.createIndex({ "Life Cycle Flags": 1 }, { name: "filter_life_cycle_flags" });
    await plants.createIndex({ "Pollinator Flags": 1 }, { name: "filter_pollinator_flags" });
    await plants.createIndex({ "Flower Color Flags": 1 }, { name: "filter_flower_color_flags" });
    await plants.createIndex({ "Availability Flags": 1 }, { name: "filter_availability_flags" });

    console.log("✅ plants indexes ensured.");
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("❌ ensure plants indexes failed");
  console.error(err);
  process.exit(1);
});




