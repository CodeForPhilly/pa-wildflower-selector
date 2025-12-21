#!/usr/bin/env node
/**
 * Build an OpenAI Batch JSONL file for height/spread extraction (Responses API).
 *
 * This writes:
 * - a JSONL file (one request per plant)
 * - a mapping JSON (custom_id -> plant info) to use when applying results
 *
 * Usage:
 *   node scripts/tmp-build-height-spread-batch.js --out db_backups/height-spread-batch.jsonl
 *   node scripts/tmp-build-height-spread-batch.js --out db_backups/height-spread-batch.jsonl --web=1
 *   node scripts/tmp-build-height-spread-batch.js --ids-file db_backups/tmp-height-spread-nulls.txt --limit 200
 *   node scripts/tmp-build-height-spread-batch.js --start-after "Aconitum columbianum" --limit 500
 *   node scripts/tmp-build-height-spread-batch.js --policy scripts/height-spread-source-policy.json
 *
 * Notes:
 * - Batch is asynchronous and cheaper; you upload the JSONL to OpenAI, create a batch, then download the output JSONL.
 * - We keep the prompt/schema compact to reduce token cost.
 */

require("dotenv").config({ override: true });

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("../lib/db");

const DEFAULT_OUT = "db_backups/tmp-height-spread-batch.jsonl";
const DEFAULT_MAP = "db_backups/tmp-height-spread-batch-map.json";
const DEFAULT_META = "db_backups/tmp-height-spread-batch-meta.json";
const DEFAULT_CHECKPOINT = "db_backups/tmp-height-spread-checkpoint.json";
const DEFAULT_STATE = "db_backups/tmp-height-spread-state.json";
const DEFAULT_POLICY = "scripts/height-spread-source-policy.json";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, vRaw] = a.slice(2).split("=");
    const next = vRaw === undefined ? argv[i + 1] : vRaw;
    const hasInline = vRaw !== undefined;
    const value = next && !next.startsWith("--") ? next : "true";
    args[k] = value;
    if (!hasInline && value !== "true") i++;
  }
  return args;
}

function toBool(v, def = false) {
  if (v === undefined) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return def;
}

function toInt(v, def) {
  if (v === undefined) return def;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : def;
}

function safeMkdirp(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadState(statePath) {
  try {
    if (!statePath) return null;
    if (!fs.existsSync(statePath)) return null;
    const raw = fs.readFileSync(statePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadCheckpoint(checkpointPath) {
  try {
    if (!checkpointPath) return { done: {}, errors: {} };
    if (!fs.existsSync(checkpointPath)) return { done: {}, errors: {} };
    const raw = fs.readFileSync(checkpointPath, "utf8");
    const json = JSON.parse(raw);
    return { done: json.done || {}, errors: json.errors || {} };
  } catch {
    return { done: {}, errors: {} };
  }
}

function sha1_8(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 8);
}

function makeCustomId(scientificName) {
  // Keep it readable but safe-ish and short.
  const base = String(scientificName)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "");
  const short = base.slice(0, 45);
  return `plant-${short}-${sha1_8(scientificName)}`; // <= ~64 chars typical
}

function parseDomainList(v) {
  if (!v) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parsePatternList(v) {
  if (!v) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeDomains(v) {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  }
  return parseDomainList(v);
}

function normalizePatterns(v) {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map((s) => String(s).trim()).filter(Boolean);
  }
  return parsePatternList(v);
}

function loadPolicy(policyPath) {
  if (!policyPath) return null;
  const abs = path.resolve(String(policyPath));
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse policy JSON at ${policyPath}: ${e && e.message ? e.message : e}`);
  }
}

function formatDomainList(domains) {
  if (!domains || !domains.length) return "(none)";
  return domains.join(", ");
}

function buildCompactPrompt({
  scientificName,
  commonName,
  useWeb,
  allowDomains,
  blockDomains,
  preferredDomains,
  blockUrlPatterns,
  requireAllowedSource,
}) {
  const sourcesRule = (() => {
    if (!useWeb) {
      return (
        "Do NOT invent or guess URLs. " +
        "Since web search is disabled, set sources to an empty array and set height_feet and spread_feet to null."
      );
    }

    const allow = allowDomains && allowDomains.length ? `Allowed domains: ${formatDomainList(allowDomains)}. ` : "";
    const block = blockDomains && blockDomains.length ? `Blocked domains: ${formatDomainList(blockDomains)}. ` : "";
    const prefer =
      preferredDomains && preferredDomains.length
        ? `Prefer sources in this order (highest authority first): ${formatDomainList(preferredDomains)}. `
        : "";
    const blockPatterns =
      blockUrlPatterns && blockUrlPatterns.length
        ? `Avoid URLs matching these substrings (retail/SEO patterns): ${blockUrlPatterns.join(", ")}. `
        : "";
    const requireAllowed = requireAllowedSource
      ? "If you cannot find an allowed-domain URL that clearly supports BOTH values, set height_feet and spread_feet to null and sources to an empty array."
      : "If you cannot find a good URL, you may return nulls with an empty sources array.";

    return (
      "Include AT MOST one http(s) URL in sources. " +
      allow +
      block +
      prefer +
      blockPatterns +
      "Never cite blocked domains. " +
      "Do not use general gardening blogs, content farms, retailer product pages, or community Q&A as sources for numeric mature size. " +
      requireAllowed
    );
  })();

  const system =
    "Return ONLY JSON matching the schema. " +
    "Goal: typical mature HEIGHT and SPREAD in FEET for residential landscape cultivation (not max wild size). " +
    "No ranges; pick ONE typical value (midpoint ok). Convert metric to feet. " +
    "If <=5 ft, use 0.5-ft steps. " +
    sourcesRule;

  const user =
    `Plant: ${scientificName}` +
    (commonName ? ` (${commonName})` : "") +
    "\nProvide typical mature height_feet and spread_feet.";

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      height_feet: { type: ["number", "null"] },
      spread_feet: { type: ["number", "null"] },
      // Allow empty array so we can enforce allow/deny lists without forcing hallucinated URLs.
      sources: { type: "array", minItems: 0, maxItems: 1, items: { type: "string" } },
    },
    required: ["height_feet", "spread_feet", "sources"],
  };

  return { system, user, schema };
}

async function main() {
  const args = parseArgs(process.argv);

  const outPath = args.out || DEFAULT_OUT;
  const mapPath = args.map || DEFAULT_MAP;
  const metaPath = args.meta || DEFAULT_META;

  const model = args.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const useWeb = toBool(args.web, true);
  const limit = toInt(args.limit, 0);
  const statePath = args.state || DEFAULT_STATE;
  const resume = toBool(args.resume, true);
  const priorState = resume ? loadState(statePath) : null;
  const startAfter =
    args["start-after"] ||
    (priorState && (priorState.lastWrittenId || priorState.lastId)) ||
    null;

  // Optional list of plant IDs/scientific names
  let idsList = null;
  if (args["ids-file"]) {
    const p = String(args["ids-file"]);
    idsList = fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Optionally skip those already completed in a checkpoint
  const checkpointPath = args.checkpoint || DEFAULT_CHECKPOINT;
  const skipCheckpointDone = toBool(args["skip-checkpoint-done"], false);
  const checkpoint = skipCheckpointDone ? loadCheckpoint(checkpointPath) : { done: {}, errors: {} };

  // Source policy: load from JSON (default) and allow CLI overrides
  const policyPath = args.policy || process.env.HEIGHT_SPREAD_SOURCE_POLICY || DEFAULT_POLICY;
  const policy = loadPolicy(policyPath) || {};

  const hasCli = (k) => Object.prototype.hasOwnProperty.call(args, k);
  const allowDomains = hasCli("allow-domains") ? parseDomainList(args["allow-domains"]) : normalizeDomains(policy.allow_domains);
  const blockDomains = hasCli("block-domains") ? parseDomainList(args["block-domains"]) : normalizeDomains(policy.block_domains);
  const preferredDomains = hasCli("preferred-domains")
    ? parseDomainList(args["preferred-domains"])
    : normalizeDomains(policy.preferred_domains);
  const blockUrlPatterns = hasCli("block-url-patterns")
    ? parsePatternList(args["block-url-patterns"])
    : normalizePatterns(policy.block_url_patterns);
  const requireAllowedSource = hasCli("require-allowed-source")
    ? toBool(args["require-allowed-source"], true)
    : toBool(policy.require_allowed_source, true);

  const { plants, close } = await db();
  try {
    safeMkdirp(outPath);
    safeMkdirp(mapPath);
    safeMkdirp(metaPath);

    const map = {};
    const out = fs.createWriteStream(outPath, { flags: "w" });

    let count = 0;
    let skipped = 0;

    async function writeOne({ id, scientificName, commonName }) {
      if (skipCheckpointDone && checkpoint.done[id]) {
        skipped++;
        return;
      }
      if (limit && count >= limit) return;

      const customId = makeCustomId(scientificName);
      map[customId] = { id, scientificName, commonName };

      const { system, user, schema } = buildCompactPrompt({
        scientificName,
        commonName,
        useWeb,
        allowDomains,
        blockDomains,
        preferredDomains,
        blockUrlPatterns,
        requireAllowedSource,
      });

      const body = {
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
        text: {
          format: {
            type: "json_schema",
            name: "plant_dimensions",
            schema,
            strict: true,
          },
        },
        metadata: {
          plant_id: id,
          scientific_name: scientificName,
        },
      };

      if (useWeb) {
        body.tools = [{ type: "web_search_preview" }];
      }

      // Batch JSONL record format: custom_id + method + url + body
      const rec = {
        custom_id: customId,
        method: "POST",
        url: "/v1/responses",
        body,
      };

      out.write(JSON.stringify(rec) + "\n");
      count++;
    }

    if (idsList && idsList.length) {
      // Deterministic order, exactly matching the provided list (minus optional startAfter filtering)
      let effectiveIds = idsList;
      if (startAfter) {
        effectiveIds = idsList.filter((id) => String(id).localeCompare(String(startAfter)) > 0);
      }
      for (const id of effectiveIds) {
        if (limit && count >= limit) break;
        // Try to enrich from DB, but still emit a request even if missing
        const plant = await plants.findOne(
          { _id: id },
          { projection: { _id: 1, "Scientific Name": 1, "Common Name": 1 } }
        );
        const scientificName = (plant && plant["Scientific Name"]) || id;
        const commonName = (plant && plant["Common Name"]) || "";
        // eslint-disable-next-line no-await-in-loop
        await writeOne({ id, scientificName, commonName });
      }
    } else {
      const query = {};
      if (startAfter) {
        query._id = query._id || {};
        query._id.$gt = startAfter;
      }

      const cursor = plants
        .find(query, {
          projection: {
            _id: 1,
            "Scientific Name": 1,
            "Common Name": 1,
          },
        })
        .sort({ _id: 1 });

      while (await cursor.hasNext()) {
        const plant = await cursor.next();
        const id = plant._id;
        const scientificName = plant["Scientific Name"] || id;
        const commonName = plant["Common Name"] || "";
        // eslint-disable-next-line no-await-in-loop
        await writeOne({ id, scientificName, commonName });
        if (limit && count >= limit) break;
      }
    }

    out.end();
    fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          outPath,
          mapPath,
          model,
          useWeb,
          policyPath: fs.existsSync(path.resolve(String(policyPath))) ? policyPath : null,
          allowDomains,
          blockDomains,
          preferredDomains,
          blockUrlPatterns,
          requireAllowedSource,
          limit,
          startAfter,
          statePath: resume ? statePath : null,
          resume,
          idsFile: args["ids-file"] || null,
          skipCheckpointDone,
          checkpointPath: skipCheckpointDone ? checkpointPath : null,
          count,
          skipped,
        },
        null,
        2
      )
    );

    console.log("✅ Batch input built.");
    console.log(`Requests: ${count}`);
    if (skipCheckpointDone) console.log(`Skipped (already in checkpoint): ${skipped}`);
    console.log(`JSONL: ${outPath}`);
    console.log(`Map: ${mapPath}`);
    console.log(`Meta: ${metaPath}`);
    console.log(`Endpoint: /v1/responses`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err && err.message ? err.message : err);
  process.exit(1);
});


