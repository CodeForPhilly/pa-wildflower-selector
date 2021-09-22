# pa-wildflower-selector

## Project setup

First install the imagemagick command line utilities and MongoDB community edition on your machine, including the MongoDB command line utilities.

Then you can install the npm dependencies:

```
npm install
```

## First time and occasional stuff

### Download a copy of the database

By far the fastest way is if I just upload a zipfile of the MongoDB database and a zipfile of the media. So I'll do that on Slack, pin those files, and you can load them locally this way:

```
mongorestore --gzip --archive=pa-wildflower-selector.gz
cd pa-wildflower-selector
tar -zxf pa-wildflower-selector-media.tar.gz
```

You can also rebuild it from scratch, but this takes hours to run because of the need to obtain images from wikipedia and wikimedia:

```
node app download
```

Then run the `massage` script to clean up the data into a more reasonable form for queries:

```
node app massage
```


## Routine stuff

### Start up both a local server and the frontend app
```
npm run dev
```

### Compiles and minifies for production
```
npm run build
```

### Deploys (to Tom's server, currently for Tom to run)
```
npm run deploy
```

### Where is the UI code?

In `src/`.

### Where is the server-side app code that answers queries?

In the main folder of the project.
