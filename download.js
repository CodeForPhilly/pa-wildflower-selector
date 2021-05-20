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
      const url = `https://www.wikipedia.org/search-redirect.php?${qs.stringify({ search: name })}`;
      const page = await get(url);
      const $ = cheerio.load(page);
      const $infobox = $('.infobox.biota');
      let $img;
      let imgUrl;
      if ($infobox.length) {
        $img = $infobox.find('img').eq(0);
      }
      if ($img && $img.length) {
        imgUrl = $img.attr('src');
        imgUrl = imgUrl.replace(/(\.(jpg|JPG|JPEG|jpeg|gif|GIF|PNG|png)).*$/, '$1');
        imgUrl = imgUrl.replace(/\d+px\-/, '');
        const name = imgUrl.match(/\/([^\/]+)$/)[1];
        imgUrl = `https:${imgUrl}/800px-${name}`;
      }
      if (imgUrl) {
        console.log(`${name}: ${imgUrl}`);
        const buffer = await get(imgUrl, 'buffer');
        fs.writeFileSync(`${__dirname}/images/${name}.jpg`, buffer);
        hasImage = true;
      } else {
        console.log(`${name}: NONE`);
        hasImage = false;
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
