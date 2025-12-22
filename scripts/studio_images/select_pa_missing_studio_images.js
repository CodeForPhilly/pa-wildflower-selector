#!/usr/bin/env node
/**
 * Select a batch of input photos for studio generation focused on PA coverage.
 *
 * Selection rules:
 * - Plant document has "PA" in the comma-separated "Distribution in USA" field.
 * - There is a corresponding input photo in `images/` matching the plant's "Scientific Name" (by filename stem).
 * - There is NOT already an output in `images/studio_full/` for that same stem (any of .webp/.jpg/.jpeg/.png).
 *
 * Outputs a newline-delimited list of filenames/paths suitable for:
 *   python scripts/studio_images/generate_studio_images.py --input-list <file>
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("../../lib/db");

function readArgValue(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return defaultValue;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return defaultValue;
  return val;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toInt(v, fallback) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPreviewName(filename) {
  return filename.toLowerCase().endsWith(".preview.jpg");
}

function isImageExt(ext) {
  const e = String(ext || "").toLowerCase();
  return e === ".jpg" || e === ".jpeg" || e === ".png";
}

function loadInputStemMap(inputDir) {
  const map = new Map(); // stem -> filename
  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const filename = ent.name;
    if (isPreviewName(filename)) continue;
    const ext = path.extname(filename);
    if (!isImageExt(ext)) continue;
    const stem = path.parse(filename).name.trim();
    if (!stem) continue;
    // If multiple exist, keep the first encountered (directory order is fine)
    if (!map.has(stem)) map.set(stem, filename);
  }
  return map;
}

function hasAnyStudioOutput(outputDir, stem) {
  const candidates = [
    path.join(outputDir, `${stem}.webp`),
    path.join(outputDir, `${stem}.jpg`),
    path.join(outputDir, `${stem}.jpeg`),
    path.join(outputDir, `${stem}.png`),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

async function main() {
  const state = readArgValue("--state", "PA");
  const distributionField = readArgValue("--distribution-field", "Distribution in USA");
  const limit = toInt(readArgValue("--limit", "500"), 500);
  const sortField = readArgValue("--sort-field", "Scientific Name");
  const sortDir = readArgValue("--sort-dir", "asc").toLowerCase() === "desc" ? -1 : 1;
  const inputDir = readArgValue("--input-dir", path.join(process.cwd(), "images"));
  const outputDir = readArgValue("--output-dir", path.join(process.cwd(), "images", "studio_full"));
  const outFile = readArgValue(
    "--out-file",
    path.join(process.cwd(), "scripts", "studio_images", "pa_missing_500.txt")
  );
  const lastFile = readArgValue(
    "--last-file",
    path.join(process.cwd(), "scripts", "studio_images", "last_batch_selected.txt")
  );
  const includeAlreadySelected = hasFlag("--include-last");

  if (!fs.existsSync(inputDir)) {
    console.error(`❌ input dir not found: ${inputDir}`);
    process.exit(2);
  }
  if (!fs.existsSync(outputDir)) {
    // Not fatal; generation will create it, but output existence checks depend on it.
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const inputStemToFilename = loadInputStemMap(inputDir);
  const alreadySelected = new Set();
  if (!includeAlreadySelected && fs.existsSync(lastFile)) {
    const prev = fs.readFileSync(lastFile, "utf-8");
    for (const line of prev.split(/\r?\n/)) {
      const v = line.trim();
      if (v) alreadySelected.add(v);
    }
  }

  const { plants, close } = await db();
  try {
    const stateRe = new RegExp(`(^|,\\s*)${escapeRegex(state)}(\\s*,|$)`);
    const query = {
      [distributionField]: { $regex: stateRe },
    };
    const projection = { "Scientific Name": 1, [distributionField]: 1 };

    const cursor = plants.find(query, { projection }).sort({ [sortField]: sortDir });

    let paDocs = 0;
    let missingInput = 0;
    let alreadyHasOutput = 0;
    let skippedPrev = 0;
    const selected = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      paDocs += 1;

      const sci = (doc && doc["Scientific Name"] ? String(doc["Scientific Name"]) : "").trim();
      if (!sci) continue;

      const filename = inputStemToFilename.get(sci);
      if (!filename) {
        missingInput += 1;
        continue;
      }

      if (hasAnyStudioOutput(outputDir, sci)) {
        alreadyHasOutput += 1;
        continue;
      }

      if (!includeAlreadySelected && alreadySelected.has(filename)) {
        skippedPrev += 1;
        continue;
      }

      selected.push(filename);
      if (selected.length >= limit) break;
    }

    // Ensure parent dir exists
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, selected.join("\n") + (selected.length ? "\n" : ""), "utf-8");

    // Overwrite "last batch" marker for convenience
    fs.mkdirSync(path.dirname(lastFile), { recursive: true });
    fs.writeFileSync(lastFile, selected.join("\n") + (selected.length ? "\n" : ""), "utf-8");

    console.log("\n===== PA studio batch selection =====");
    console.log(`Criteria: ${distributionField} contains ${state}`);
    console.log(`Sort: ${sortField} ${sortDir === 1 ? "ASC" : "DESC"}`);
    console.log(`PA docs scanned:         ${paDocs}`);
    console.log(`Missing input photo:     ${missingInput}`);
    console.log(`Already has studio out:  ${alreadyHasOutput}`);
    console.log(`Skipped (prev selected): ${skippedPrev}`);
    console.log(`Selected:                ${selected.length}`);
    console.log(`Wrote:                   ${outFile}`);
    console.log(`Updated:                 ${lastFile}\n`);

    if (selected.length === 0) {
      console.log("ℹ️  Nothing to do: no PA plants found that are missing studio images (or all were previously selected).");
    } else if (selected.length < limit) {
      console.log(`ℹ️  Only found ${selected.length} items (requested ${limit}).`);
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("❌ selection script failed");
  console.error(err);
  process.exit(1);
});


