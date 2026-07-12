require("dotenv").config();
const express = require("express");
const fs = require("fs");
const quote = require("regexp-quote");
const path = require("path");
const { generateEmbedding, cosineSimilarity } = require("./embeddings");
const { parseNaturalLanguageQuery } = require("./keyword-mappings");
const { isScannerProbePath } = require("./scanner-probe-paths");
const {
  ACTIVE_SYNC_ID,
  haversineMiles,
  legacyNurseryResult,
  toFiniteNumber,
  validCoordinates,
} = require("./plantagents-data");

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
const crypto = require("crypto");

let googleAccessToken = null;
let googleAccessTokenExpiresAt = 0;

const FEEDBACK_HEADERS = [
  "submitted_at",
  "feedback_type",
  "reason",
  "status",
  "plant_id",
  "common_name",
  "scientific_name",
  "zip_code",
  "display_location",
  "existing_nursery_name",
  "existing_nursery_url",
  "suggested_nursery_name",
  "suggested_nursery_website",
  "plant_catalog_urls",
  "suggested_nursery_address",
  "suggested_nursery_email",
  "suggested_nursery_phone",
  "feedback_notes",
  "contact_email",
  "page_url",
  "user_agent",
];

function normalizePrivateKey(key) {
  return String(key || "").replace(/\\n/g, "\n").trim();
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getGoogleSheetsAccessToken() {
  const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || "").trim();
  const privateKey = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (!clientEmail || !privateKey) {
    throw new Error("Google Sheets credentials are not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  if (googleAccessToken && googleAccessTokenExpiresAt > now + 60) {
    return googleAccessToken;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;

  const response = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  googleAccessToken = response.data.access_token;
  googleAccessTokenExpiresAt = now + Number(response.data.expires_in || 3600);
  return googleAccessToken;
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanUrlLines(value, maxLength) {
  const raw = cleanText(value, maxLength);
  if (!raw) return "";

  return raw
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^https?:\/\//i.test(line)) return line;
      if (/^[^\s]+\.[^\s]+/.test(line)) return `https://${line}`;
      return line;
    })
    .join("\n")
    .slice(0, maxLength);
}

async function appendFeedbackRow(values) {
  const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim();
  const tab = (process.env.GOOGLE_SHEETS_FEEDBACK_TAB || "Feedback").trim();
  if (!spreadsheetId || !tab) {
    throw new Error("Google Sheets feedback destination is not configured");
  }

  const token = await getGoogleSheetsAccessToken();
  const readRange = encodeURIComponent(`${tab}!A:Z`);
  const existing = await axios.get(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${readRange}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const rows = existing.data.values || [];
  if (!rows.length) {
    const headerRange = encodeURIComponent(`${tab}!A1:U1`);
    await axios.put(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}`,
      { values: [FEEDBACK_HEADERS] },
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { valueInputOption: "USER_ENTERED" },
      }
    );
  }
  const nextRow = rows.length ? rows.length + 1 : 2;
  const writeRange = encodeURIComponent(`${tab}!A${nextRow}:U${nextRow}`);

  await axios.put(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}`,
    { values: [values] },
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { valueInputOption: "USER_ENTERED" },
    }
  );
}

// Disabled for now because it causes confusion when we update the data
// const cache = {};

module.exports = async function ({
  plants,
  nurseries,
  nurseryOfferings,
  zipCodeGeographies,
  syncState,
}) {
  // Local development uses SERVER_PORT so Vue can keep PORT for its dev server.
  // Production and Docker continue to use PORT.
  const port = process.env.SERVER_PORT || process.env.PORT || 3000;
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

  app.get("/healthz", (req, res) => res.status(200).send("ok"));

  async function activePlantAgentsSnapshot(res) {
    const state = await syncState.findOne({ _id: ACTIVE_SYNC_ID });
    if (!state || !state.activeSnapshotId) {
      res.status(503).json({ error: "Nursery availability has not been synchronized yet" });
      return null;
    }
    return state;
  }

  app.get("/api/v1/plantagents-sync-status", async (req, res) => {
    const state = await syncState.findOne(
      { _id: ACTIVE_SYNC_ID },
      { projection: { activeSnapshotId: 1, sourceCounts: 1, publishedCounts: 1, unmatchedCount: 1, syncedAt: 1, status: 1 } }
    );
    if (!state) return res.status(503).json({ status: "not-synchronized" });
    return res.json(state);
  });

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

  // Resolve a pasted block of text into plant IDs by exact match on:
  // - _id
  // - Common Name
  // - Scientific Name
  //
  // Notes:
  // - Matching is case-insensitive.
  // - Input may contain extra text; we split into chunks and also extract binomial
  //   scientific names (e.g. "Acer rubrum") from longer lines.
  app.post("/api/v1/plants/resolve-names", async (req, res) => {
    try {
      const text = typeof req.body?.text === "string" ? req.body.text : "";
      if (!text.trim()) {
        return res.status(400).json({ error: "text is required" });
      }

      const MAX_TOKENS = 1000;
      const HEADER_TOKENS = new Set(
        [
          "common name",
          "scientific name",
          "bloom",
          "bloom time",
          "sun",
          "soil",
          "life",
          "life cycle",
          "form",
          "height",
          "spread",
          "notes",
          "additional details",
        ].map((s) => s.toLowerCase())
      );

      const normalize = (s) =>
        String(s || "")
          .trim()
          .replace(/\s+/g, " ")
          .replace(/^[•*\-–—\u2022]+/g, "")
          .replace(/^\(?\s*(?:plant|common name|scientific name)\s*[:\-–—]\s*/i, "")
          .replace(/^["']|["']$/g, "")
          .trim()
          .replace(/\s+/g, " ");

      // Split into chunks by common separators.
      const chunks = text
        .split(/[\n\r\t,;]+/g)
        .map(normalize)
        .filter((s) => s.length > 0);

      // Extract scientific binomials from longer chunks (helps when extra text surrounds names).
      /** @type {string[]} */
      const extractedBinomials = [];
      for (const chunk of chunks) {
        // Match "Genus species" (species can include hyphen).
        const re = /\b([A-Z][a-z]+)\s+([a-z][a-z-]{1,})\b/g;
        let m;
        while ((m = re.exec(chunk)) !== null) {
          extractedBinomials.push(`${m[1]} ${m[2]}`);
        }
      }

      // De-dupe while preserving original casing for UI, but match on normalized form.
      const normalizedToOriginal = new Map();
      for (const raw of [...chunks, ...extractedBinomials]) {
        if (normalizedToOriginal.size >= MAX_TOKENS) break;
        const n = normalize(raw).toLowerCase();
        if (!n) continue;
        if (HEADER_TOKENS.has(n)) continue;
        if (!normalizedToOriginal.has(n)) {
          normalizedToOriginal.set(n, normalize(raw));
        }
      }

      const tokens = Array.from(normalizedToOriginal.values());
      const tokensLower = Array.from(normalizedToOriginal.keys());

      if (!tokens.length) {
        return res.json({
          tokensUsed: 0,
          matchedIds: [],
          matched: [],
          notFound: [],
        });
      }

      // Query candidates in one go.
      const docs = await plants
        .find(
          {
            $or: [
              { _id: { $in: tokens } },
              { "Scientific Name": { $in: tokens } },
              { "Common Name": { $in: tokens } },
            ],
          },
          {
            projection: { _id: 1, "Common Name": 1, "Scientific Name": 1 },
          }
        )
        .collation({ locale: "en", strength: 2 })
        .toArray();

      // Build lookup maps (normalized -> docs).
      const byId = new Map();
      const bySci = new Map();
      const byCommon = new Map();

      const pushMap = (map, key, doc) => {
        if (!key) return;
        const k = normalize(key).toLowerCase();
        if (!k) return;
        const arr = map.get(k) || [];
        arr.push(doc);
        map.set(k, arr);
      };

      for (const d of docs) {
        pushMap(byId, d._id, d);
        pushMap(bySci, d["Scientific Name"], d);
        pushMap(byCommon, d["Common Name"], d);
      }

      /** @type {Set<string>} */
      const matchedIdsSet = new Set();
      /** @type {{_id: string, commonName: string, scientificName: string}[]} */
      const matched = [];
      /** @type {string[]} */
      const notFound = [];
      /** @type {Record<string, string[]>} */
      const ambiguous = {};

      const chooseDeterministic = (arr) => {
        if (!arr || !arr.length) return null;
        // Stable deterministic selection: lowest _id lexicographically
        const sorted = [...arr].sort((a, b) => String(a._id).localeCompare(String(b._id)));
        return sorted[0];
      };

      for (let i = 0; i < tokensLower.length; i++) {
        const tokenKey = tokensLower[i];
        const tokenDisplay = tokens[i];

        const idMatches = byId.get(tokenKey) || [];
        const sciMatches = bySci.get(tokenKey) || [];
        const commonMatches = byCommon.get(tokenKey) || [];

        const candidates = idMatches.length ? idMatches : sciMatches.length ? sciMatches : commonMatches;
        if (!candidates || !candidates.length) {
          notFound.push(tokenDisplay);
          continue;
        }

        if (candidates.length > 1) {
          ambiguous[tokenDisplay] = candidates.map((d) => String(d._id));
        }

        const chosen = chooseDeterministic(candidates);
        if (!chosen) {
          notFound.push(tokenDisplay);
          continue;
        }

        const id = String(chosen._id);
        if (!matchedIdsSet.has(id)) {
          matchedIdsSet.add(id);
          matched.push({
            _id: id,
            commonName: chosen["Common Name"] || "",
            scientificName: chosen["Scientific Name"] || "",
          });
        }
      }

      const response = {
        tokensUsed: tokens.length,
        matchedIds: Array.from(matchedIdsSet),
        matched,
        notFound,
      };

      if (Object.keys(ambiguous).length) {
        response.ambiguous = ambiguous;
      }

      return res.json(response);
    } catch (e) {
      console.error("error in /api/v1/plants/resolve-names:", e);
      return res.status(500).json({
        error: e.message || "Internal server error",
        details: process.env.NODE_ENV === "development" ? e.stack : undefined,
      });
    }
  });

  app.post("/get-vendors", async (req, res) => {
    try {
      const zipCode = String(req.body.zipCode || "").replace(/\D/g, "").slice(0, 5);
      if (!/^\d{5}$/.test(zipCode)) {
        return res.status(400).json({ error: "zipCode is required" });
      }
      if (!req.body.plantName) {
        return res.status(400).json({ error: "plantName is required" });
      }
      const state = await activePlantAgentsSnapshot(res);
      if (!state) return;
      const zip = await zipCodeGeographies.findOne({ snapshotId: state.activeSnapshotId, zipCode });
      if (!zip || !zip.city || !zip.stateOrRegion) {
        return res.status(404).json({ error: "ZIP code location metadata was not found" });
      }
      const radius = Math.min(Math.max(toFiniteNumber(req.body.radius) || 50, 1), 1000);
      const limit = Math.min(Math.max(parseInt(req.body.limit, 10) || 5, 1), 50);
      const offerings = await nurseryOfferings.find(
        { snapshotId: state.activeSnapshotId, localPlantId: String(req.body.plantName) },
        { projection: { plantagentsVendorId: 1 } }
      ).toArray();
      if (!offerings.length) return res.json([]);
      const vendorIds = offerings.map((row) => row.plantagentsVendorId);
      const vendors = await nurseries.find({
        snapshotId: state.activeSnapshotId,
        plantagentsVendorId: { $in: vendorIds },
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [zip.longitude, zip.latitude] },
            $maxDistance: radius * 1609.344,
          },
        },
      }).limit(limit).toArray();
      return res.json(vendors.map((vendor) => ({
        storeName: vendor.name,
        storeUrl: vendor.websiteUrl,
        distance: haversineMiles(
          zip.latitude, zip.longitude, vendor.latitude, vendor.longitude
        ),
      })));
    } catch (error) {
      console.error("Error in /get-vendors:", error.message);
      return res.status(500).json({ error: "Could not find nearby vendors" });
    }
  });

  app.post("/api/v1/feedback/nursery", async (req, res) => {
    try {
      const body = req.body || {};
      if (cleanText(body.websiteUrl, 200)) {
        return res.json({ ok: true });
      }

      const allowedReasons = new Set([
        "Missing nursery",
        "This nursery may not carry this plant",
        "Nursery info is wrong",
      ]);
      const reason = cleanText(body.reason, 80);
      if (!allowedReasons.has(reason)) {
        return res.status(400).json({ error: "feedback type is required" });
      }

      const existingNurseryName = cleanText(body.existingNurseryName, 160);
      const suggestedNurseryName = cleanText(body.suggestedNurseryName, 160);
      if (!existingNurseryName && !suggestedNurseryName) {
        return res.status(400).json({ error: "nursery name is required" });
      }

      const row = [
        new Date().toISOString(),
        "nursery_feedback",
        reason,
        "new",
        cleanText(body.plantId, 180),
        cleanText(body.commonName, 180),
        cleanText(body.scientificName, 180),
        cleanText(body.zipCode, 20),
        cleanText(body.displayLocation, 180),
        existingNurseryName,
        cleanUrlLines(body.existingNurseryUrl, 500),
        suggestedNurseryName,
        cleanUrlLines(body.website, 500),
        cleanUrlLines(body.plantUrls, 1500),
        cleanText(body.address, 300),
        cleanText(body.email, 180),
        cleanText(body.phone, 80),
        cleanText(body.notes, 1000),
        cleanText(body.contactEmail, 180),
        cleanUrlLines(body.pageUrl, 500),
        cleanText(req.get("user-agent"), 500),
      ];

      await appendFeedbackRow(row);
      return res.json({ ok: true });
    } catch (error) {
      console.error(
        "Error in /api/v1/feedback/nursery:",
        error.response?.data || error.message
      );
      if (/not configured/i.test(error.message)) {
        return res.status(503).json({ error: "Feedback is not available right now" });
      }
      return res.status(500).json({ error: "Could not submit feedback" });
    }
  });

  app.post("/get-city", async (req, res) => {
    try {
      const zipCode = String(req.body.zipCode || "").replace(/\D/g, "").slice(0, 5);
      if (!/^\d{5}$/.test(zipCode)) return res.status(400).json({ error: "a valid zipCode is required" });
      const state = await activePlantAgentsSnapshot(res);
      if (!state) return;
      const zip = await zipCodeGeographies.findOne({ snapshotId: state.activeSnapshotId, zipCode });
      if (!zip) return res.status(404).json({ error: "ZIP code was not found" });
      return res.json({ code: zip.zipCode, city: zip.city, state: zip.stateOrRegion });
    } catch (error) {
      console.error("Error in /get-city:", error.message);
      return res.status(500).json({ error: "Could not find that ZIP code" });
    }
  });
  app.post("/get-zip", async (req, res) => {
    try {
      if (!validCoordinates(req.body.latitude, req.body.longitude)) {
        return res.status(400).json({ error: "latitude and longitude are required" });
      }
      const state = await activePlantAgentsSnapshot(res);
      if (!state) return;
      const zip = await zipCodeGeographies.findOne({
        snapshotId: state.activeSnapshotId,
        city: { $type: "string" },
        stateOrRegion: { $type: "string" },
        location: { $near: { $geometry: {
          type: "Point", coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
        } } },
      });
      if (!zip) return res.status(404).json({ error: "No nearby ZIP code was found" });
      return res.json({ code: zip.zipCode, city: zip.city, state: zip.stateOrRegion });
    } catch (error) {
      console.error("Error in /get-zip:", error.message);
      return res.status(500).json({ error: "Could not find a ZIP code for that location" });
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
      // Favorites can arrive as a string when there's only one (?favorites=ID),
      // or as an array when repeated (?favorites=ID1&favorites=ID2).
      const favoritesParam = req.query.favorites;
      const favoritesList = Array.isArray(favoritesParam)
        ? favoritesParam
        : typeof favoritesParam === "string"
          ? [favoritesParam]
          : [];
      if (favoritesList.length) {
        $and.push({
          _id: {
            $in: favoritesList.map((v) => (typeof v == "string" ? v : "")).filter(Boolean),
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
    const state = await activePlantAgentsSnapshot(res);
    if (!state) return;
    const query = { snapshotId: state.activeSnapshotId };
    if (req.query.state) query.stateOrRegion = new RegExp(`^${quote(String(req.query.state))}$`, "i");
    const results = await nurseries.find(query).sort({ name: 1 }).toArray();
    return res.json({ results: results.map(legacyNurseryResult) });
  });
  app.use((req, res, next) => {
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      isScannerProbePath(req.path)
    ) {
      return res.status(404).send("Not Found");
    }
    next();
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
    let appContent = "";
    try {
      appContent = await renderer({ port, url: req.url });
    } catch (error) {
      console.error("SSR render failed; serving empty shell for client hydration:", error);
    }
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
