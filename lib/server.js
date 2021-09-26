const express = require('express');
const fs = require('fs');
const quote = require('regexp-quote');

module.exports = async function(plants) {
  const app = express();
  const publicDir = `${__dirname}/../public`;
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  app.use(express.static(publicDir));
  app.use('/images', express.static(`${__dirname}/../images`));
  app.get('/plants', async (req, res) => {
    try {
      const query = {};
      const sorts = {
        'Sort by Common Name (A-Z)': {
          'Common Name': 1
        },
        'Sort by Common Name (Z-A)': {
          'Common Name': -1
        },
        'Sort by Scientific Name (A-Z)': {
          'Scientific Name': 1
        },
        'Sort by Scientific Name (Z-A)': {
          'Scientific Name': -1
        },
        'Sort by Flower Color': {
          'Flower Color': 1
        },
        'Sort by Height (L-H)': {
          'Average Height': 1
        },
        'Sort by Height (H-L)': {
          'Average Height': -1
        }
      };
      const sort = sorts[req.query.sort] ? sorts[req.query.sort] : Object.values(sorts)[0];
      let projection;
      const page = parseInt(req.query.page);
      if (isNaN(page) || (page < 1)) {
        page = 1;
      }
      if (req.query.q && req.query.q.length) {
        query.$text = {
          $search: req.query.q
        };
        // With text search limited to name and scientific name we probably
        // don't need to override the sort order. If we were to expand it to
        // all fields again then we would want that for match quality reasons
        //
        // projection = {
        //   score: {
        //     $meta: 'textScore'
        //   }
        // };
        // sort = {
        //   score: {
        //     $meta: 'textScore'
        //   }
        // };
      }
      const doc = (await plants.find({}).project({ 'Height (feet) By Number': 1 }).sort({ 'Height (feet) By Number': -1 }).limit(1).toArray())[0];
      const heightsOfTallest = doc['Height (feet) By Number'];
      let maxHeight = heightsOfTallest[heightsOfTallest.length - 1];
      heights = [];
      for (let i = 0; (i <= maxHeight); i++) {
        heights.push(i);
      }
      const filters = [
        {
          name: 'Sun Exposure Flags',
          value: [],
          array: true
        },
        {
          name: 'Flowering Months',
          range: true,
          byNumber: 'Flowering Months By Number',
          choices: [ 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec' ],
          value: []
        },
        {
          name: 'Height (feet)',
          range: true,
          byNumber: 'Height (feet) By Number',
          choices: heights,
          value: []
        },
        {
          name: 'Soil Moisture Flags',
          value: [],
          array: true
        },
        {
          name: 'Plant Type Flags',
          value: [],
          array: true
        },
        {
          name: 'Pollinator Flags',
          value: [],
          array: true
        },
        {
          name: 'Superplant',
          choices: [ true ],
          value: [],
          boolean: true
        }
      ];
      const $and = [];
      for (const filter of filters) {
        if (filter.range) {
          const min = parseInt(req.query?.[filter.name]?.min);
          const max = parseInt(req.query?.[filter.name]?.max);
          // Ignore invalid queries. Also ignore when the range is all possible values,
          // which is currently the only way to include plants for which there is
          // no flowering months data
          if ((!isNaN(min) && !isNaN(max)) && (min <= max) && (max !== filter.choices.length - 1)) {
            const $in = [];
            for (let i = min; (i <= max); i++) {
              $in.push(i);
            }
            if ($in.length) {
              $and.push({
                [filter.byNumber]: {
                  $in
                }
              });
            }
          }
        } else if (filter.boolean) {
          let input = req.query[filter.name] || [];
          if (Array.isArray(input)) {
            input = input[0];
          }
          if (input === 'true') {
            $and.push({
              [filter.name]: true
            });
          }
        } else if (filter.array) {
          const input = req.query[filter.name] || [];
          const array = Array.isArray(input) ? input : [ input ];
          const values = array.map(value => value.toString());
          if (values.length) {
            $and.push({
              [filter.name]: {
                $in: values
              }
            });
          }
        } else {
          const input = req.query[filter.name] || [];
          const array = Array.isArray(input) ? input : [ input ];
          const values = array.map(value => value.toString());
          const $or = values.map(value => new RegExp(`(?:^|;|,)\\s*${quote(value)}\\s*(?:;|,|$)`, 'i')).map(value => ({
            [filter.name]: value
          }));
          if ($or.length) {
            $and.push({
              $or
            });
          }
        }
      }
      // If we are sorting by a field we should not return results for which
      // its value is unknown, it's too confusing
      Object.keys(sort).forEach(key => {
        $and.push({
          [key]: {
            $exists: 1
          }
        });
      });
      if ($and.length) {
        query.$and = $and;
      }
      console.log(require('util').inspect(query, { depth: 10 }));
      console.log('Sort is:', sort);
      const total = await plants.countDocuments(query);
      const qb = plants.find(query);
      if (projection) {
        qb.project(projection);
      }
      qb.skip((page - 1) * 10);
      qb.limit(10);
      const results = await qb.sort(sort).toArray();
      for (const filter of filters) {
        if (!filter.choices) {
          filter.choices = (await plants.distinct(filter.name)).filter(choice => ((typeof choice) === 'string') && choice.length);
        }
      }
      const response = {
        results,
        total,
        choices: Object.fromEntries(filters.map(filter => [ filter.name, filter.choices ]))
      };
      return res.send(response);
    } catch (e) {
      console.error('error:', e);
      return res.status(500).send(e);
    }
  });
  const port = process.env.PORT || 3000;
  console.log(`Listening on port ${port}`);
  app.listen(port);
  return app;
};
