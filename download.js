const fetch = require('node-fetch');
const parse = require('csv-parse/lib/sync');
const qs = require('qs');
const cheerio = require('cheerio');
const fs = require('fs');

const db = require('./lib/db');

go();

async function go() {
  const { plants, close } = await db();
  const body = await get('https://docs.google.com/spreadsheets/d/1R_zhN3GUxhDEMlGFMhcPB_gAoaE9IoyWi10I_nM9f3o/export?format=csv&id=1R_zhN3GUxhDEMlGFMhcPB_gAoaE9IoyWi10I_nM9f3o&gid=1957761759');
  const records = parse(body, {
    columns: true,
    skip_empty_lines: true
  });
  for (const record of records) {
    const clean = Object.fromEntries(
      Object.entries(record).map(([ key, value ]) => {
        return [ key.trim(), value.trim() ];
      })
    );
    let name = clean['Scientific Name'];
    clean._id = name;
    let hasImage = false;
    const existing = await plants.findOne({
      _id: name
    });
    clean.metadata = existing?.metadata;
    let hasMetadata = !!clean.metadata;
    if (fs.existsSync(`${__dirname}/images/${name}.jpg`)) {
      hasImage = true;
      console.log(`${name}: already downloaded`);
    }
    if (!hasImage || !hasMetadata) {
      const params = {
        action: 'query',
        prop: 'pageimages',
        format: 'json',
        formatversion: '2',
        piprop: 'name',
        titles: name,
        // Or do this, but the results are too fuzzy
        // list: 'search',
        // srsearch: name
      };
      const info = JSON.parse(await get(`https://en.wikipedia.org/w/api.php?${qs.stringify(params)}`));
      const pageimage = info?.query?.pages?.[0]?.pageimage;
      let details;
      let imageUrl;
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
        }
      }
      if (!imageUrl) {
        console.log(`${name}: NONE`);
        hasImage = false;
      } else {
        if (!hasImage) {
          const buffer = await get(imageUrl, 'buffer');
          console.log(`${name}: ${imageUrl}`);
          fs.writeFileSync('/tmp/original.jpg', buffer);
          spawn('convert', [ '/tmp/original.jpg', '-geometry', '1140x', `${__dirname}/images/${name}.jpg` ]);
          hasImage = true;
        }
      }
      await pause();
    }
    clean.hasImage = hasImage;
    await plants.replaceOne({
      _id: clean._id
    }, clean, {
      upsert: true
    });
  }
  await close();
}

async function get(url, type = 'text') {
  const response = await fetch(url, { redirect: 'follow' });
  return response[type]();
}

function pause() {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 5000);
  });
}

function spawn(cmd, args) {
  return require('child_process').spawnSync(cmd, args);
}
