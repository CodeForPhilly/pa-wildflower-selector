const fetch = require('node-fetch');
const parse = require('csv-parse/lib/sync');
const qs = require('qs');
const cheerio = require('cheerio');
const fs = require('fs');
const db = require('./lib/db');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { RateLimiter } = require('limiter');
const settings = require('./settings.json');
const serviceAccount = require('./service-account.json');
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
let close = null;

async function go() {
  try {
    if (!fs.existsSync(`${__dirname}/images`)) {
      fs.mkdirSync(`${__dirname}/images`);
    }
    const info = await db();
    plants = info.plants;
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
  const body = await get(settings.masterCsvUrl);
  const articlesBody = await get(settings.articlesCsvUrl);
  const doc = new GoogleSpreadsheet(settings.imageUrlsSheetId);
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
  let i = 0;
  for (const record of records) {
    i++;
    const clean = Object.fromEntries(
      Object.entries(record).map(([ key, value ]) => {
        return [ key.trim(), value.trim() ];
      })
    );
    let name = clean['Scientific Name'];
    console.log(`${name} (${i} of ${records.length})`);
    clean._id = name;
    let sp = (clean['Super Plant'].trim() == 'Yes');
    let hasImage = false;
    let hasPreview = false;
    const existing = await plants.findOne({
      _id: name
    });
    clean.Superplant = sp;
    clean.metadata = existing?.metadata;
    clean.imageUrl = existing?.imageUrl;
    knownImages[name] = rowsByName?.[name]?.['Manual File URL'] || existing?.imageUrl;

    if (fs.existsSync(`${__dirname}/images/${name}.jpg`)) {
      hasImage = true;
      clean.hasImage = true;
    }

    if (fs.existsSync(`${__dirname}/images/${name}.preview.jpg`)) {
      hasPreview = true;
      clean.hasPreview = true;
    }

    // If knownImages[name] && !hasImage -> fetch image, set imageUrl property
    // If knownImages[name] && !imageUrl -> fetch image, set imageUrl property
    // If knownImages[name] && imageUrl !== knownImages[name] -> fetch image, set imageUrl property
    // If !knownImages[name] -> try to discover, fetch image, set imageUrl property,
    //   set crawled image URL

    const known = knownImages[name];
    const imageUrl = clean.imageUrl;
    let discovered;

    if (!argv['skip-images']) {
      if (known && (!hasImage || !imageUrl || (imageUrl !== known))) {
        await fetchImage(clean, name, known);
      } else if (!known) {
        // Discover if: (1) we have an image and yet no URL for it,
        // (2) we're not skipping missing images so we want to try again
        // with wikimedia, or (3) we don't know what we don't know
        if ((hasImage && !knownImages[name]) || (!hasImage && !argv['skip-missing-images'])) {
          discovered = await discoverImage(clean, name);
          if (discovered) {
            await fetchImage(clean, name, discovered);
          }
        }
      }
      if (clean.hasImage && !hasPreview) {
        console.log(`Scaling preview of ${name}`);
        spawn('convert', [ `${__dirname}/images/${name}.jpg`, '-resize', '248x248^', '-gravity', 'center', '-extent', '248x248', '-strip', '-quality', '85', `${__dirname}/images/${name}.preview.jpg` ]);
        hasPreview = true;
        clean.hasPreview = true;
      }
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
    titles: name.toLowerCase(),
    // Or do this, but the results are too fuzzy
    // list: 'search',
    // srsearch: name
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
    info = JSON.parse(await get(`https://api.creativecommons.engineering/v1/images?${qs.stringify(params)}`));
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

function has(o, k) {
  return Object.keys(o).includes(k);
}

function getTerms(s) {
  return terms[slugify(s)] || s;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
