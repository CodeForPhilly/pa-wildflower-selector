require('dotenv').config();
const db = require('./lib/db');
const fs = require('fs');
const path = require('path');
const { match } = require('assert');

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function toNumberOrZero(v) {
  if (isFiniteNumber(v)) return v;
  const n = parseFloat(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

function toIntOrZero(v) {
  if (isFiniteNumber(v)) return Math.trunc(v);
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'yes' || s === 'true' || s === '1') return true;
  return false;
}

function splitFlags(v, regex, mapper = capitalize) {
  const s = String(v ?? '');
  if (!s.trim()) return [];
  return s.split(regex).map(mapper).map(x => x.trim()).filter(flag => flag.length > 0);
}

function computeFloweringMonthsByNumber(monthStr) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const s = String(monthStr ?? '').trim();
  if (!s) return [];
  // Support en dash, em dash, and hyphen ranges (e.g. "May–Jun", "May-Jun", "May—Jun")
  const parts = s.split(/[–—-]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    const idx = months.indexOf(parts[0]);
    return idx > -1 ? [idx] : [];
  }
  const from = months.indexOf(parts[0]);
  const to = months.indexOf(parts[1]);
  if (from === -1 || to === -1) return [];
  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

// Work around lack of top level await while still reporting errors properly
go().then(() => {
  // All done
  console.log('Massage complete');
}).catch(e => {
  console.error(e);
  process.exit(1);
});

async function go() {
  const { plants, close } = await db();

  // Helpful when schema validation is enabled: print details so failures are actionable.
  const originalUpdateOne = plants.updateOne.bind(plants);
  plants.updateOne = async (...args) => {
    try {
      return await originalUpdateOne(...args);
    } catch (e) {
      if (e && e.code === 121 && e.errInfo && e.errInfo.details) {
        console.error('MongoDB schema validation failed during massage.updateOne');
        try {
          console.error(JSON.stringify(e.errInfo.details, null, 2));
        } catch (jsonErr) {
          console.error(e.errInfo.details);
        }
      }
      throw e;
    }
  };

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

    // Ensure required fields exist and have valid types BEFORE any other updates.
    // This allows us to repair legacy/invalid documents even when validation is strict.
    const scientificName = plant['Scientific Name'] || plant._id;
    const genus = (String(scientificName ?? '').split(/\s+/)[0] || '').trim();
    const family = plant['Plant Family'] || plant['Family'] || '';

    // Build required flags (empty arrays are acceptable to the schema).
    const plantType = plant['Plant Type'] || '';
    let plantTypeFlags = [];
    let lifeCycleFlags = [];
    const matches = String(plantType).match(/^(.*?)(\(.*?\))?$/);
    if (matches) {
      plantTypeFlags = matches[1].split(/, /);
      if (matches[2]) {
        plantTypeFlags = [...plantTypeFlags, ...matches[2].split(/ or /)];
      }
      plantTypeFlags = plantTypeFlags.map(flag => flag.trim().replace('(', '').replace(')', '')).map(capitalize).filter(Boolean);
      const lifeCycles = ['Annual', 'Biennial', 'Perennial'];
      lifeCycleFlags = plantTypeFlags.filter(pt => lifeCycles.includes(pt));
      plantTypeFlags = plantTypeFlags.filter(pt => !lifeCycles.includes(pt));
    }

    const sunExposureFlags = splitFlags(plant['Sun Exposure'], /,\s*/, capitalize);
    const soilMoistureFlags = splitFlags(plant['Soil Moisture'], /,\s*/, capitalize);
    const pollinatorFlags = splitFlags(plant['Pollinators'], /\s*(?:,|;)+\s*/, capitalize);
    const flowerColorFlags = splitFlags(plant['Flower Color'], /\s*[-—–,]\s*/, capitalize);
    const availabilityFlags = [];
    if (String(plant['Online Flag'] ?? '') === '1') availabilityFlags.push('Online');
    if (String(plant['Local Flag'] ?? '') === '1') availabilityFlags.push('Local');

    const requiredFixes = {
      'Height (feet)': toNumberOrZero(plant['Height (feet)']),
      'Spread (feet)': toNumberOrZero(plant['Spread (feet)']),
      'Recommendation Score': toIntOrZero(plant['Recommendation Score']),
      'Showy': toBool(plant['Showy']),
      'Superplant': toBool(plant['Superplant']),
      'States': splitFlags(plant['Distribution in USA'], /,\s*/, s => String(s).trim()).filter(Boolean),
      'Genus': genus,
      'Family': String(family ?? ''),
      'Sun Exposure Flags': sunExposureFlags,
      'Soil Moisture Flags': soilMoistureFlags,
      'Plant Type Flags': plantTypeFlags,
      'Life Cycle Flags': lifeCycleFlags,
      'Pollinator Flags': pollinatorFlags,
      'Flower Color Flags': flowerColorFlags,
      'Availability Flags': availabilityFlags,
      'Flowering Months By Number': computeFloweringMonthsByNumber(plant['Flowering Months']),
    };

    await plants.updateOne({ _id: plant._id }, { $set: requiredFixes });

    // Check if image files exist and set hasImage and hasPreview flags
    const fullImagePath = `${__dirname}/images/${plant._id}.jpg`;
    const previewImagePath = `${__dirname}/images/${plant._id}.preview.jpg`;
    const hasImage = fs.existsSync(fullImagePath);
    const hasPreview = fs.existsSync(previewImagePath);

    await plants.updateOne({
      _id: plant._id
    }, {
      $set: {
        hasImage: hasImage,
        hasPreview: hasPreview
      }
    });

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
      await plants.insertOne(plant);
      await plants.removeOne({
        _id: name
      });
      const oldName = `${__dirname}/images/${name}.jpg`;
      const newName = `${__dirname}/images/${renamed}.jpg`;
      if (fs.existsSync(oldName)) {
        fs.renameSync(oldName, newName);

        // Update hasImage flag for renamed plant
        await plants.updateOne({
          _id: renamed
        }, {
          $set: {
            hasImage: true
          }
        });
      }
    }

    // Process Flowering Months into an array of flags
    // NOTE: This field is required by strict DB schema. Never $unset it.
    const floweringMonthsByNumber = computeFloweringMonthsByNumber(plant['Flowering Months']);
    await plants.updateOne({ _id: plant._id }, { $set: { 'Flowering Months By Number': floweringMonthsByNumber } });
    var states = plant['Distribution in USA'].split(', ')
    await plants.updateOne({
      _id: plant._id
    }, {
      $set: {
        'States': states
      }
    });
    // Convert height to number (no ranges, just single values)
    const height = plant['Height (feet)'];
    if (height !== undefined && height !== null) {
      const heightNum = typeof height === 'number' ? height : parseFloat(height);
      if (!isNaN(heightNum)) {
        await plants.updateOne({
          _id: plant._id
        }, {
          $set: {
            'Height (feet)': heightNum
          }
        });
      }
    }
    
    // Convert spread to number for consistency
    const spread = plant['Spread (feet)'];
    if (spread !== undefined && spread !== null) {
      const spreadNum = typeof spread === 'number' ? spread : parseFloat(spread);
      if (!isNaN(spreadNum)) {
        await plants.updateOne({
          _id: plant._id
        }, {
          $set: {
            'Spread (feet)': spreadNum
          }
        });
      }
    }



    // Fix Reccomendation Score to be an int not a string
    const score = plant['Recommendation Score'];
    if (typeof score === 'string' || score instanceof String) {
      const numScore = parseFloat(score);
      if (!isNaN(numScore)) {
        await plants.updateOne({
          _id: plant._id
        }, {
          $set: {
            'Recommendation Score': Math.trunc(numScore)
          }
        });
      } else {
        await plants.updateOne({
          _id: plant._id
        }, {
          $set: {
            'Recommendation Score': 0
          }
        });
      }
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
    // NOTE: "Flags" fields + required fields are computed and fixed at the top of the loop
    // in a single `$set` to keep the document schema-valid under strict validation.
  }

  await close();
}

function capitalize(s) {
  return s.split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
}