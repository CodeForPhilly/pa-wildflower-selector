#!/usr/bin/env node
/**
 * Sanity-check (and optionally fix) the height/spread checkpoint JSON.
 *
 * Usage:
 *   node scripts/tmp-sanity-height-spread-checkpoint.js
 *   node scripts/tmp-sanity-height-spread-checkpoint.js --checkpoint db_backups/tmp-height-spread-checkpoint.json
 *   node scripts/tmp-sanity-height-spread-checkpoint.js --fix=1
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_CHECKPOINT = "db_backups/tmp-height-spread-checkpoint.json";

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

function extractUrlsFromText(text) {
  if (!text) return [];
  const s = String(text);
  const matches = s.match(/https?:\/\/[^\s)>"'\]]+/g);
  if (!matches) return [];
  return matches.map((u) => u.replace(/[),.]+$/g, ""));
}

function normalizeSources(sources) {
  const out = [];
  const arr = Array.isArray(sources) ? sources : [];
  for (const item of arr) {
    const urls = extractUrlsFromText(item);
    if (urls.length) {
      out.push(urls[0]);
      continue;
    }
    // drop non-URLs (e.g., tool citation tokens)
  }
  return [...new Set(out)];
}

function isHalfFootIncrement(n) {
  if (!Number.isFinite(n)) return false;
  return Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;
}

function safeReadJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function safeWriteJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function main() {
  const args = parseArgs(process.argv);
  const checkpointPath = args.checkpoint || DEFAULT_CHECKPOINT;
  const fix = toBool(args.fix, false);
  const maxFeet = toInt(args["max-feet"], 400);

  const abs = path.resolve(checkpointPath);
  if (!fs.existsSync(abs)) {
    console.error(`Checkpoint not found: ${checkpointPath}`);
    process.exit(1);
  }

  const checkpoint = safeReadJson(abs);
  checkpoint.done = checkpoint.done || {};
  checkpoint.errors = checkpoint.errors || {};

  const ids = Object.keys(checkpoint.done);
  const issues = {
    total: ids.length,
    fixedSources: 0,
    badShape: 0,
    missingSources: 0,
    nonUrlSources: 0,
    negative: 0,
    tooLarge: 0,
    weirdPrecisionUnder5: 0,
    nulls: 0,
  };

  for (const id of ids) {
    const entry = checkpoint.done[id];
    if (!entry || typeof entry !== "object") {
      issues.badShape++;
      continue;
    }

    // Normalize sources to plain URLs where possible
    const beforeSources = entry.sources;
    const normalizedSources = normalizeSources(beforeSources);
    const sourcesChanged = JSON.stringify(beforeSources || []) !== JSON.stringify(normalizedSources);
    if (sourcesChanged) {
      issues.fixedSources++;
      if (fix) entry.sources = normalizedSources;
    }

    const h = entry.height_feet;
    const s = entry.spread_feet;

    const hIsNull = h === null || h === undefined;
    const sIsNull = s === null || s === undefined;
    if (hIsNull || sIsNull) issues.nulls++;

    const hNum = Number.isFinite(h) ? h : null;
    const sNum = Number.isFinite(s) ? s : null;

    if (hNum !== null && hNum < 0) issues.negative++;
    if (sNum !== null && sNum < 0) issues.negative++;
    if (hNum !== null && hNum > maxFeet) issues.tooLarge++;
    if (sNum !== null && sNum > maxFeet) issues.tooLarge++;

    if (hNum !== null && hNum <= 5 && !isHalfFootIncrement(hNum)) issues.weirdPrecisionUnder5++;
    if (sNum !== null && sNum <= 5 && !isHalfFootIncrement(sNum)) issues.weirdPrecisionUnder5++;

    if (!Array.isArray(normalizedSources) || normalizedSources.length === 0) {
      issues.missingSources++;
    } else {
      const anyNonUrl = normalizedSources.some((x) => typeof x === "string" && x.trim() && !/^https?:\/\//i.test(x.trim()));
      if (anyNonUrl) issues.nonUrlSources++;
    }
  }

  console.log("\nCheckpoint sanity report");
  console.log("-----------------------");
  console.log(`File: ${checkpointPath}`);
  console.log(`Entries: ${issues.total}`);
  console.log(`Sources normalized: ${issues.fixedSources}${fix ? " (written)" : " (dry-run)"}`);
  console.log(`Bad entry shape: ${issues.badShape}`);
  console.log(`Null height/spread: ${issues.nulls}`);
  console.log(`Missing/empty sources: ${issues.missingSources}`);
  console.log(`Non-URL sources remaining: ${issues.nonUrlSources}`);
  console.log(`Negative values: ${issues.negative}`);
  console.log(`Over max-feet (${maxFeet}): ${issues.tooLarge}`);
  console.log(`Weird precision under/at 5ft: ${issues.weirdPrecisionUnder5}`);
  console.log("");

  if (fix) {
    safeWriteJson(abs, checkpoint);
    console.log("✅ Wrote normalized checkpoint.");
  } else {
    console.log("ℹ️  No changes written (run with --fix=1 to apply source normalization).");
  }
}

main();


