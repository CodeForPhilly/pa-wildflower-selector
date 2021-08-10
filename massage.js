const db = require('./lib/db');
const fs = require('fs');
const path = require('path');

go();

async function go() {
  const { plants, close } = await db();
  const values = await plants.find().toArray();
  // Remove wrongly cased plants
  // const names = values.filter(plant => plant['Scientific Name'].match(/ [a-z]/)).map(plant => plant['Scientific Name']);
  // await plants.removeMany({
  //   'Scientific Name': {
  //     $in: names
  //   }
  // });
  // Rename wrongly-cased images
  // const files = fs.readdirSync('./images');
  // const plantList = await plants.find().toArray();
  // files.filter(file => file.match(/ [a-z]/)).map(file => {
  //   const plant = plantList.find(plant => plant['Scientific Name'].toLowerCase() === file.toLowerCase().replace(/\..*$/, ''));
  //   fs.renameSync(`images/${file}`, `images/${plant['Scientific Name']}.jpg`);
  // });
  for (const plant of values) {
    const months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
    let [ from, to ] = plant['Flowering Months'].split('–');
    from = months.indexOf(from);
    to = months.indexOf(to);
    if ((from > -1) && (to > -1)) {
      const matching = [];
      for (let i = from; (i <= to); i++) {
        matching.push(i);
      }
      await plants.updateOne({
        _id: plant._id
      }, {
        $set: {
          'Flowering Months By Number': matching
        }
      });
    } else {
      await plants.updateOne({
        _id: plant._id
      }, {
        $unset: {
          'Flowering Months By Number': 1
        }
      });
    }
    if (plant?.metadata?.url && (!plant.imageUrl)) {
      await plants.updateOne({
        _id: plant._id
      }, {
        $set: {
          imageUrl: plant.metadata.url
        }
      });
    }
    if (!plant.source || (plant.source === 'wikimediaPageSearch')) {
      if (plant?.metadata?.extmetadata) {
        const artist = plant?.metadata?.extmetadata?.Artist?.value || 'Unknown';
        const licenseUrl = plant?.metadata?.extmetadata?.LicenseUrl?.value;
        const licenseShortName = plant?.metadata?.extmetadata?.LicenseShortName?.value;
        await plants.updateOne({
          _id: plant._id
        }, {
          $set: {
            source: 'wikimediaPageSearch',
            attribution: `${artist}, ${licenseUrl ? `<a href="${licenseUrl}">` : ''}${licenseShortName}${licenseUrl ? '</a>' : ''}`
          }
        });
      }
    }
  }
  await close();
}
