#!/usr/bin/env node
/**
 * THROWAWAY helper script:
 * - Loops plants in MongoDB (one at a time)
 * - Asks OpenAI for *single* typical height + spread values (feet), optionally web-grounded
 * - Writes a CSV you can paste/import into the Google Sheet
 * - Saves a checkpoint so you can resume safely
 *
 * Usage examples:
 *   node scripts/tmp-fill-height-spread.js --only-missing --limit 50
 *   node scripts/tmp-fill-height-spread.js --start-after "Calamagrostis rubescens" --limit 200 --web=1
 *   node scripts/tmp-fill-height-spread.js --ids-file db_backups/scientific_names.txt
 *   node scripts/tmp-fill-height-spread.js --all --redo-all --reset-csv --out db_backups/tmp-height-spread-full.csv
 *   node scripts/tmp-fill-height-spread.js --all --redo-all --reset-csv --csv-only=1
 *   node scripts/tmp-fill-height-spread.js --fresh=1 --all --redo-all --web=1
 *   node scripts/tmp-fill-height-spread.js --policy scripts/height-spread-source-policy.json --all --web=1
 *
 * Output files (gitignored via db_backups/):
 *   - db_backups/tmp-height-spread.csv
 *   - db_backups/tmp-height-spread-checkpoint.json
 */

// For this throwaway script, prefer the local .env over any existing process env
// (PowerShell sessions can keep old values even after you delete the OS env var).
require("dotenv").config({ override: true });

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { RateLimiter } = require("limiter");
const db = require("../lib/db");

const DEFAULT_OUT = "db_backups/tmp-height-spread.csv";
const DEFAULT_CHECKPOINT = "db_backups/tmp-height-spread-checkpoint.json";
const DEFAULT_STATE = "db_backups/tmp-height-spread-state.json";
const DEFAULT_NULLS_FILE = "db_backups/tmp-height-spread-nulls.txt";
const DEFAULT_ERRORS_FILE = "db_backups/tmp-height-spread-errors.txt";
const DEFAULT_POLICY = "scripts/height-spread-source-policy.json";

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

function saveState(statePath, state) {
  if (!statePath) return;
  safeMkdirp(statePath);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function extractUrlsFromText(text) {
  if (!text) return [];
  const s = String(text);
  const matches = s.match(/https?:\/\/[^\s)>"'\]]+/g);
  if (!matches) return [];
  // Trim trailing punctuation that commonly sticks to URLs in prose/markdown.
  return matches
    .map((u) => u.replace(/[),.]+$/g, ""))
    .map((u) => u.replace(/[?&]utm_source=openai\b/i, "")) // keep URLs clean + slightly smaller
    .map((u) => u.replace(/\?$/, "")); // if utm was the only query param
}

function normalizeSources(sources) {
  const out = [];
  const arr = Array.isArray(sources) ? sources : [];
  for (const item of arr) {
    // If the model returns markdown like "([site](https://x))", this extracts https://x
    const urls = extractUrlsFromText(item);
    if (urls.length) {
      out.push(urls[0]);
      continue;
    }
    // If it's not a URL (e.g., Responses web tool citations like "turn0search1"), drop it.
  }
  // De-dupe while preserving order
  return [...new Set(out)];
}

function hasHttpUrlSource(sources) {
  const normalized = normalizeSources(sources);
  return normalized.some((s) => typeof s === "string" && /^https?:\/\//i.test(s));
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
  if (Array.isArray(v)) return v.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  return parseDomainList(v);
}

function normalizePatterns(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
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

function hostnameFromUrl(url) {
  try {
    const u = new URL(String(url));
    return (u.hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

function domainMatches(hostname, domain) {
  const h = String(hostname || "").toLowerCase();
  const d = String(domain || "").toLowerCase();
  if (!h || !d) return false;
  return h === d || h.endsWith(`.${d}`);
}

function urlMatchesAnyPattern(url, patterns) {
  if (!patterns || !patterns.length) return false;
  const s = String(url || "").toLowerCase();
  return patterns.some((p) => p && s.includes(String(p).toLowerCase()));
}

function rankHostname(hostname, preferredDomains) {
  if (!preferredDomains || !preferredDomains.length) return 999999;
  const h = String(hostname || "").toLowerCase();
  const idx = preferredDomains.findIndex((d) => domainMatches(h, d));
  return idx === -1 ? 999999 : idx;
}

function filterAndPickBestSource({ sources, allowDomains, blockDomains, preferredDomains, blockUrlPatterns }) {
  const normalized = normalizeSources(sources);
  const candidates = [];
  for (const url of normalized) {
    const host = hostnameFromUrl(url);
    if (!host) continue;
    if (blockDomains && blockDomains.length && blockDomains.some((d) => domainMatches(host, d))) continue;
    if (allowDomains && allowDomains.length && !allowDomains.some((d) => domainMatches(host, d))) continue;
    if (urlMatchesAnyPattern(url, blockUrlPatterns)) continue;
    candidates.push({ url, host, rank: rankHostname(host, preferredDomains) });
  }
  if (!candidates.length) return [];
  candidates.sort((a, b) => a.rank - b.rank || a.host.localeCompare(b.host) || a.url.localeCompare(b.url));
  return [candidates[0].url];
}

function parseNumbersFromText(text) {
  if (!text) return [];
  const s = String(text);
  // captures integers/decimals, allowing thousands separators
  const matches = s.match(/(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g);
  if (!matches) return [];
  return matches
    .map((m) => Number(String(m).replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
}

function detectUnitFromEvidence(text) {
  const s = String(text || "").toLowerCase();
  const hasFeet = /\b(ft|feet|foot)\b/.test(s);
  // basic detection: "m", "meter", "metre" (avoid matching "cm"/"mm")
  const hasMeters = /\b(meter|metre|meters|metres)\b/.test(s) || (/\bm\b/.test(s) && !/\bcm\b|\bmm\b/.test(s));
  if (hasFeet) return "feet";
  if (hasMeters) return "meters";
  return "unknown";
}

function evidenceSupportsValueFeet(valueFeet, evidenceText) {
  if (valueFeet === null || valueFeet === undefined) return true;
  if (!evidenceText || !String(evidenceText).trim()) return false;
  const unit = detectUnitFromEvidence(evidenceText);
  let nums = parseNumbersFromText(evidenceText);
  if (!nums.length) return false;

  if (unit === "meters") {
    nums = nums.map((n) => n * 3.28084);
  }

  // If there is an obvious range, accept if value is inside it.
  if (nums.length >= 2) {
    const sorted = [...nums].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    if (valueFeet >= min - 0.5 && valueFeet <= max + 0.5) return true;
  }

  // Otherwise accept if it's close to any single cited number.
  const tolerance = valueFeet <= 5 ? 0.6 : Math.max(2, valueFeet * 0.1);
  return nums.some((n) => Math.abs(n - valueFeet) <= tolerance);
}

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

function isHalfFootIncrement(n) {
  if (!Number.isFinite(n)) return false;
  // Allow half-foot increments (e.g., 0, 0.5, 1.0, 1.5, ...)
  return Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;
}

function safeMkdirp(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadCheckpoint(checkpointPath) {
  try {
    if (!fs.existsSync(checkpointPath)) return { done: {}, errors: {} };
    const raw = fs.readFileSync(checkpointPath, "utf8");
    const json = JSON.parse(raw);
    return {
      done: json.done || {},
      errors: json.errors || {},
    };
  } catch {
    return { done: {}, errors: {} };
  }
}

function saveCheckpoint(checkpointPath, checkpoint) {
  safeMkdirp(checkpointPath);
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

function resetCheckpoint(checkpointPath) {
  safeMkdirp(checkpointPath);
  fs.writeFileSync(checkpointPath, JSON.stringify({ done: {}, errors: {} }, null, 2));
}

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ensureCsvHeader(outPath) {
  safeMkdirp(outPath);
  if (!fs.existsSync(outPath)) {
    fs.writeFileSync(
      outPath,
      ["Scientific Name", "Common Name", "Height (feet)", "Spread (feet)", "Sources"].join(",") + "\n"
    );
  }
}

function resetCsv(outPath) {
  safeMkdirp(outPath);
  fs.writeFileSync(
    outPath,
    ["Scientific Name", "Common Name", "Height (feet)", "Spread (feet)", "Sources"].join(",") + "\n"
  );
}

function resetTextFile(filePath) {
  safeMkdirp(filePath);
  fs.writeFileSync(filePath, "");
}

function appendTextLine(filePath, line) {
  safeMkdirp(filePath);
  fs.appendFileSync(filePath, String(line).trim() + "\n");
}

function isInsufficientQuotaError(e) {
  const status = e && e.status;
  if (status !== 429) return false;
  const msg = (e && e.message ? String(e.message) : "").toLowerCase();
  const body = (e && e.body ? String(e.body) : "").toLowerCase();
  return (
    msg.includes("insufficient_quota") ||
    msg.includes("exceeded your current quota") ||
    body.includes("insufficient_quota") ||
    body.includes("exceeded your current quota")
  );
}

function appendCsvRow(outPath, row) {
  ensureCsvHeader(outPath);
  const line =
    [
      row.scientificName,
      row.commonName,
      row.heightFeet,
      row.spreadFeet,
      row.sources,
    ]
      .map(csvEscape)
      .join(",") + "\n";
  fs.appendFileSync(outPath, line);
}

function clampReasonableFeet(n, maxFeet) {
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  // Just a sanity clamp to avoid hallucinated absurd values.
  if (n > maxFeet) return null;
  // For small plants, allow half-foot precision (helps landscapers plan spacing).
  // Keep higher values as-is to preserve meaningful precision from sources.
  if (n <= 5) {
    return Math.round(n * 2) / 2;
  }
  return n;
}

function extractJsonFromText(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  // If it already is JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fallthrough
    }
  }
  // Otherwise try to find the first {...} block
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  return null;

}

function getResponsesApiOutputText(resp) {
  if (!resp || typeof resp !== "object") return "";
  if (typeof resp.output_text === "string" && resp.output_text.trim()) return resp.output_text;
  if (typeof resp.outputText === "string" && resp.outputText.trim()) return resp.outputText;

  const out = Array.isArray(resp.output) ? resp.output : [];
  for (const item of out) {
    const content = Array.isArray(item && item.content) ? item.content : [];
    for (const c of content) {
      if (!c || typeof c !== "object") continue;
      if (typeof c.text === "string" && c.text.trim()) return c.text;
      if (typeof c.output_text === "string" && c.output_text.trim()) return c.output_text;
      if (typeof c.content === "string" && c.content.trim()) return c.content;
    }
  }
  return "";
}

async function callOpenAIForDimensions({
  model,
  apiKey,
  useWeb,
  scientificName,
  commonName,
  allowDomains,
  blockDomains,
  preferredDomains,
  blockUrlPatterns,
  requireAllowedSource,
}) {
  // NOTE: This prompt is intentionally compact to reduce token cost at scale.
  const sourcesRule = (() => {
    if (!useWeb) {
      return (
        "Do NOT invent or guess URLs. " +
        "Since web search is disabled, set sources to an empty array and set height_feet and spread_feet to null."
      );
    }
    const allow = allowDomains && allowDomains.length ? `Allowed domains: ${allowDomains.join(", ")}. ` : "";
    const block = blockDomains && blockDomains.length ? `Blocked domains: ${blockDomains.join(", ")}. ` : "";
    const prefer =
      preferredDomains && preferredDomains.length
        ? `Prefer sources in this order (highest authority first): ${preferredDomains.join(", ")}. `
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
      "For each non-null number, include a short verbatim evidence snippet copied from the cited page that contains the numeric value(s) and units (feet or meters). " +
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
      height_evidence: { type: ["string", "null"] },
      spread_evidence: { type: ["string", "null"] },
      sources: {
        type: "array",
        minItems: 0,
        maxItems: 1,
        items: { type: "string" },
      },
    },
    required: ["height_feet", "spread_feet", "height_evidence", "spread_evidence", "sources"],
  };

  const payload = {
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
  };

  if (useWeb) {
    payload.tools = [{ type: "web_search_preview" }];
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`OpenAI error ${res.status}: ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  // Responses API sometimes includes `output_text`; otherwise we extract a JSON chunk from the full response.
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(text);
  } catch {
    parsedResponse = null;
  }

  const outputText = getResponsesApiOutputText(parsedResponse) || (typeof text === "string" ? text : "");

  const obj = extractJsonFromText(outputText) || extractJsonFromText(text);
  if (!obj) {
    const e = new Error("Could not parse JSON dimensions from OpenAI response");
    e.body = text;
    throw e;
  }
  return { obj, rawResponseText: text, parsedResponse };
}

async function callOpenAIForDimensionsWithRetry({
  model,
  apiKey,
  useWeb,
  scientificName,
  commonName,
  allowDomains,
  blockDomains,
  preferredDomains,
  blockUrlPatterns,
  requireAllowedSource,
}) {
  const firstResp = await callOpenAIForDimensions({
    model,
    apiKey,
    useWeb,
    scientificName,
    commonName,
    allowDomains,
    blockDomains,
    preferredDomains,
    blockUrlPatterns,
    requireAllowedSource,
  });
  const first = firstResp.obj || {};
  const firstSourcesOk = hasHttpUrlSource(first.sources);
  const firstOk =
    Number.isFinite(first.height_feet) &&
    Number.isFinite(first.spread_feet) &&
    (!requireAllowedSource || firstSourcesOk);
  if (firstOk) return firstResp;

  // Retry once with stronger "must find numbers if they exist" guidance (still compact).
  const system =
    "SECOND TRY. Return ONLY JSON matching the schema. " +
    "If ANY species-specific mature size info exists, return best-estimate numbers (no ranges; midpoint ok). " +
    "Convert metric to feet. If <=5 ft use 0.5-ft steps. " +
    (requireAllowedSource
      ? "If you return numbers, sources must contain one allowed-domain http(s) URL and you must include verbatim evidence snippets containing the numeric values and units."
      : "If you return numbers, include one http(s) URL if available; otherwise return nulls with empty sources.");

  const user =
    `Plant: ${scientificName}` +
    (commonName ? ` (${commonName})` : "") +
    "\nFind typical mature height_feet and spread_feet.";

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      height_feet: { type: ["number", "null"] },
      spread_feet: { type: ["number", "null"] },
      height_evidence: { type: ["string", "null"] },
      spread_evidence: { type: ["string", "null"] },
      sources: { type: "array", minItems: 0, maxItems: 1, items: { type: "string" } },
    },
    required: ["height_feet", "spread_feet", "height_evidence", "spread_evidence", "sources"],
  };

  const payload = {
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
  };

  if (useWeb) payload.tools = [{ type: "web_search_preview" }];

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`OpenAI error ${res.status}: ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(text);
  } catch {
    parsedResponse = null;
  }

  const outputText = getResponsesApiOutputText(parsedResponse) || (typeof text === "string" ? text : "");

  const obj = extractJsonFromText(outputText) || extractJsonFromText(text);
  if (!obj) {
    const e = new Error("Could not parse JSON dimensions from OpenAI response (retry)");
    e.body = text;
    throw e;
  }
  return { obj, rawResponseText: text, parsedResponse };
}

async function main() {
  const args = parseArgs(process.argv);

  const apiKey = args["api-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY in environment (.env).");
    process.exit(1);
  }
  console.log(`Using OpenAI key from env/args (len ${String(apiKey).length})`);

  const model = args.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const statePath = args.state || DEFAULT_STATE;
  const fresh = toBool(args.fresh, false) || toBool(args["reset-run"], false) || toBool(args["start-fresh"], false);
  const resume = fresh ? false : toBool(args.resume, true);
  const priorState = resume ? loadState(statePath) : null;

  const outPath = args.out || (priorState && priorState.outPath) || DEFAULT_OUT;
  const checkpointPath = args.checkpoint || (priorState && priorState.checkpointPath) || DEFAULT_CHECKPOINT;
  const nullsFile = toBool(args["no-nulls-file"], false)
    ? null
    : (args["nulls-file"] || (priorState && priorState.nullsFile) || DEFAULT_NULLS_FILE);
  const errorsFile = toBool(args["no-errors-file"], false)
    ? null
    : (args["errors-file"] || (priorState && priorState.errorsFile) || DEFAULT_ERRORS_FILE);

  const onlyMissing = toBool(args["only-missing"], true);
  const includeAll = toBool(args["all"], false);
  const limit = toInt(args.limit, 0);
  const startAfterExplicit = args["start-after"] || null;
  const useWeb = toBool(args.web, true);
  const maxFeet = toInt(args["max-feet"], 400);
  const redoNulls = toBool(args["redo-nulls"], false);
  const redoAll = toBool(args["redo-all"], false);
  const resetCsvFlag = toBool(args["reset-csv"], false) || fresh;
  const csvOnly = toBool(args["csv-only"], false);
  const resetNullsFileFlag = toBool(args["reset-nulls-file"], false) || resetCsvFlag;
  const resetErrorsFileFlag = toBool(args["reset-errors-file"], false) || resetCsvFlag;
  const debugSave = toBool(args["debug-save"], false);
  const debugDir = args["debug-dir"] || "db_backups/tmp-openai-responses";

  const startAfter =
    startAfterExplicit ||
    (priorState && (priorState.lastWrittenId || priorState.lastId)) ||
    null;

  // Rate limit defaults (tokens are per request here). Tune as needed.
  const rpm = toInt(args.rpm, 20); // conservative default
  const limiter = new RateLimiter({ tokensPerInterval: rpm, interval: "minute" });

  const resetCheckpointFlag = toBool(args["reset-checkpoint"], false) || resetCsvFlag || fresh;
  const checkpoint = csvOnly ? { done: {}, errors: {} } : loadCheckpoint(checkpointPath);
  if (!csvOnly && resetCheckpointFlag) {
    resetCheckpoint(checkpointPath);
    checkpoint.done = {};
    checkpoint.errors = {};
  }

  // Optional: load explicit list of plant IDs (scientific names)
  let idsList = null;
  if (args["ids-file"]) {
    const p = String(args["ids-file"]);
    idsList = fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

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
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let stopEarly = false;

    if (resetCsvFlag) resetCsv(outPath);
    else ensureCsvHeader(outPath);

    if (nullsFile && resetNullsFileFlag) resetTextFile(nullsFile);
    if (errorsFile && resetErrorsFileFlag) resetTextFile(errorsFile);

    const state = {
      outPath,
      checkpointPath,
      nullsFile,
      errorsFile,
      model,
      resume,
      redoAll,
      csvOnly,
      startedAt: new Date().toISOString(),
      lastId: startAfter || null, // backwards-compatible
      lastAttemptedId: null,
      lastWrittenId: startAfter || null,
      processed: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      updatedAt: new Date().toISOString(),
    };
    // If caller is resetting CSV, also reset state to avoid accidental resume from an older run.
    if (resetCsvFlag) {
      state.lastId = startAfterExplicit || null;
      state.processed = 0;
      state.updated = 0;
      state.failed = 0;
      state.skipped = 0;
    }
    saveState(statePath, state);

    async function processOne({ id, scientificName, commonName }) {
      if (stopEarly) return;
      if (!csvOnly && !redoAll && checkpoint.done[id]) {
        if (!redoNulls) {
          skipped++;
          state.skipped = skipped;
          state.lastId = id;
          state.updatedAt = new Date().toISOString();
          saveState(statePath, state);
          return;
        }
        const prev = checkpoint.done[id] || {};
        const prevOk =
          Number.isFinite(prev.height_feet) &&
          Number.isFinite(prev.spread_feet) &&
          Array.isArray(prev.sources) &&
          prev.sources.length > 0;
        if (prevOk) {
          skipped++;
          state.skipped = skipped;
          state.lastId = id;
          state.updatedAt = new Date().toISOString();
          saveState(statePath, state);
          return;
        }
      }

      if (limit && processed >= limit) return;

      processed++;
      process.stdout.write(`\rProcessing ${processed}${limit ? `/${limit}` : ""}: ${scientificName}               `);
      state.processed = processed;
      state.lastAttemptedId = id;
      state.updatedAt = new Date().toISOString();
      saveState(statePath, state);

      try {
        await limiter.removeTokens(1);

        const dimResp = await callOpenAIForDimensionsWithRetry({
          model,
          apiKey,
          useWeb,
          scientificName,
          commonName,
          allowDomains,
          blockDomains,
          preferredDomains,
          blockUrlPatterns,
          requireAllowedSource,
        });
        const dim = dimResp.obj || {};

        if (debugSave) {
          safeMkdirp(path.join(debugDir, "x"));
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const outFile = path.join(debugDir, `${id}-${stamp}.json`);
          fs.writeFileSync(
            outFile,
            JSON.stringify(
              {
                plant: { _id: id, scientificName, commonName },
                extracted: dim,
                parsedResponse: dimResp.parsedResponse,
                rawResponseText: dimResp.rawResponseText,
              },
              null,
              2
            )
          );
        }

        const heightFeet = clampReasonableFeet(dim.height_feet, maxFeet);
        const spreadFeet = clampReasonableFeet(dim.spread_feet, maxFeet);

        const normalizedSources = filterAndPickBestSource({
          sources: dim.sources,
          allowDomains,
          blockDomains,
          preferredDomains,
          blockUrlPatterns,
        });
        const sources = normalizedSources.join(" | ");

        const heightEvidence = dim.height_evidence ?? dim.heightEvidence ?? null;
        const spreadEvidence = dim.spread_evidence ?? dim.spreadEvidence ?? null;

        const sourceOk = !requireAllowedSource || normalizedSources.length > 0;
        const heightOk = sourceOk && evidenceSupportsValueFeet(heightFeet, heightEvidence);
        const spreadOk = sourceOk && evidenceSupportsValueFeet(spreadFeet, spreadEvidence);

        const finalHeightFeet = heightOk ? heightFeet : null;
        const finalSpreadFeet = spreadOk ? spreadFeet : null;

        // Write a CSV row regardless; you can choose to ignore nulls later.
        appendCsvRow(outPath, {
          scientificName,
          commonName,
          heightFeet: finalHeightFeet === null ? "" : finalHeightFeet,
          spreadFeet: finalSpreadFeet === null ? "" : finalSpreadFeet,
          sources,
        });
        state.lastWrittenId = id;
        state.lastId = id;
        state.updatedAt = new Date().toISOString();
        saveState(statePath, state);

        // Track blanks so you can do a focused, more expensive second pass later.
        if (nullsFile && (finalHeightFeet === null || finalSpreadFeet === null)) {
          appendTextLine(nullsFile, scientificName);
        }

        checkpoint.done[id] = {
          height_feet: finalHeightFeet,
          spread_feet: finalSpreadFeet,
          sources: normalizedSources,
          height_evidence: heightEvidence,
          spread_evidence: spreadEvidence,
          notes: dim.notes || "",
          at: new Date().toISOString(),
        };
        if (!csvOnly) {
          delete checkpoint.errors[id];
          saveCheckpoint(checkpointPath, checkpoint);
        }

        updated++;
        state.updated = updated;
        state.updatedAt = new Date().toISOString();
        saveState(statePath, state);
      } catch (e) {
        failed++;
        const msg = e && e.message ? e.message : String(e);
        if (errorsFile) appendTextLine(errorsFile, scientificName);
        if (!csvOnly) {
          checkpoint.errors[id] = {
            message: msg,
            at: new Date().toISOString(),
          };
          saveCheckpoint(checkpointPath, checkpoint);
        }
        state.failed = failed;
        state.updatedAt = new Date().toISOString();
        saveState(statePath, state);
        // Print the error but keep going
        process.stdout.write("\n");
        console.error(`Error for ${scientificName}: ${msg}`);

        // If the account is out of quota, stop immediately to avoid spamming failures
        if (isInsufficientQuotaError(e)) {
          console.error("Stopping early due to insufficient OpenAI quota. Top up/enable billing, then re-run to resume.");
          stopEarly = true;
          return;
        }
      }
    }

    if (idsList && idsList.length) {
      let effectiveIds = idsList;
      if (startAfter) effectiveIds = idsList.filter((id) => String(id).localeCompare(String(startAfter)) > 0);
      for (const id of effectiveIds) {
        if (limit && processed >= limit) break;
        if (stopEarly) break;
        // eslint-disable-next-line no-await-in-loop
        const plant = await plants.findOne(
          { _id: id },
          { projection: { _id: 1, "Scientific Name": 1, "Common Name": 1, "Height (feet)": 1, "Spread (feet)": 1 } }
        );
        const scientificName = (plant && plant["Scientific Name"]) || id;
        const commonName = (plant && plant["Common Name"]) || "";
        // eslint-disable-next-line no-await-in-loop
        await processOne({ id, scientificName, commonName });
        if (stopEarly) break;
      }
    } else {
      const query = {};
      if (!includeAll && onlyMissing) {
        query.$or = [{ "Height (feet)": { $lte: 0 } }, { "Spread (feet)": { $lte: 0 } }];
      }
      if (startAfter) {
        // _id is Scientific Name in this DB
        query._id = query._id || {};
        query._id.$gt = startAfter;
      }

      const cursor = plants
        .find(query, {
          projection: {
            _id: 1,
            "Scientific Name": 1,
            "Common Name": 1,
            "Height (feet)": 1,
            "Spread (feet)": 1,
          },
        })
        .sort({ _id: 1 });

      while (await cursor.hasNext()) {
        const plant = await cursor.next();
        const id = plant._id;
        const scientificName = plant["Scientific Name"] || id;
        const commonName = plant["Common Name"] || "";
        // eslint-disable-next-line no-await-in-loop
        await processOne({ id, scientificName, commonName });
        if (stopEarly) break;
        if (limit && processed >= limit) break;
      }
    }

    process.stdout.write("\n");
    console.log("Done.");
    console.log(`Processed: ${processed}`);
    console.log(`Wrote rows: ${updated}`);
    console.log(`Skipped (already in checkpoint): ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`CSV: ${outPath}`);
    console.log(`Checkpoint: ${checkpointPath}`);
    if (nullsFile) console.log(`Nulls list: ${nullsFile}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err && err.message ? err.message : err);
  process.exit(1);
});


