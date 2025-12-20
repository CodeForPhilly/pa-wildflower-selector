require('dotenv').config();
const VERSION = '1.2.0';
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const parse = require('csv-parse/lib/sync');
const qs = require('qs');
const db = require('./lib/db');
const { RateLimiter } = require('limiter');
// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;

    // Log to console
    console.log(message);

    // Log to file
    const logPath = path.join(__dirname, 'download.log');
    fs.appendFileSync(logPath, logMessage);
}

// Clear log file at start
fs.writeFileSync(path.join(__dirname, 'download.log'), `Starting download.js version ${VERSION}\n`);

// Log version at startup
log(`Running download.js version ${VERSION}`);

// Ensure required environment variables are set

// Ensure required environment variables are set
const requiredEnvVars = [
    'MASTER_CSV_URL',
    'ARTICLES_CSV_URL',
    'LOCAL_MAP_CSV_URL',
    'ONLINE_STORES_CSV_URL'
];

requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
});

// Start script execution
go();

let plants = null;
let nurseries = null;
let close = null;

async function go() {
    try {
        const info = await db();
        plants = info.plants;
        nurseries = info.nurseries;
        close = info.close;

        // Get initial count
        const initialCount = await plants.countDocuments({});
        log(`Initial database count: ${initialCount} plants`);

        await downloadMain();

        // Get final count
        const finalCount = await plants.countDocuments({});
        log(`Final database count: ${finalCount} plants`);

        await close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

async function downloadMain() {
    const limiter = new RateLimiter({ tokensPerInterval: 1, interval: "second" });

    log('Fetching spreadsheet data...');
    const body = await get(process.env.MASTER_CSV_URL);
    const articlesBody = await get(process.env.ARTICLES_CSV_URL);

    // Initialize empty rowsByName object
    let rowsByName = {};

    // Parse master CSV
    const records = parse(body, {
        columns: true,
        skip_empty_lines: true
    });

    // Parse articles CSV
    const articleRecords = parse(articlesBody, {
        columns: true,
        skip_empty_lines: true
    });

    // Remove plants that are not in the latest CSV
    await plants.deleteMany({
        _id: { $nin: records.map(record => record['Scientific Name']) }
    });

    log(`Processing ${records.length} plants from master CSV`);

    let i = 0;
    for (const record of records) {
        i++;
        // Clean up data by trimming whitespace
        const clean = Object.fromEntries(
            Object.entries(record).map(([key, value]) => {
                return [key.trim(), value.trim()];
            })
        );

        let name = clean['Scientific Name'];
        log(`${name} (${i} of ${records.length})`);

        // Set _id to the scientific name
        clean._id = name;

        // Handle superplant status
        let sp = (clean['Super Plant'] && clean['Super Plant'].trim() === 'Yes');

        // Get existing plant record if available
        const existing = await plants.findOne({
            _id: name
        });

        // Set Superplant and Showy flags
        clean.Superplant = sp;
        clean.Showy = clean.Showy === 'Yes';

        // Convert Recommendation Score to an integer and ALWAYS populate.
        // DB schema requires this field to exist and be an integer.
        const scoreRaw = clean['Recommendation Score'];
        const scoreNum = parseInt(scoreRaw, 10);
        clean['Recommendation Score'] = Number.isFinite(scoreNum) ? scoreNum : 0;

        // Convert height and spread to numbers and ALWAYS populate.
        // DB schema requires these fields to exist and be numeric.
        const heightNum = parseFloat(clean['Height (feet)']);
        clean['Height (feet)'] = Number.isFinite(heightNum) ? heightNum : 0;

        const spreadNum = parseFloat(clean['Spread (feet)']);
        clean['Spread (feet)'] = Number.isFinite(spreadNum) ? spreadNum : 0;

        // Process articles for this plant
        clean.Articles = [];
        for (const record of articleRecords) {
            if (record['Scientific Name'] === clean['Scientific Name']) {
                const sources = record['Source'].split(/\s*,\s*/);
                const sourceUrls = record['Source URL'].split(/\s*,\s*/);
                for (let i = 0; (i < sources.length); i++) {
                    clean.Articles.push({
                        'Source': sources[i],
                        'Source URL': sourceUrls[i]
                    });
                }
            }
        }

        // IMPORTANT:
        // - `massage.js` / `optimize-plants-db` add computed fields that our DB schema requires
        //   (e.g. Flags arrays, Flowering Months By Number, States, Genus, Family, etc).
        // - If we blindly replace documents using only the CSV fields, we will both:
        //   (a) fail schema validation, and (b) lose those computed fields.
        //
        // So when a record already exists, merge it and only overwrite with the latest CSV fields.
        const merged = existing ? { ...existing, ...clean } : clean;

        // Update the plant in the database
        await update(plants, merged);
    }

    // Update nurseries and online stores
    await updateNurseries();
    await updateOnlineStores();
}

async function updateNurseries() {
    // Remove all existing nurseries
    await nurseries.deleteMany({});

    // Fetch and parse nursery data
    const body = await get(process.env.LOCAL_MAP_CSV_URL);
    const records = parse(body, {
        columns: true,
        skip_empty_lines: true
    });

    // Insert nurseries into database
    for (const record of records) {
        const address = `${record.ADDRESS} ${record.CITY}, ${record.STATE} ${record.ZIP}`;
        record.lon = parseFloat(record.Long);
        record.lat = parseFloat(record.Lat);
        await nurseries.insertOne(record);
    }

    log(`Added ${records.length} nurseries to database`);
}

async function updateOnlineStores() {
    // Fetch and parse online store data
    const body = await get(process.env.ONLINE_STORES_CSV_URL);
    const records = parse(body, {
        columns: true,
        skip_empty_lines: true
    });

    // Remove existing online stores data
    await plants.updateMany({},
        {
            $unset: {
                'Online Stores': 1
            }
        }
    );

    // Add online stores to plants
    let updateCount = 0;
    for (const record of records) {
        const result = await plants.updateOne({
            'Scientific Name': record['Scientific Name']
        }, {
            $push: {
                'Online Stores': {
                    url: `${record.Web.trim()}`,
                    label: record.Root.trim()
                }
            }
        });

        if (result.modifiedCount > 0) {
            updateCount++;
        }
    }

    log(`Updated ${updateCount} plants with online store information`);
}

async function update(plants, clean) {
    try {
        await plants.replaceOne({
            _id: clean._id
        }, clean, {
            upsert: true
        });
    } catch (e) {
        // When MongoDB schema validation fails, expose details (paths/types) to help debug quickly.
        // Example: e.errInfo.details.schemaRulesNotSatisfied
        if (e && e.code === 121 && e.errInfo && e.errInfo.details) {
            console.error('MongoDB schema validation failed for plant:', clean && clean._id);
            try {
                console.error(JSON.stringify(e.errInfo.details, null, 2));
            } catch (jsonErr) {
                console.error(e.errInfo.details);
            }
        }
        throw e;
    }
}

async function get(url, type = 'text', tries = 1) {
    let lastError;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            log(`Attempting to fetch ${url} (attempt ${attempt + 1})`);
            const response = await fetch(url, { redirect: 'follow' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response[type]();
            log(`Successfully fetched ${url}`);
            return result;
        } catch (e) {
            log(`Fetch error (attempt ${attempt + 1}): ${e.message}`);
            lastError = e;
            await pause();
        }
    }
    throw lastError;
}

function pause() {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, 5000);
    });
}