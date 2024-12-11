const VERSION = '1.0.4';
const fs = require('fs');
const path = require('path');

// Create a logging function
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

// Replace console.log calls with log()
log(`Running download.js version ${VERSION}`);

const fetch = require('node-fetch');
const parse = require('csv-parse/lib/sync');
const qs = require('qs');
const db = require('./lib/db');
const { RateLimiter } = require('limiter');
const yaml = require('yaml');

if (fs.existsSync(`${__dirname}/secrets.yaml`)) {
  // In local development we pull these secrets directly from secrets.yaml,
  // in production they are present as environment variables already and
  // secrets.yaml is not present
  const secrets = yaml.parse(fs.readFileSync(`${__dirname}/secrets.yaml`, { encoding: 'utf8' })).stringData;
  Object.assign(process.env, secrets);
}

if (!process.env.MASTER_CSV_URL) {
  console.error('MASTER_CSV_URL is not set and secrets.yaml is not present either, see the README');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
const argv = require('boring')();
const slugify = require('sluggo');

const terms = {
  cc0: 'Public domain',
  by: 'Credit must be given to the creator',
  'by-sa': 'Credit must be given to the creator. Adaptations must be shared under the same terms',
  'by-nc': 'Credit must be given to the creator. Only noncommercial uses of the work are permitted',
  'by-nc-sa': 'Credit must be given to the creator. Only noncommercial uses of the work are permitted. Adaptations must be shared under the same terms',
  'by-nd': 'Credit must be given to the creator. No derivatives or adaptations of the work are permitted',
  'by-nc-nd': 'Credit must be given to the creator. Only noncommercial uses of the work are permitted. No derivatives or adaptations of the work are permitted'
};

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
    await downloadMain();
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
  
  // Replace Google Sheets API with direct CSV fetch
  log('Fetching image URLs from CSV...');
  const imageUrlsCsv = await get('https://docs.google.com/spreadsheets/d/e/2PACX-1vQSTtGIrzaXpE7vAabYb6MhkT1W-IczPg2gIYYHHlSMaUSwkdxEZvFRC9iomENZ7G4Lc8k1ulE79_Em/pub?gid=0&single=true&output=csv');
  
  // Parse the CSV directly instead of using Google Sheets API
  const imageUrlsRecords = parse(imageUrlsCsv, {
    columns: true,
    skip_empty_lines: true
  });
  
  const rowsByName = {};
  for (const row of imageUrlsRecords) {
    const name = row['Scientific Name'];
    rowsByName[name] = row;
    log(`Found in spreadsheet: ${name}, Manual URL: ${row['Manual File URL']}`);
  }

  const records = parse(body, {
    columns: true,
    skip_empty_lines: true
  });
  const articleRecords = parse(articlesBody, {
    columns: true,
    skip_empty_lines: true
  });
  await plants.remove({
    _id: { $nin: records.map(record => record['Scientific Name']) }
  }, {
    multi: true
  });

  log(`Processing ${records.length} plants from master CSV`);
  
  let i = 0;
  for (const record of records) {
    i++;
    const clean = Object.fromEntries(
      Object.entries(record).map(([ key, value ]) => {
        return [ key.trim(), value.trim() ];
      })
    );
    let name = clean['Scientific Name'];
    log(`${name} (${i} of ${records.length})`);
    clean._id = name;
    let sp = (clean['Super Plant'].trim() == 'Yes');
    const existing = await plants.findOne({
      _id: name
    });
    clean.Superplant = sp;
    clean.Showy = clean.Showy === 'Yes';
    clean.metadata = existing?.metadata;
    clean.imageUrl = existing?.imageUrl;
    clean.hasImage = existing?.hasImage || false;
    clean.hasPreview = existing?.hasPreview || false;

    // Only handle images if not skipping
    if (!argv['skip-images']) {
      const manualFileUrl = rowsByName?.[name]?.['Manual File URL'];
      const fullImagePath = `${__dirname}/images/${name}.jpg`;
      const previewImagePath = `${__dirname}/images/${name}.preview.jpg`;

      log(`\nProcessing ${name}:`);
      log(`- Manual File URL: ${manualFileUrl}`);
      log(`- Full image path: ${fullImagePath}`);
      log(`- Has existing image: ${fs.existsSync(fullImagePath)}`);

      clean.hasImage = fs.existsSync(fullImagePath);
      clean.hasPreview = fs.existsSync(previewImagePath);

      let discovered;
      if (!clean.hasImage) {
        if (manualFileUrl) {
          log(`Attempting to fetch manual URL: ${manualFileUrl}`);
          try {
            await fetchImage(clean, name, manualFileUrl);
            clean.imageUrl = manualFileUrl;
            log('Successfully fetched manual URL');
          } catch (error) {
            log(`Error fetching manual URL: ${error.message}`);
            log(error.stack);  // Log the full error stack trace
            if (!argv['skip-missing-images']) {
              log('Falling back to image discovery...');
              discovered = await discoverImage(clean, name);
              if (discovered) {
                await fetchImage(clean, name, discovered);
              }
            }
          }
        } else {
          log('No manual URL found, trying discovery...');
          if (!argv['skip-missing-images']) {
            discovered = await discoverImage(clean, name);
            if (discovered) {
              await fetchImage(clean, name, discovered);
            }
          }
        }
        clean.hasImage = fs.existsSync(fullImagePath);
        log(`Final hasImage status: ${clean.hasImage}`);
      }

      if (clean.hasImage && !clean.hasPreview) {
        log(`Scaling preview of ${name}`);
        spawn('convert', [
          fullImagePath,
          '-resize', '248x248^',
          '-gravity', 'center',
          '-extent', '248x248',
          '-strip',
          '-quality', '85',
          previewImagePath
        ]);
        clean.hasPreview = true;
      }

      // Skip Google Sheets operations since we're using CSV now
      const row = rowsByName[name];
      if (row && row['Manual File URL']) {
        const start = row['Manual Attribution URL'] ? `<a href="${row['Manual Attribution URL']}">` : '';
        const end = row['Manual Attribution URL'] ? '</a>' : '';
        clean.source = 'manual';
        clean.attribution = `${start}${row['Manual Attribution']}${end}`;
      }
    
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
    
      await update(plants, clean);
    }
  }

  await updateNurseries();
  await updateOnlineStores();
}

async function updateNurseries() {
  await nurseries.removeMany();
  const body = await get(process.env.LOCAL_MAP_CSV_URL);
  const records = parse(body, {
    columns: true,
    skip_empty_lines: true
  });
  for (const record of records) {
    const address = `${record.ADDRESS} ${record.CITY}, ${record.STATE} ${record.ZIP}`;
    record.lon = parseFloat(record.Long);
    record.lat = parseFloat(record.Lat);
    await nurseries.insertOne(record);
  }
}

async function updateOnlineStores() {
  const body = await get(process.env.ONLINE_STORES_CSV_URL);
  const records = parse(body, {
    columns: true,
    skip_empty_lines: true
  });
  await plants.updateMany({},
    {
      $unset: {
        'Online Stores': 1
      }
    }
  );
  for (const record of records) {
    await plants.updateOne({
      'Scientific Name': record['Scientific Name']
    }, {
      $push: {
        'Online Stores': {
          url: `${record.Web.trim()}`,
          label: record.Root.trim()
        }
      }
    });
  }
}

async function discoverImage(clean, name) {
  const result = await discoverViaWikipediaPage(clean, name);
  if (result) {
    return result;
  }
  return discoverViaWikimediaCommonsSearch(clean, name);
}

async function discoverViaWikipediaPage(clean, name) {
  log('> wikipedia');
  const params = {
    action: 'query',
    prop: 'pageimages',
    format: 'json',
    formatversion: '2',
    piprop: 'name',
    titles: name.toLowerCase()
  };
  const url = `https://en.wikipedia.org/w/api.php?${qs.stringify(params)}`;
  const info = JSON.parse(await get(url));
  const pageimage = info?.query?.pages?.[0]?.pageimage;
  let details;
  let imageUrl;
  await pause();
  if (pageimage) {
    const detailParams = {
      action: 'query',
      prop: 'imageinfo',
      format: 'json',
      formatversion: '2',
      titles: `File:${pageimage}`,
      iiprop: 'url|extmetadata'
    };
    const response = JSON.parse(await get(`https://commons.wikimedia.org/w/api.php?${qs.stringify(detailParams)}`));
    details = response?.query?.pages?.[0]?.imageinfo?.[0];
    if (details) {
      details.title = response.query.pages[0].title;
      details.pageid = response.query.pages[0].pageid;
      imageUrl = details.url;
      clean.metadata = details;
      const artist = details?.extmetadata?.Artist?.value || 'Unknown';
      const licenseUrl = details?.extmetadata?.LicenseUrl?.value;
      const licenseShortName = details?.extmetadata?.LicenseShortName?.value;
      clean.source = 'wikimediaPageSearch';
      clean.attribution = `${artist}, ${licenseUrl ? `<a href="${licenseUrl}">` : ''}${licenseShortName}${licenseUrl ? '</a>' : ''}`;
    }
    return imageUrl;
  } else {
    return null;
  }
}

async function discoverViaWikimediaCommonsSearch(clean, name) {
  log('> wikimedia');
  const params = { q: name.toLowerCase(), page_size: 1, page: 1 };
  let info;
  try {
    info = JSON.parse(await get(`https://api.openverse.engineering/v1/images?${qs.stringify(params)}`));
  } catch (e) {
    console.error(e);
    return null;
  }
  const result = info && info.results && info.results.find(result => slugify(result.title).includes(slugify(name)));
  if (!result) {
    return null;
  }
  clean.source = 'wikimediaCommonsSearch';
  clean.attribution = `${result.creator}, <a href="${result.license_url}">${getTerms(result.license)}</a>`;
  return result.url;
}

async function fetchImage(clean, name, imageUrl) {
  const imagePath = `${__dirname}/images/${name}.jpg`;
  if (fs.existsSync(imagePath)) {
    clean.hasImage = true;
    clean.imageUrl = imageUrl;
    return;
  }
  log(`Fetching from URL: ${imageUrl}`);
  try {
    const buffer = await get(imageUrl, 'buffer', 5);
    log(`Got buffer of size: ${buffer.length}`);
    
    fs.writeFileSync('/tmp/original.jpg', buffer);
    
    const result = spawn('convert', [ '/tmp/original.jpg', '-geometry', '1140x', `${__dirname}/images/${name}.jpg` ]);
    if (result.error) {
      log(`Convert error: ${result.error}`);
    }
    if (result.stderr.length > 0) {
      log(`Convert stderr: ${result.stderr}`);
    }
    
    clean.hasImage = true;
    clean.imageUrl = imageUrl;
  } catch (error) {
    log(`Error in fetchImage: ${error.message}`);
    log(error.stack);
    throw error;
  }
}

async function update(plants, clean) {
  await plants.replaceOne({
    _id: clean._id
  }, clean, {
    upsert: true
  });
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
      if (e.code !== 'EHOSTUNREACH') {
        throw e;
      }
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

function spawn(cmd, args) {
  return require('child_process').spawnSync(cmd, args);
}

function getTerms(s) {
  return terms[slugify(s)] || s;
}
