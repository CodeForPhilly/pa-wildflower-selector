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
      let sort = {
        _id: 1
      };
      let projection;
      if (req.query.q && req.query.q.length) {
        query.$text = {
          $search: req.query.q
        };
        projection = {
          score: {
            $meta: 'textScore'
          }
        };
        sort = {
          score: {
            $meta: 'textScore'
          }
        };
      }
      let heights = await plants.distinct('Height (feet) By Number');
      let maxHeight = heights[heights.length - 1];
      for (let i = 0; (i <= maxHeight); i++) {
        heights.push(i);
      }
      const filters = [
        {
          name: 'Sun Exposure',
          commaSeparated: true,
          value: []
        },
        {
          name: 'Flowering Months',
          range: true,
          byNumber: 'Flowering Months By Number',
          choices: [ 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec' ],
          value: []
        },
        {
          name: 'Height (feet) By Number',
          range: true,
          byNumber: 'Height (feet) By Number',
          choices: heights,
          value: []
        },
        {
          name: 'Soil Moisture',
          commaSeparated: true,
          value: []
        },
        {
          name: 'Plant Type',
          value: [],
          commaSeparated: true
        },
        {
          name: 'Pollinators',
          commaOrSemicolonSeparated: true,
          value: []
        },
        {
          name: 'Common Family',
          value: []
        }
      ];
      const $and = [];
      for (const filter of filters) {
        if (filter.range) {
          const min = parseInt(req.query[filter.name].min);
          const max = parseInt(req.query[filter.name].max);
          // Ignore invalid queries. Also ignore when the range is all possible values,
          // which is currently the only way to include plants for which there is
          // no flowering months data
          if ((!isNaN(min) && !isNaN(max)) && (min < max) && ((min !== 0) || (max !== filter.choices.length - 1))) {
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
      if ($and.length) {
        query.$and = $and;
      }
      console.log(require('util').inspect(query, { depth: 10 }));
      const qb = plants.find(query);
      if (projection) {
        qb.project(projection);
      }
      const results = await qb.sort(sort).toArray();
      const choices = {};
      for (const filter of filters) {
        if (!filter.choices) {
          const raw = (await plants.distinct(filter.name)).map(choice => ((typeof choice) === 'string') ? choice.toLowerCase() : choice).filter(choice => ((typeof choice) === 'string') && choice.length);
          if (filter.commaSeparated) {
            filter.choices = [... new Set(raw.map(choice => choice.split(/\s*,+\s*/)).flat()) ];
          } else if (filter.commaOrSemicolonSeparated) {
            filter.choices = [... new Set(raw.map(choice => choice.split(/\s*(?:,|;)+\s*/)).flat()) ];
          } else {
            filter.choices = raw;
          }
        }
      }
      return res.send({
        results,
        choices: Object.fromEntries(filters.map(filter => [ filter.name, filter.choices ]))
      });
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
