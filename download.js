const VERSION = '1.1.0';
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const parse = require('csv-parse/lib/sync');
const db = require('./lib/db');
const { RateLimiter } = require('limiter');

// Logging function
function log(message) {
    console.log(message);
}

// Ensure required environment variables are set
const requiredEnvVars = [
    'MASTER_CSV_URL',
    'ARTICLES_CSV_URL',
    'IMAGE_URLS_SHEET_ID',
    'SUPERPLANTS_CSV_URL',
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
        if (!fs.existsSync(`${__dirname}/images`)) {
            fs.mkdirSync(`${__dirname}/images`);
        }
        const info = await db();
        plants = info.plants;
        nurseries = info.nurseries;
        close = info.close;

        // Get initial count - using countDocuments instead of count
        const initialCount = await plants.countDocuments({});
        log(`Initial database count: ${initialCount} plants`);

        await downloadMain();
        
        // Get final count - using countDocuments instead of count
        const finalCount = await plants.countDocuments({});
        log(`Final database count: ${finalCount} plants`);

        await close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

async function downloadMain() {
    // Fetch CSV data
    const masterData = await get(process.env.MASTER_CSV_URL);

    // Parse CSV into JSON objects
    const records = parse(masterData, { columns: true, skip_empty_lines: true });

    // Remove any plants from the database that are not in the latest CSV
    // Using deleteMany instead of remove
    await plants.deleteMany({
        _id: { $nin: records.map(record => record['Scientific Name']) }
    });

    // Process and write each plant record to MongoDB
    for (const record of records) {
        // Transform record into clean structure
        const clean = Object.fromEntries(Object.entries(record).map(([key, value]) => [key.trim(), value.trim()]));
        let name = clean['Scientific Name'];

        clean._id = name;
        clean.metadata = null;  // Placeholder for metadata
        clean.imageUrl = null;
        clean.hasImage = false;
        clean.hasPreview = false;

        // Write to MongoDB
        await update(plants, clean);
    }
}

async function update(plants, clean) {
    await plants.replaceOne({ _id: clean._id }, clean, { upsert: true });
}

async function get(url, type = 'text') {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const response = await fetch(url, { redirect: 'follow' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response[type]();
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    throw new Error(`Failed to fetch ${url} after multiple attempts`);
}
