#!/usr/bin/env node
require("dotenv").config();

const crypto = require("crypto");
const { Client: PostgresClient } = require("pg");
const zipcodes = require("zipcodes");
const connectMongo = require("../lib/db");
const {
  ACTIVE_SYNC_ID,
  assertPlausibleCounts,
  normalizeScientificName,
  toFiniteNumber,
  validCoordinates,
} = require("../lib/plantagents-data");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const connectionString = String(process.env.PLANTAGENTS_DATABASE_URL || "").trim();
const maxUnmatchedRatio = Number(process.env.PLANTAGENTS_MAX_UNMATCHED_RATIO || 0.2);
const lockMinutes = Number(process.env.PLANTAGENTS_SYNC_LOCK_MINUTES || 60);
const snapshotId = `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${crypto.randomBytes(4).toString("hex")}`;
const startedAt = new Date();
let mongo;
let postgres;
let lockAcquired = false;
let summary = { snapshotId, status: "failed", dryRun, sourceCounts: {}, publishedCounts: {}, unmatchedCount: 0 };

function requireConfiguration() {
  if (!connectionString) throw new Error("PLANTAGENTS_DATABASE_URL is required");
  if (!Number.isFinite(maxUnmatchedRatio) || maxUnmatchedRatio < 0 || maxUnmatchedRatio > 1) {
    throw new Error("PLANTAGENTS_MAX_UNMATCHED_RATIO must be between 0 and 1");
  }
}

async function querySource() {
  const vendors = await postgres.query(`SELECT id, name, website_url, email, phone, display_address,
    state_or_region, latitude, longitude, sales_model, updated_at FROM vendors`);
  const plants = await postgres.query(`SELECT id, scientific_name, common_name FROM plants`);
  const offerings = await postgres.query(`SELECT vendor_id, nursery_snapshot_id, plant_id, snapshot_status,
    published_at, approved_at, snapshot_created_at FROM vendor_current_plant_offerings`);
  const zipCodes = await postgres.query(`SELECT zip_code, city, state_or_region, latitude, longitude, updated_at
    FROM zip_code_geographies`);
  return { vendors: vendors.rows, plants: plants.rows, offerings: offerings.rows, zipCodes: zipCodes.rows };
}

function uniqueBy(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    const value = String(row[key] || "");
    if (!value || seen.has(value)) throw new Error(`${label} has a missing or duplicate ${key}: ${value || "<empty>"}`);
    seen.add(value);
  }
}

async function buildDocuments(source) {
  uniqueBy(source.vendors, "id", "vendors");
  uniqueBy(source.plants, "id", "plants");
  uniqueBy(source.zipCodes, "zip_code", "zip codes");

  const invalidVendor = source.vendors.find((row) =>
    (row.latitude !== null || row.longitude !== null) && !validCoordinates(row.latitude, row.longitude));
  if (invalidVendor) throw new Error(`vendor ${invalidVendor.id} has invalid coordinates`);
  const invalidZip = source.zipCodes.find((row) =>
    !/^\d{5}$/.test(String(row.zip_code)) || !validCoordinates(row.latitude, row.longitude));
  if (invalidZip) throw new Error(`ZIP ${invalidZip.zip_code} is invalid`);

  const localPlants = await mongo.plants.find({}, {
    projection: { _id: 1, "Scientific Name": 1, "Scientific Name Synonyms": 1, Synonyms: 1, aliases: 1 },
  }).toArray();
  const localByName = new Map();
  const addName = (name, id) => {
    const normalized = normalizeScientificName(name);
    if (!normalized) return;
    const ids = localByName.get(normalized) || new Set();
    ids.add(String(id));
    localByName.set(normalized, ids);
  };
  for (const plant of localPlants) {
    addName(plant["Scientific Name"], plant._id);
    for (const field of [plant["Scientific Name Synonyms"], plant.Synonyms, plant.aliases]) {
      const values = Array.isArray(field) ? field : typeof field === "string" ? field.split(/[;,|]/) : [];
      for (const value of values) addName(value, plant._id);
    }
  }

  const sourcePlantMap = new Map();
  const unmatched = [];
  const ambiguous = [];
  for (const plant of source.plants) {
    const ids = [...(localByName.get(normalizeScientificName(plant.scientific_name)) || [])];
    if (ids.length === 1) sourcePlantMap.set(String(plant.id), ids[0]);
    else if (ids.length === 0) unmatched.push(plant);
    else ambiguous.push({ ...plant, localPlantIds: ids });
  }
  const unmatchedRatio = (unmatched.length + ambiguous.length) / source.plants.length;
  if (!force && unmatchedRatio > maxUnmatchedRatio) {
    throw new Error(`unmatched/ambiguous plant ratio ${(unmatchedRatio * 100).toFixed(1)}% exceeds ${(maxUnmatchedRatio * 100).toFixed(1)}%`);
  }

  const vendorIds = new Set(source.vendors.map((row) => String(row.id)));
  const nurseries = source.vendors.map((row) => ({
    snapshotId, plantagentsVendorId: String(row.id), name: row.name,
    websiteUrl: row.website_url, email: row.email, phone: row.phone,
    displayAddress: row.display_address, stateOrRegion: row.state_or_region,
    latitude: toFiniteNumber(row.latitude), longitude: toFiniteNumber(row.longitude),
    location: validCoordinates(row.latitude, row.longitude)
      ? { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] } : null,
    salesModel: row.sales_model, sourceUpdatedAt: row.updated_at, syncedAt: startedAt,
  }));
  const nurseryOfferingsByKey = new Map();
  for (const row of source.offerings) {
    const vendorId = String(row.vendor_id);
    if (!vendorIds.has(vendorId)) throw new Error(`offering references missing vendor ${vendorId}`);
    const localPlantId = sourcePlantMap.get(String(row.plant_id));
    if (!localPlantId) continue;
    nurseryOfferingsByKey.set(`${vendorId}:${localPlantId}`, {
      snapshotId, plantagentsVendorId: vendorId, plantagentsPlantId: String(row.plant_id),
      localPlantId, nurserySnapshotId: String(row.nursery_snapshot_id),
      snapshotStatus: row.snapshot_status, publishedAt: row.published_at,
      approvedAt: row.approved_at, snapshotCreatedAt: row.snapshot_created_at,
    });
  }
  const nurseryOfferings = [...nurseryOfferingsByKey.values()];
  const zipCodeGeographies = source.zipCodes.map((row) => {
    const fallback = zipcodes.lookup(String(row.zip_code));
    return {
    snapshotId, zipCode: String(row.zip_code), city: row.city || (fallback && fallback.city) || null,
    stateOrRegion: row.state_or_region || (fallback && fallback.state) || null,
    latitude: Number(row.latitude), longitude: Number(row.longitude),
    location: { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] },
    sourceUpdatedAt: row.updated_at,
    metadataSource: row.city && row.state_or_region ? "plantagents" : fallback ? "zipcodes-8.0.0" : null,
  }; });
  return { nurseries, nurseryOfferings, zipCodeGeographies, unmatched, ambiguous };
}

async function insertBatches(collection, rows) {
  for (let offset = 0; offset < rows.length; offset += 1000) {
    await collection.insertMany(rows.slice(offset, offset + 1000), { ordered: false });
  }
}

async function publish(documents, sourceCounts) {
  await Promise.all([
    insertBatches(mongo.nurseries, documents.nurseries),
    insertBatches(mongo.nurseryOfferings, documents.nurseryOfferings),
    insertBatches(mongo.zipCodeGeographies, documents.zipCodeGeographies),
  ]);
  await Promise.all([
    mongo.nurseries.createIndex(
      { snapshotId: 1, plantagentsVendorId: 1 },
      { unique: true, partialFilterExpression: { snapshotId: { $exists: true } } }
    ),
    mongo.nurseries.createIndex({ snapshotId: 1, stateOrRegion: 1 }),
    mongo.nurseries.createIndex({ location: "2dsphere" }),
    mongo.nurseryOfferings.createIndex({ snapshotId: 1, localPlantId: 1, plantagentsVendorId: 1 }, { unique: true }),
    mongo.zipCodeGeographies.createIndex({ snapshotId: 1, zipCode: 1 }, { unique: true }),
    mongo.zipCodeGeographies.createIndex({ location: "2dsphere" }),
  ]);
  await mongo.syncState.updateOne({ _id: ACTIVE_SYNC_ID }, { $set: {
    activeSnapshotId: snapshotId, previousSnapshotId: summary.previousSnapshotId || null,
    sourceCounts, publishedCounts: summary.publishedCounts, unmatchedCount: summary.unmatchedCount,
    ambiguousCount: documents.ambiguous.length, syncedAt: new Date(), status: "success",
  } }, { upsert: true });

  const keep = [snapshotId, summary.previousSnapshotId].filter(Boolean);
  await Promise.all([
    mongo.nurseries.deleteMany({ snapshotId: { $nin: keep } }),
    mongo.nurseryOfferings.deleteMany({ snapshotId: { $nin: keep } }),
    mongo.zipCodeGeographies.deleteMany({ snapshotId: { $nin: keep } }),
  ]);
}

async function main() {
  requireConfiguration();
  mongo = await connectMongo();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lockMinutes * 60 * 1000);
  let lock;
  try {
    lock = await mongo.syncState.findOneAndUpdate(
      { _id: "plantagents-lock", $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { $set: { owner: snapshotId, acquiredAt: now, expiresAt } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if (error && error.code === 11000) throw new Error("another PlantAgents sync is already running");
    throw error;
  }
  if (!lock.value || lock.value.owner !== snapshotId) throw new Error("another PlantAgents sync is already running");
  lockAcquired = true;

  const active = await mongo.syncState.findOne({ _id: ACTIVE_SYNC_ID });
  summary.previousSnapshotId = active && active.activeSnapshotId;
  postgres = new PostgresClient({ connectionString, application_name: "choose-native-plants-sync" });
  await postgres.connect();
  await postgres.query("BEGIN READ ONLY");
  const source = await querySource();
  const sourceCounts = {
    vendors: source.vendors.length, sourcePlants: source.plants.length,
    sourceOfferings: source.offerings.length, zipCodes: source.zipCodes.length,
  };
  summary.sourceCounts = sourceCounts;
  assertPlausibleCounts(sourceCounts, active && active.sourceCounts, { force });
  const documents = await buildDocuments(source);
  summary.unmatchedCount = documents.unmatched.length + documents.ambiguous.length;
  summary.publishedCounts = {
    vendors: documents.nurseries.length, offerings: documents.nurseryOfferings.length,
    zipCodes: documents.zipCodeGeographies.length,
  };
  if (!documents.nurseryOfferings.length) throw new Error("no matched offerings are available to publish");
  if (!dryRun) await publish(documents, sourceCounts);
  summary.status = dryRun ? "validated" : "published";
}

main().catch((error) => {
  summary.error = error.message;
  process.exitCode = 1;
}).finally(async () => {
  if (postgres) await postgres.end().catch(() => {});
  if (mongo) {
    if (lockAcquired) await mongo.syncState.deleteOne({ _id: "plantagents-lock", owner: snapshotId }).catch(() => {});
    await mongo.close().catch(() => {});
  }
  summary.durationMs = Date.now() - startedAt.getTime();
  console.log(JSON.stringify(summary));
});
