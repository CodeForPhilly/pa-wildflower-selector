#!/usr/bin/env node
/**
 * Minimal OpenAI Batch helper (upload -> create batch -> optional watch -> download output).
 *
 * Usage:
 *   node scripts/tmp-run-openai-batch.js submit --in db_backups/tmp-height-spread-batch-200.jsonl
 *   node scripts/tmp-run-openai-batch.js status --batch-id batch_...
 *   node scripts/tmp-run-openai-batch.js download --file-id file_... --out db_backups/batch-output.jsonl
 *   node scripts/tmp-run-openai-batch.js watch --batch-id batch_... --poll-seconds 30 --max-minutes 120
 *
 * Notes:
 * - Requires OPENAI_API_KEY in .env
 * - Uses /v1/files, /v1/batches, /v1/files/{id}/content
 */

require("dotenv").config({ override: true });

const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.openai.com/v1";

function getFetch() {
  // Node 18+ has fetch; fallback to node-fetch v2 if needed.
  if (typeof fetch === "function") return fetch;
  // eslint-disable-next-line global-require
  return require("node-fetch");
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      args._.push(a);
      continue;
    }
    const [k, vRaw] = a.slice(2).split("=");
    const next = vRaw === undefined ? argv[i + 1] : vRaw;
    const hasInline = vRaw !== undefined;
    const value = next && !next.startsWith("--") ? next : "true";
    args[k] = value;
    if (!hasInline && value !== "true") i++;
  }
  return args;
}

function toInt(v, def) {
  if (v === undefined) return def;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : def;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requireApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY in environment (.env).");
    process.exit(1);
  }
  return apiKey;
}

async function openaiFetchJson({ method, pathSuffix, apiKey, body, headers = {} }) {
  const _fetch = getFetch();
  const url = `${API_BASE}${pathSuffix}`;
  const res = await _fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok) {
    const e = new Error(`OpenAI error ${res.status}: ${text}`);
    e.status = res.status;
    e.body = text;
    throw e;
  }
  return json;
}

async function uploadBatchFile({ apiKey, filePath }) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${filePath}`);

  const buf = fs.readFileSync(abs);
  const filename = path.basename(abs);

  // Node 18+ has FormData/Blob.
  const form = new FormData();
  form.append("purpose", "batch");
  form.append("file", new Blob([buf]), filename);

  return await openaiFetchJson({
    method: "POST",
    pathSuffix: "/files",
    apiKey,
    body: form,
  });
}

async function createBatch({ apiKey, inputFileId, endpoint, completionWindow = "24h", metadata }) {
  const payload = {
    input_file_id: inputFileId,
    endpoint,
    completion_window: completionWindow,
  };
  if (metadata) payload.metadata = metadata;

  return await openaiFetchJson({
    method: "POST",
    pathSuffix: "/batches",
    apiKey,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function getBatch({ apiKey, batchId }) {
  return await openaiFetchJson({
    method: "GET",
    pathSuffix: `/batches/${encodeURIComponent(batchId)}`,
    apiKey,
  });
}

async function downloadFileContent({ apiKey, fileId, outPath }) {
  const _fetch = getFetch();
  const url = `${API_BASE}/files/${encodeURIComponent(fileId)}/content`;
  const res = await _fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download file ${fileId}: HTTP ${res.status}: ${text}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return { outPath, bytes: buf.length };
}

async function main() {
  const args = parseArgs(process.argv);
  const cmd = (args._[0] || "").toLowerCase();
  const apiKey = requireApiKey();

  if (!cmd || !["submit", "status", "watch", "download"].includes(cmd)) {
    console.log("Usage:");
    console.log("  node scripts/tmp-run-openai-batch.js submit --in <requests.jsonl> [--endpoint /v1/responses] [--completion-window 24h]");
    console.log("  node scripts/tmp-run-openai-batch.js status --batch-id <batch_...>");
    console.log("  node scripts/tmp-run-openai-batch.js watch --batch-id <batch_...> [--poll-seconds 30] [--max-minutes 120] [--download-out <path>]");
    console.log("  node scripts/tmp-run-openai-batch.js download --file-id <file_...> --out <output.jsonl>");
    process.exit(1);
  }

  if (cmd === "submit") {
    const inPath = args.in || args.input;
    if (!inPath) throw new Error("Missing --in <requests.jsonl>");
    const endpoint = args.endpoint || "/v1/responses";
    const completionWindow = args["completion-window"] || "24h";

    console.log(`Uploading batch file: ${inPath}`);
    const fileObj = await uploadBatchFile({ apiKey, filePath: inPath });
    console.log(`✅ Uploaded. file_id=${fileObj.id}`);

    console.log(`Creating batch: endpoint=${endpoint} completion_window=${completionWindow}`);
    const batchObj = await createBatch({
      apiKey,
      inputFileId: fileObj.id,
      endpoint,
      completionWindow,
      metadata: { input_jsonl: path.basename(inPath) },
    });
    console.log(`✅ Batch created. batch_id=${batchObj.id}`);
    console.log(`Status: ${batchObj.status}`);
    if (batchObj.output_file_id) console.log(`output_file_id=${batchObj.output_file_id}`);
    if (batchObj.error_file_id) console.log(`error_file_id=${batchObj.error_file_id}`);
    return;
  }

  if (cmd === "status") {
    const batchId = args["batch-id"] || args.id;
    if (!batchId) throw new Error("Missing --batch-id <batch_...>");
    const b = await getBatch({ apiKey, batchId });
    console.log(JSON.stringify(b, null, 2));
    return;
  }

  if (cmd === "download") {
    const fileId = args["file-id"];
    const out = args.out;
    if (!fileId) throw new Error("Missing --file-id <file_...>");
    if (!out) throw new Error("Missing --out <path>");
    const r = await downloadFileContent({ apiKey, fileId, outPath: out });
    console.log(`✅ Downloaded ${fileId} -> ${r.outPath} (${r.bytes} bytes)`);
    return;
  }

  if (cmd === "watch") {
    const batchId = args["batch-id"] || args.id;
    if (!batchId) throw new Error("Missing --batch-id <batch_...>");
    const pollSeconds = toInt(args["poll-seconds"], 30);
    const maxMinutes = toInt(args["max-minutes"], 120);
    const downloadOut = args["download-out"] || null;

    const deadline = Date.now() + maxMinutes * 60 * 1000;
    while (true) {
      const b = await getBatch({ apiKey, batchId });
      const done = ["completed", "failed", "expired", "cancelled"].includes(String(b.status));
      console.log(
        `${new Date().toISOString()} batch=${batchId} status=${b.status}` +
          (b.output_file_id ? ` output_file_id=${b.output_file_id}` : "") +
          (b.error_file_id ? ` error_file_id=${b.error_file_id}` : "")
      );

      if (done) {
        if (b.status === "completed" && b.output_file_id && downloadOut) {
          await downloadFileContent({ apiKey, fileId: b.output_file_id, outPath: downloadOut });
          console.log(`✅ Output downloaded to ${downloadOut}`);
        }
        return;
      }
      if (Date.now() > deadline) {
        console.log(`⏱️  Watch timeout reached (${maxMinutes} minutes). Re-run watch later.`);
        return;
      }
      await sleep(pollSeconds * 1000);
    }
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});




