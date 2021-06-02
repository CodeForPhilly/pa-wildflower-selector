const fetch = require('node-fetch');
const parse = require('csv-parse/lib/sync');
const qs = require('qs');
const cheerio = require('cheerio');
const fs = require('fs');

const db = require('./lib/db');

go();

async function go() {
  const { plants, close } = await db();
  const body = await get('https://docs.google.com/spreadsheets/d/1R_zhN3GUxhDEMlGFMhcPB_gAoaE9IoyWi10I_nM9f3o/export?format=csv&id=1R_zhN3GUxhDEMlGFMhcPB_gAoaE9IoyWi10I_nM9f3o&gid=1814718513');
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
    if (fs.existsSync(`${__dirname}/images/${name}.jpg`)) {
      hasImage = true;
      console.log(`${name}: already downloaded`);
    } else {
      const params = { q: name, page_size: 1, page: 1 };
      const info = JSON.parse(await get(`https://api.creativecommons.engineering/v1/images?${qs.stringify(params)}`));
      if (!(info.results && info.results[0])) {
        console.log(`${name}: NONE`);
        hasImage = false;
      } else {
        const result = info.results[0];
        const buffer = await get(result.url, 'buffer');
        console.log(`${name}: ${result.url}`);
        fs.writeFileSync('/tmp/original.jpg', buffer);
        spawn('convert', [ '/tmp/original.jpg', '-geometry', '1140x', `${__dirname}/images/${name}.jpg` ]);
        clean.wikimediaData = result;
        hasImage = true;
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
