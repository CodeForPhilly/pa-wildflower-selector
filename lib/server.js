const express = require('express');
const fs = require('fs');

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
      const qb = plants.find(query);
      if (projection) {
        qb.project(projection);
      }
      const results = await qb.sort(sort).toArray();
      return res.send({
        results
      });
    } catch (e) {
      console.error(e);
      return res.status(500).send(e);
    }
  });
  const port = process.env.PORT || 3000;
  console.log(`Listening on port ${port}`);
  app.listen(port);
  return app;
};
