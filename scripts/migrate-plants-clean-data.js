#!/usr/bin/env node
/**
 * Cleans up MongoDB plants documents for performance + consistency.
 *
 * Goals (app-used fields):
 * - Ensure certain "Flags" fields always exist as arrays (empty array when unknown)
 * - Ensure Flowering Months By Number always exists as an array (empty when unknown)
 * - Normalize Recommendation Score to an integer (still stored as BSON number)
 *
 * This script is safe to re-run.
 */

require("dotenv").config();
const db = require("../lib/db");

async function main() {
  const { plants, close } = await db();
  try {
    // Normalize missing arrays to []
    const ensureArrayFields = [
      "Soil Moisture Flags",
      "Flowering Months By Number",
    ];

    for (const field of ensureArrayFields) {
      const res = await plants.updateMany(
        { [field]: { $exists: false } },
        { $set: { [field]: [] } }
      );
      if (res.matchedCount || res.modifiedCount) {
        console.log(`Set missing "${field}" to []: matched=${res.matchedCount} modified=${res.modifiedCount}`);
      }
    }

    // Normalize Recommendation Score to an integer value.
    // Stored as BSON Number either way, but keeping it as an int avoids mixed int/double types.
    const scoreRes = await plants.updateMany(
      { "Recommendation Score": { $exists: true } },
      [
        {
          $set: {
            "Recommendation Score": {
              $cond: [
                { $isNumber: "$Recommendation Score" },
                { $toInt: { $round: ["$Recommendation Score", 0] } },
                0,
              ],
            },
          },
        },
      ]
    );
    console.log(
      `Normalized "Recommendation Score" to int: matched=${scoreRes.matchedCount} modified=${scoreRes.modifiedCount}`
    );
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("❌ plants cleanup migration failed");
  console.error(err);
  process.exit(1);
});











































