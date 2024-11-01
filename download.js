const fetch = require('node-fetch');
const parse = require('csv-parse/lib/sync');
const qs = require('qs');
const fs = require('fs');
const db = require('./lib/db');
const { GoogleSpreadsheet } = require('google-spreadsheet');
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
  const body = await get(process.env.MASTER_CSV_URL);
  const articlesBody = await get(process.env.ARTICLES_CSV_URL);
  const doc = new GoogleSpreadsheet(process.env.IMAGE_URLS_SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key
  });
  await limiter.removeTokens(1);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  await limiter.removeTokens(1);
  const rows = await sheet.getRows();
  const rowsByName = {};
  const knownImages = {};
  for (const row of rows) {
    const name = row['Scientific Name'];
    rowsByName[name] = row;
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
  
  // Get list of existing images
  const existingImages = new Set();
  fs.readdirSync(`${__dirname}/images`).forEach(file => {
    if (!file.endsWith('.preview.jpg')) {
      existingImages.add(file.replace('.jpg', ''));
    }
  });

  // Filter records to only those missing images
  const missingRecords = records.filter(record => {
    const name = record['Scientific Name'].trim();
    return !existingImages.has(name);
  });

  console.log(`Found ${missingRecords.length} plants missing images out of ${records.length} total plants`);
  
  let i = 0;
  for (const record of missingRecords) {
    i++;
    const clean = Object.fromEntries(
      Object.entries(record).map(([ key, value ]) => {
        return [ key.trim(), value.trim() ];
      })
    );
    let name = clean['Scientific Name'];
    console.log(`${name} (${i} of ${missingRecords.length})`);
    clean._id = name;
    let sp = (clean['Super Plant'].trim() == 'Yes');
    let hasImage = false;
    let hasPreview = false;
    const existing = await plants.findOne({
      _id: name
    });
    clean.Superplant = sp;
    clean.Showy = clean.Showy === 'Yes';
    clean.metadata = existing?.metadata;
    clean.imageUrl = existing?.imageUrl;
    knownImages[name] = rowsByName?.[name]?.['Manual File URL'] || existing?.imageUrl;

    // First check if images exist in the filesystem
    const fullImagePath = `${__dirname}/images/${name}.jpg`;
    const previewImagePath = `${__dirname}/images/${name}.preview.jpg`;

    hasImage = fs.existsSync(fullImagePath);
    hasPreview = fs.existsSync(previewImagePath);

    clean.hasImage = hasImage;
    clean.hasPreview = hasPreview;

    let discovered;  // Moved this declaration up here

    // Only proceed with image handling if we don't have the image already
    if (!argv['skip-images'] && !hasImage) {
      const known = knownImages[name];

      if (known) {
        // We have a URL in the Google Sheet but no image file
        await fetchImage(clean, name, known);
      } else if (!argv['skip-missing-images']) {
        // No image file and no URL in Sheet - try to discover one
        discovered = await discoverImage(clean, name);
        if (discovered) {
          await fetchImage(clean, name, discovered);
        }
      }

      // Recheck if we now have an image after fetching
      hasImage = fs.existsSync(fullImagePath);
      clean.hasImage = hasImage;
    }

    // Create preview if needed
    if (clean.hasImage && !hasPreview) {
      console.log(`Scaling preview of ${name}`);
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
    if (!rowsByName[name]) {
      await limiter.removeTokens(1);
      await sheet.addRow({
        'Scientific Name': name,
        'Crawler URL': discovered || ''
      });
    } else {
      const row = rowsByName[name];
      if ((row['Crawler URL'] || '') !== (clean.imageUrl || '')) {
        if (discovered) {
          row['Crawler URL'] = clean.imageUrl;
          await limiter.removeTokens(1);
          await row.save();
        }
      }
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
          url: `https://${record.Root.trim()}`,
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
  console.log('> wikipedia');
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
  console.log('> wikimedia');
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
  console.log('> fetch image');
  const buffer = await get(imageUrl, 'buffer', 5);
  fs.writeFileSync('/tmp/original.jpg', buffer);
  console.log('> convert');
  spawn('convert', [ '/tmp/original.jpg', '-geometry', '1140x', `${__dirname}/images/${name}.jpg` ]);
  clean.hasImage = true;
  clean.imageUrl = imageUrl;
  console.log('> completed fetch image');
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
  for (let tries = 0; (tries < 5); tries++) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      return await response[type]();
    } catch (e) {
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
