const db = require('./lib/db');
const fs = require('fs');
const path = require('path');
const { match } = require('assert');

// Work around lack of top level await while still reporting errors properly
go().then(() => {
  // All done
}).catch(e => {
  console.error(e);
  process.exit(1);
});

async function go() {
  const { plants, close } = await db();
  let values = await plants.find().toArray();

  // Fix a small set of plants that already had duplicate records
  // when case was not taken into account. They were all
  // x-class (hybrids)
  const seen = new Set();
  for (const plant of values) {
    if (seen.has(plant._id.toLowerCase())) {
      await plants.removeOne({ _id: plant._id });
      values = values.filter(value => value._id !== plant._id);
    } else {
      seen.add(plant._id.toLowerCase());
    }
  }

  for (let i = 0; (i < values.length); i++) {
    let plant = values[i];

    // Fix plants whose scientific names did not follow the canonical case pattern
    const name = plant._id;
    const renamed = name.substring(0, 1) + name.substring(1).toLowerCase();
    if (name.match(/[A-Z].*?[A-Z]/)) {
      console.log(`Renaming ${name} to ${renamed}`);
      plant = {
        ...plant,
        _id: renamed,
        'Scientific Name': renamed
      };
      await plants.insert(plant);
      await plants.removeOne({
       _id: name
      });
      fs.renameSync(`${__dirname}/images/${name}.jpg`, `${__dirname}/images/${renamed}.jpg`);
    }

    // Process Flowering Months into an array of flags
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

    // Process height ranges into an array of flags (lazy querying, consider a better representation)
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
      const average = matching.length > 1 ? matching[Math.floor(matching.length / 2)] : matching[0];
      await plants.updateOne({
        _id: plant._id
      }, {
        $set: {
          'Height (feet) By Number': matching,
          'Average Height': average
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

    if (plant['Flower Color'] === '') {
      // Handle null values consistently for fields we sort on
      await plants.updateOne({
        _id: plant._id
      }, {
        $unset: {
          'Flower Color': 1
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
      plantTypeFlags = plantTypeFlags.map(flag => flag.trim().replace('(', '').replace(')', '')).map(capitalize);
      const lifeCycles = [ 'Annual', 'Biennial', 'Perennial' ];
      const lifeCycleFlags = plantTypeFlags.filter(plantType => lifeCycles.includes(plantType));
      plantTypeFlags = plantTypeFlags.filter(plantType => !lifeCycles.includes(plantType));
      await plants.updateOne({
        _id: plant._id
      }, {
        $set: {
          'Plant Type Flags': plantTypeFlags,
          'Life Cycle Flags': lifeCycleFlags
        }
      });
    }
    const sunExposureFlags = plant['Sun Exposure'].split(', ').map(capitalize).filter(flag => flag.length > 0);
    await plants.updateOne({
      _id: plant._id
    }, {
      $set: {
        'Sun Exposure Flags': sunExposureFlags
      }
    });
    const soilMoistureFlags = plant['Soil Moisture'].split(', ').map(capitalize).filter(flag => flag.length > 0);
    if (soilMoistureFlags.length) {
      await plants.updateOne({
        _id: plant._id
      }, {
        $set: {
          'Soil Moisture Flags': soilMoistureFlags
        }
      });
    } else {
      await plants.updateOne({
        _id: plant._id
      }, {
        $unset: {
          'Soil Moisture Flags': 1
        }
      });
    }
    const pollinatorFlags = plant['Pollinators'].split(/\s*(?:,|;)+\s*/).map(capitalize).filter(flag => flag.length > 0);
    await plants.updateOne({
      _id: plant._id
    }, {
      $set: {
        'Pollinator Flags': pollinatorFlags
      }
    });
    const propagationFlags = plant['Propagation'].split(/\s*(?:,|;)+\s*/).map(capitalize).filter(flag => flag.length > 0);
    await plants.updateOne({
      _id: plant._id
    }, {
      $set: {
        'Propagation Flags': propagationFlags
      }
    });
    const flowerColorFlags = (plant['Flower Color'] || '').split(/\s*[-—–,]\s*/).map(capitalize).filter(flag => flag.length > 0);
    await plants.updateOne({
      _id: plant._id
    }, {
      $set: {
        'Flower Color Flags': flowerColorFlags
      }
    });

  }
  await close();
}

function capitalize(s) {
  return s.split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
}
