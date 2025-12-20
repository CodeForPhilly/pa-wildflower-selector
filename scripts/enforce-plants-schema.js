#!/usr/bin/env node
/**
 * Enforce MongoDB schema for plants collection.
 *
 * Guarantees these invariants at the DB layer:
 * - "Height (feet)" exists and is numeric
 * - "Spread (feet)" exists and is numeric
 *
 * This is intentionally strict to avoid "bandaid" parsing logic in app code.
 */

require("dotenv").config();
const { MongoClient } = require("mongodb");

// Keep connection logic consistent with lib/db.js
const {
  // Docker environment variables (from docker-compose.yml)
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_DATABASE,
  MONGODB_DOCKER_PORT,
  MONGODB_LOCAL_PORT,
  // Traditional environment variables
  DB_HOST,
  DB_PORT,
  DB_NAME = "pa-wildflower-selector",
  DB_USER,
  DB_PASSWORD,
} = process.env;

const host = DB_HOST === "localhost" ? "localhost" : DB_HOST || "mongodb";
function toPort(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}
const port =
  host === "localhost"
    ? (toPort(DB_PORT) ?? toPort(MONGODB_LOCAL_PORT) ?? 27017)
    : (toPort(MONGODB_DOCKER_PORT) ?? toPort(DB_PORT) ?? 27017);

const dbName = MONGODB_DATABASE || DB_NAME;
const user = MONGODB_USER || DB_USER;
const password = MONGODB_PASSWORD || DB_PASSWORD;

const credentials = user ? `${user}:${password}@` : "";
const authSource = user ? "?authSource=admin" : "";
const uriWithAuth = `mongodb://${credentials}${host}:${port}${authSource}`;
const uriWithoutAuth = `mongodb://${host}:${port}`;

async function connectMongo() {
  let client;
  let uri = user ? uriWithAuth : uriWithoutAuth;

  // Prefer auth if credentials are supplied, but allow local dev fallback without auth.
  if (user) {
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
      await client.connect();
      await client.db(dbName).admin().ping();
      return client;
    } catch (error) {
      const msg = (error && error.message ? error.message : "").toLowerCase();
      const isAuthError =
        msg.includes("authentication") ||
        msg.includes("auth") ||
        error.code === 18 ||
        error.code === 8000;
      const isLocalhost = host === "localhost";
      if (isLocalhost && isAuthError) {
        console.log("⚠️  Auth failed; retrying without authentication for local development...");
        await client.close();
        uri = uriWithoutAuth;
        client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        await client.db(dbName).admin().ping();
        return client;
      }
      throw error;
    }
  }

  client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  await client.db(dbName).admin().ping();
  return client;
}

async function main() {
  console.log(`Connecting to MongoDB at ${host}:${port}/${dbName} ${user ? "with authentication" : "without authentication"}`);
  const client = await connectMongo();
  try {
    const db = client.db(dbName);

    // Apply JSON Schema validation for app-used fields (clean data, no bandaids)
    const command = {
      collMod: "plants",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: [
            "Height (feet)",
            "Spread (feet)",
            "Recommendation Score",
            "Showy",
            "Superplant",
            "States",
            "Genus",
            "Family",
            "Sun Exposure Flags",
            "Soil Moisture Flags",
            "Plant Type Flags",
            "Life Cycle Flags",
            "Pollinator Flags",
            "Flower Color Flags",
            "Availability Flags",
            "Flowering Months By Number",
          ],
          properties: {
            "Height (feet)": {
              bsonType: ["int", "long", "double", "decimal"],
              minimum: 0,
              description: "Required numeric height in feet",
            },
            "Spread (feet)": {
              bsonType: ["int", "long", "double", "decimal"],
              minimum: 0,
              description: "Required numeric spread in feet",
            },
            "Recommendation Score": {
              bsonType: ["int", "long"],
              minimum: 0,
              description: "Required integer recommendation score",
            },
            "Showy": {
              bsonType: "bool",
              description: "Required boolean flag",
            },
            "Superplant": {
              bsonType: "bool",
              description: "Required boolean flag",
            },
            "States": {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            "Genus": {
              bsonType: "string",
            },
            "Family": {
              bsonType: "string",
            },
            "Sun Exposure Flags": {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            "Soil Moisture Flags": {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            "Plant Type Flags": {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            "Life Cycle Flags": {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            "Pollinator Flags": {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            "Flower Color Flags": {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            "Availability Flags": {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            "Flowering Months By Number": {
              bsonType: "array",
              items: { bsonType: ["int", "long", "double", "decimal"] },
            },
          },
        },
      },
      validationLevel: "strict",
      validationAction: "error",
    };

    const result = await db.command(command);
    console.log("✅ plants schema validation applied.");
    if (result && result.ok !== undefined) {
      console.log(`Result ok=${result.ok}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("❌ Failed to enforce plants schema validation.");
  console.error(err);
  process.exit(1);
});


