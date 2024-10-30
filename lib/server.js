require("dotenv").config();
const express = require("express");
const fs = require("fs");
const quote = require("regexp-quote");
const path = require("path");
const manifest = require("../ssr/ssr-manifest.json");
const appPath = path.join(__dirname, "../ssr", manifest["app.js"]);
const renderer = require(appPath).default;
const pageSize = 20;
const versionFile = `${__dirname}/../version.txt`;
const version = fs.existsSync(versionFile)
  ? fs.readFileSync(versionFile, "utf8")
  : "0";
const axios = require("axios");

// Disabled for now because it causes confusion when we update the data
// const cache = {};

module.exports = async function ({ plants, nurseries }) {
  const port = process.env.PORT || 3000;
  const app = express();
  const publicDir = `${__dirname}/../public`;
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  app.use(express.static(publicDir));
  app.use("/images", express.static(`${__dirname}/../images`));
  app.use(express.json());

  app.post("/get-vendors", async (req, res) => {
    const baseUrl = process.env.PAC_API_BASE_URL;
    const apiKey = process.env.PAC_API_KEY;
    const url = `${baseUrl}/Plant/FindVendorsForPlantName`;
    let response = await axios.get(url, {
      headers: { Authorization: "Bearer " + apiKey },
      params: { plantName: req.body.plantName, zipCode: req.body.zipCode, radius: req.body.radius, limit: 5}
    });
    return res.send(response.data);
  });
  app.post("/get-city", async (req, res) => {
    //console.log(req.params)
    //call vendor/FindZip
    const baseUrl = process.env.PAC_API_BASE_URL;
    const apiKey = process.env.PAC_API_KEY;
    const url = `${baseUrl}/vendor/FindCity`;
    let response = await axios.get(url, {
      headers: { Authorization: "Bearer " + apiKey },
      params: {zipCode: req.body.zipCode}
    });
    return res.send(response.data);
  });
  app.post("/get-zip", async (req, res) => {
    const baseUrl = process.env.PAC_API_BASE_URL;
    const apiKey = process.env.PAC_API_KEY;
    const url = `${baseUrl}/vendor/FindZip`;
    let response = await axios.get(url, {
      headers: { Authorization: "Bearer " + apiKey },
      params: {lat: req.body.latitude, lng: req.body.longitude}
    });
    return res.send(response.data);
  });
  app.get("/api/v1/plants", async (req, res) => {
    try {
      const fetchResults = req.query.results !== "0";
      const fetchTotal = req.query.total !== "0";
      const query = {};
      const sorts = {
        "Sort by Common Name (A-Z)": {
          "Common Name": 1,
        },
        "Sort by Common Name (Z-A)": {
          "Common Name": -1,
        },
        "Sort by Scientific Name (A-Z)": {
          "Scientific Name": 1,
        },
        "Sort by Scientific Name (Z-A)": {
          "Scientific Name": -1,
        },
        "Sort by Recommendation Score": {
          "Recommendation Score": -1,
          "Common Name": 1,
        },
        "Sort by Flower Color": {
          "Flower Color": 1,
        },
        "Sort by Height (L-H)": {
          "Average Height": 1,
        },
        "Sort by Height (H-L)": {
          "Average Height": -1,
        },
        "Sort by Soil Moisture (Dry to Wet)": {
          "Soil Moisture Flags": 1,
        },
        "Sort by Soil Moisture (Wet to Dry)": {
          "Soil Moisture Flags": -1,
        },
      };
      const sort = sorts[req.query.sort]
        ? sorts[req.query.sort]
        : Object.values(sorts)[0];
      let projection;
      let page = parseInt(req.query.page);
      if (isNaN(page) || page < 1) {
        page = 1;
      }
      if (req.query.q && req.query.q.length) {
        query.$text = {
          $search: req.query.q,
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
      const doc = (
        await plants
          .find({})
          .project({ "Height (feet) By Number": 1 })
          .sort({ "Height (feet) By Number": -1 })
          .limit(1)
          .toArray()
      )[0];
      const heightsOfTallest = doc && doc["Height (feet) By Number"];
      let maxHeight =
        (heightsOfTallest && heightsOfTallest[heightsOfTallest.length - 1]) ||
        0;
      const heights = [];
      for (let i = 0; i <= maxHeight; i++) {
        heights.push(i);
      }
      const filters = [
        {
          name: "States",
          value: [],
          array: true,
        },
        {
          name: "Sun Exposure Flags",
          value: [],
          array: true,
        },
        {
          name: "Soil Moisture Flags",
          value: [],
          array: true,
        },
        {
          name: "Plant Type Flags",
          value: [],
          array: true,
        },
        {
          name: "Life Cycle Flags",
          value: [],
          array: true,
        },
        {
          name: "Pollinator Flags",
          value: [],
          ignore: ["Wind"],
          array: true,
        },
        {
          name: "Superplant",
          choices: ["Super Plant"],
          value: [],
          boolean: true,
        },
        {
          name: "Flower Color Flags",
          value: [],
          array: true,
        },
        {
          name: "Availability Flags",
          value: [],
          array: true,
        },
        {
          name: "Flowering Months",
          range: true,
          byNumber: "Flowering Months By Number",
          choices: [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
          ],
          value: [],
        },
        {
          name: "Height (feet)",
          range: true,
          byNumber: "Height (feet) By Number",
          choices: heights,
          value: [],
        },
        {
          name: "Showy",
          choices: ["Showy"],
          value: [],
          boolean: true,
        },
      ];
      const $and = [];
      for (const filter of filters) {
        if (filter.range) {
          const min = parseInt(req.query?.[filter.name]?.min);
          const max = parseInt(req.query?.[filter.name]?.max);
          // Ignore invalid queries. Also ignore when the range is all possible values,
          // which is currently the only way to include plants for which there is
          // no flowering months data
          if (
            !isNaN(min) &&
            !isNaN(max) &&
            min <= max &&
            (min !== 0 || max !== filter.choices.length - 1)
          ) {
            const $in = [];
            for (let i = min; i <= max; i++) {
              $in.push(i);
            }
            if ($in.length) {
              $and.push({
                [filter.byNumber]: {
                  $in,
                },
              });
            }
          }
        } else if (filter.boolean) {
          // For frontend convenience it arrives as an array, but
          // we only care if it has an element or not
          let input = req.query[filter.name] || [];
          if (input && input.length) {
            $and.push({
              [filter.name]: true,
            });
          }
        } else if (filter.array) {
          const input = req.query[filter.name] || [];
          const array = Array.isArray(input) ? input : [input];
          const values = array.map((value) => value.toString());
          if (values.length) {
            $and.push({
              [filter.name]: {
                $in: values,
              },
            });
          }
        } else {
          const input = req.query[filter.name] || [];
          const array = Array.isArray(input) ? input : [input];
          const values = array.map((value) => value.toString());
          const $or = values
            .map(
              (value) =>
                new RegExp(`(?:^|;|,)\\s*${quote(value)}\\s*(?:;|,|$)`, "i")
            )
            .map((value) => ({
              [filter.name]: value,
            }));
          if ($or.length) {
            $and.push({
              $or,
            });
          }
        }
      }
      // If we are sorting by a field we should not return results for which
      // its value is unknown, it's too confusing
      Object.keys(sort).forEach((key) => {
        $and.push({
          [key]: {
            $exists: 1,
          },
        });
      });
      if (Array.isArray(req.query.favorites)) {
        $and.push({
          _id: {
            $in: req.query.favorites.map((v) =>
              typeof v == "string" ? v : ""
            ),
          },
        });
      }
      if ($and.length) {
        query.$and = $and;
      }
      const total = fetchTotal && (await plants.countDocuments(query));
      const qb = plants.find(query);
      if (projection) {
        qb.project(projection);
      }
      if (!req.query.favorites) {
        qb.skip((page - 1) * pageSize);
        qb.limit(pageSize);
      }
      const results = fetchResults && (await qb.sort(sort).toArray());
      if (!req.query.favorites) {
        for (const filter of filters) {
          if (filter.array) {
            const aQuery = [
              {
                $match: {
                  ...query,
                  $and: query.$and.filter(
                    (clause) => clause[filter.name] === undefined
                  ),
                },
              },
              {
                $unwind: `$${filter.name}`,
              },
              {
                $group: {
                  _id: `$${filter.name}`,
                  count: { $sum: 1 },
                },
              },
            ];
            filter.counts = await plants.aggregate(aQuery).toArray();
          } else if (filter.boolean) {
            filter.counts = await plants
              .aggregate([
                {
                  $match: {
                    ...query,
                    $and: query.$and.filter(
                      (clause) => clause[filter.name] === undefined
                    ),
                  },
                },
                {
                  $group: {
                    _id: `$${filter.name}`,
                    count: {
                      $sum: 1,
                    },
                  },
                },
              ])
              .toArray();
            const trueChoice = filter.counts.find((count) => !!count._id);
            if (trueChoice) {
              trueChoice._id = filter.choices[0];
            } else {
              filter.counts.push({
                _id: filter.choices[0],
                count: 0,
              });
            }
          }
          if (!filter.choices) {
            if (filter.counts) {
              // Avoid redundant query
              filter.choices = filter.counts.map((count) => count._id);
              filter.choices.sort();
            } else {
              if (filter.byNumber) {
                filter.choices = (
                  await plants.distinct(filter.byNumber)
                ).filter((choice) => typeof choice === "number");
              } else {
                filter.choices = (await plants.distinct(filter.name)).filter(
                  (choice) => typeof choice === "string" && choice.length
                );
              }
            }
          }
        }
      }
      let response = {
        results,
        total,
      };
      if (!req.query.favorites) {
        response = {
          ...response,
          choices: Object.fromEntries(
            filters.map((filter) => [filter.name, filter.choices])
          ),
          counts: Object.fromEntries(
            filters.map((filter) => [
              filter.name,
              filter.counts &&
                Object.fromEntries(
                  filter.counts.map((item) => [item._id, item.count])
                ),
            ])
          ),
        };
      }
      for (const filter of filters) {
        const choices = response.choices && response.choices[filter.name];
        if (choices && filter.ignore) {
          response.choices[filter.name] = choices.filter(
            (choice) => !filter.ignore.includes(choice)
          );
        }
        const counts = response.counts && response.counts[filter.name];
        if (counts && filter.ignore) {
          response.counts[filter.name] = Object.fromEntries(
            Object.entries(counts).filter(
              (value, count) => !filter.ignore.includes(value)
            )
          );
        }
      }
      // setCache(req, response);
      return res.send(response);
    } catch (e) {
      console.error("error:", e);
      return res.status(500).send(e);
    }
  });
  app.get("/api/v1/plants/:name", async (req, res) => {
    const result = await plants.findOne({
      _id: req.params.name,
    });
    if (!result) {
      return res.status(404).send("Not Found");
    } else {
      return res.send(result);
    }
  });
  app.get("/api/v1/nurseries", async (req, res) => {
   
    console.log("PARAMS", req.params)
    const baseUrl = process.env.PAC_API_BASE_URL;
    const apiKey = process.env.PAC_API_KEY;
    const url = `${baseUrl}/Vendor/FindByState`;
    let response = await axios.get(url, {
      headers: { Authorization: "Bearer " + apiKey },
      params: { state: req.query.state }
    });
    return res.send({results: response.data.map(x => {
       return {
        "SOURCE": x.storeName, 
        "Lat": x.lat, 
        "Long": x.lng, 
        "lon": x.lng, 
        "lat": x.lat,
        "PHONE": x.publicPhone,
        "URL": x.storeUrl,
        "ADDRESS": x.address,
        "STATE": x.state,
        "EMAIL": x.publicEmail
       }
    })});
  });
  app.get("*", async (req, res) => {
    const appContent = await renderer({ port, url: req.url });
    const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <link rel="stylesheet" href="${manifest["app.css"]}?version=${version}" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin="" />
        <link rel="icon" href="/favicon.ico">
        <link rel="icon" href="/assets/images/logo-32x32.png" sizes="32x32" />
        <link rel="icon" href="/assets/images/logo-192x192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/assets/images/logo-192x192.png" />
        <meta name="msapplication-TileImage" content="/assets/images/logo-192x192.png" />
        <meta property="og:title" content="Choose Native Plants" />
        <meta property="og:description" content="Find out which native shrubs, plants and flowers have the right conditions to flourish in your garden." />
        <meta property="og:image" content="https://choosenativeplants.com/assets/images/og-image.png" />
        <meta property="og:url" content="https://choosenativeplants.com/" />
        <meta property="og:site_name" content="Choose Native Plants" />
        <meta name="twitter:image" content="https://choosenativeplants.com/assets/images/twitter-large-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CodeForPhilly" />
        <meta name="twitter:title" content="Choose Native Plants" />
        <meta name="twitter:description" content="Find out which native shrubs, plants and flowers from Pennsylvania have the right conditions to flourish in your garden." />
        <meta name="twitter:image:alt" content="Choose Native Plants logo" />
        <title>Choose Native Plants</title>
      </head>
      <body>
        <noscript>
          <strong>We're sorry but this application doesn't work properly without JavaScript enabled. Please enable it to continue.</strong>
        </noscript>
        <div id="app">${appContent}</div>
        <script src="/js/chunk-vendors.js?version=${version}"></script>
        <script src="/js/app.js?version=${version}"></script>
        <!-- Global site tag (gtag.js) - Google Analytics -->
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-CHCN0FC8JD"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-CHCN0FC8JD');
        </script>
      </body>
    </html>
    `.trim();
    res.end(html);
  });
  console.log(`Listening on port ${port}`);
  app.listen(port);
  return app;
};

// function hashKey(req) {
//   return JSON.stringify(req.query);
// }

// function getCache(req) {
//   const key = hashKey(req);
//   if (cache[key]) {
//     cache[key].last = Date.now();
//     return cache[key].data;
//   }
// }

// function setCache(req, data) {
//   cache[hashKey(req)] = {
//     last: Date.now(),
//     data
//   };
//   if (Object.keys(cache).length > 100) {
//     const oldest = Object.entries(cache, (a, [key, value]) => {
//       if ((!a) || (value.last < a.last)) {
//         return [key, value];
//       }
//     }, null);
//     if (oldest) {
//       // console.log('Deleting:', oldest[0]);
//       delete cache[oldest[0]];
//     }
//   }
//   // Object.keys(cache).map(key => {
//   //   console.log(`${key} ${cache[key].last}`);
//   // });
// }
