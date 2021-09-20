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
    const height = plant['Height (feet)'];
    if (height) {
      let matching = [];
      if (height.includes('–')) {
        let [ from, to ] = height.split('–').map(parseFloat);
        if (!isNaN(from) && !isNaN(to)) {
          from = Math.floor(from);
          to = Math.floor(to);
          for (let i = from; (i <= to); i++) {
            matching.push(i);
          }
        }
      } else {
        matching.push(Math.floor(parseFloat(height)));
      }
      await plants.updateOne({
        _id: plant._id
      }, {
        $set: {
          'Height (feet) By Number': matching
        }
      });
    } else {
      await plants.updateOne({
        _id: plant._id
      }, {
        $unset: {
          'Height (feet) By Number': 1
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
    let plantTypeFlags = [];
    const plantType = plant['Plant Type'];
    const matches = plantType.match(/^(.*?)(\(.*?\))?$/);
    if (!matches) {
      console.error(`Don't know how to handle ${plantType}`);
    } else {
      plantTypeFlags = matches[1].split(/, /);
      if (matches[2]) {
        plantTypeFlags = [ ...plantTypeFlags, ...matches[2].split(/ or /) ]; 
      }
      plantTypeFlags = plantTypeFlags.map(flag => flag.trim().replace('(', '').replace(')', ''));
      await plants.updateOne({
        _id: plant._id
      }, {
        $set: {
          'Plant Type Flags': plantTypeFlags
        }
      });
    }
    const sunExposureFlags = plant['Sun Exposure'].split(', ').map(capitalize);
    await plants.updateOne({
      _id: plant._id
    }, {
      $set: {
        'Sun Exposure Flags': sunExposureFlags
      }
    });
  }
  await close();
}

function capitalize(s) {
  return s.split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
}
