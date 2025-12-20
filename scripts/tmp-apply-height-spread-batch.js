#!/usr/bin/env node
/**
 * Apply an OpenAI Batch output JSONL file back into CSV and (optionally) checkpoint JSON.
 *
 * Usage:
 *   node scripts/tmp-apply-height-spread-batch.js --in db_backups/batch-output.jsonl --map db_backups/tmp-height-spread-batch-map.json --out db_backups/tmp-height-spread-batch.csv
 *   node scripts/tmp-apply-height-spread-batch.js --in db_backups/batch-output.jsonl --map db_backups/tmp-height-spread-batch-map.json --out db_backups/tmp-height-spread-batch.csv --checkpoint db_backups/tmp-height-spread-checkpoint.json
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DEFAULT_OUT = "db_backups/tmp-height-spread-batch.csv";
const DEFAULT_CHECKPOINT = "db_backups/tmp-height-spread-checkpoint.json";
const DEFAULT_NULLS = "db_backups/tmp-height-spread-batch-nulls.txt";
const DEFAULT_ERRORS = "db_backups/tmp-height-spread-batch-errors.txt";

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

function safeMkdirp(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function resetCsv(outPath) {
  safeMkdirp(outPath);
  fs.writeFileSync(
    outPath,
    ["Scientific Name", "Common Name", "Height (feet)", "Spread (feet)", "Sources"].join(",") + "\n"
  );
}

function appendCsvRow(outPath, row) {
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

function extractUrlsFromText(text) {
  if (!text) return [];
  const s = String(text);
  const matches = s.match(/https?:\/\/[^\s)>"'\]]+/g);
  if (!matches) return [];
  return matches
    .map((u) => u.replace(/[),.]+$/g, ""))
    .map((u) => u.replace(/[?&]utm_source=openai\b/i, ""))
    .map((u) => u.replace(/\?$/, ""));
}

function normalizeSources(sources) {
  const arr = Array.isArray(sources) ? sources : [];
  const out = [];
  for (const item of arr) {
    const urls = extractUrlsFromText(item);
    if (urls.length) out.push(urls[0]);
  }
  return [...new Set(out)];
}

function extractJsonFromText(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fallthrough
    }
  }
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

function saveCheckpoint(checkpointPath, checkpoint) {
  safeMkdirp(checkpointPath);
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

function appendTextLine(filePath, line) {
  safeMkdirp(filePath);
  fs.appendFileSync(filePath, String(line).trim() + "\n");
}

async function main() {
  const args = parseArgs(process.argv);
  const inPath = args.in || args.input;
  if (!inPath) {
    console.error("Missing --in <batch-output.jsonl>");
    process.exit(1);
  }

  const mapPath = args.map || null;
  const outPath = args.out || DEFAULT_OUT;
  const checkpointPath = toBool(args["no-checkpoint"], false) ? null : (args.checkpoint || DEFAULT_CHECKPOINT);
  const nullsPath = args["nulls-file"] || DEFAULT_NULLS;
  const errorsPath = args["errors-file"] || DEFAULT_ERRORS;
  const reset = toBool(args["reset-csv"], true);

  const map = mapPath && fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};
  const checkpoint = checkpointPath ? loadCheckpoint(checkpointPath) : { done: {}, errors: {} };

  if (reset) resetCsv(outPath);
  safeMkdirp(nullsPath);
  safeMkdirp(errorsPath);
  fs.writeFileSync(nullsPath, "");
  fs.writeFileSync(errorsPath, "");

  const rl = readline.createInterface({
    input: fs.createReadStream(inPath),
    crlfDelay: Infinity,
  });

  let total = 0;
  let ok = 0;
  let failed = 0;

  for await (const line of rl) {
    const trimmed = String(line).trim();
    if (!trimmed) continue;
    total++;

    let rec;
    try {
      rec = JSON.parse(trimmed);
    } catch {
      failed++;
      continue;
    }

    const customId = rec.custom_id || rec.customId || "";
    const meta = map[customId] || {};
    const scientificName = meta.scientificName || meta.id || customId;
    const commonName = meta.commonName || "";

    // Try to find the actual Responses object inside the batch record
    const resp =
      (rec.response && (rec.response.body || rec.response)) ||
      rec.body ||
      rec;

    // Detect errors
    const statusCode =
      (rec.response && rec.response.status_code) ||
      rec.status_code ||
      resp.status_code ||
      null;
    const errorObj = rec.error || resp.error || null;
    if ((statusCode && statusCode >= 400) || errorObj) {
      failed++;
      appendTextLine(errorsPath, scientificName);
      if (checkpointPath) {
        checkpoint.errors[scientificName] = {
          message: errorObj ? JSON.stringify(errorObj) : `HTTP ${statusCode || "error"}`,
          at: new Date().toISOString(),
        };
      }
      continue;
    }

    const outputText = getResponsesApiOutputText(resp);
    const obj = extractJsonFromText(outputText) || extractJsonFromText(JSON.stringify(resp));
    if (!obj || typeof obj !== "object") {
      failed++;
      appendTextLine(errorsPath, scientificName);
      continue;
    }

    const heightFeet = Number.isFinite(obj.height_feet) ? obj.height_feet : null;
    const spreadFeet = Number.isFinite(obj.spread_feet) ? obj.spread_feet : null;
    const sourcesArr = normalizeSources(obj.sources);
    const sources = sourcesArr.join(" | ");

    appendCsvRow(outPath, {
      scientificName,
      commonName,
      heightFeet: heightFeet === null ? "" : heightFeet,
      spreadFeet: spreadFeet === null ? "" : spreadFeet,
      sources,
    });

    if (heightFeet === null || spreadFeet === null) appendTextLine(nullsPath, scientificName);

    if (checkpointPath) {
      checkpoint.done[scientificName] = {
        height_feet: heightFeet,
        spread_feet: spreadFeet,
        sources: sourcesArr,
        at: new Date().toISOString(),
      };
      delete checkpoint.errors[scientificName];
    }

    ok++;
  }

  if (checkpointPath) saveCheckpoint(checkpointPath, checkpoint);

  console.log("✅ Batch output applied.");
  console.log(`Total lines: ${total}`);
  console.log(`OK: ${ok}`);
  console.log(`Failed: ${failed}`);
  console.log(`CSV: ${outPath}`);
  console.log(`Nulls: ${nullsPath}`);
  console.log(`Errors: ${errorsPath}`);
  if (checkpointPath) console.log(`Checkpoint: ${checkpointPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err && err.message ? err.message : err);
  process.exit(1);
});




