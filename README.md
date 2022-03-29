# pa-wildflower-selector

## Dev system requirements

Your development system must have:

* MacOS, Linux, or Windows Subsystem for Linux (not the Windows command prompt)
* mongodb (4.x or better)
* nodejs (16.x)
* imagemagick command line utilities

## Production system requirements

* Linux
* mongodb (4.x or better)
* nodejs (16.x)
* imagemagick command line utilities

## Project setup

First install the imagemagick command line utilities and MongoDB community edition on your machine, including the MongoDB command line utilities.

Next clone the project:

```
git clone https://github.com/CodeForPhilly/pa-wildflower-selector
```

Then you can install the npm dependencies at the server app and ui app levels:

```
cd pa-wildflower-selector
npm install
```

## First time and occasional stuff

### Download a copy of the database

Run:

```
npm run restore-test-data
```

You can also rebuild it from scratch, but this takes hours to run because of the need to obtain images from wikipedia and wikimedia.

> First, you will need to obtain the files `settings.json` and `service-account.json` from Tom, Zach or Kio. These files are not in the repository because they grant API access to certain google sheets resources. You do not need these files unless you wish to run `npm run update` yourself. You can use `npm run restore-test-data` for most work.

```
npm run update
```

This takes time because it contacts Google Sheets and Wikimedia.

## Routine stuff

### Start up both a local server and the frontend app
```
npm run dev
```

### Compiles and minifies for production
```
npm run build
```

### Tests the production experience locally
```
npm run ssr-dev
```

This is much slower and doesn't restart automatically, but it is important to check before deploying to production, in order to make sure we haven't broken server side rendering with changes to the Vue application that are browser-specific. If you must do something browser-specific, wrap it in an `if ((typeof window) !== 'undefined') { ... }` block.

### Deploys (to Tom's server, currently for Tom to run)
```
npm run deploy
```

### Where is the UI code?

In `src/`.

### Where is the server-side app code that answers queries?

In the main folder of the project.

## Running with Docker Compose

For local development, `docker-compose` is used to create a consistent and disposable environment without any modification to or dependency on software installed to the developer's workstation. This approach also provides close parity between local development and container-based deployment in production to Kubernetes.

[GitHub's  `Scripts To Rule Them All` pattern](https://github.com/github/scripts-to-rule-them-all) is leveraged to provide simple commands with reasonable default behavior for common developer steps.

### Start server

This command starts or updates the existing docker-compose instances, forcing a rebuild of the Docker container image:

```bash
script/server
```

### Update server

After making changes to source code or switching branches, this command will do anything needed to update your running server:

```bash
script/update
```

### Initialize data

This command will download sample data into your docker-compose environment and initialize your database:

```bash
script/setup
```

This only needs to be done once per workstation, or after major changes that require reinitializing the database.

### Follow app logs

```bash
docker-compose logs -f app
```

### Open shell on app container

```bash
docker-compose exec app sh
```

### Open mongo shell

```bash
docker-compose exec mongodb bash -c '
mongosh \
    --username ${MONGO_INITDB_ROOT_USERNAME} \
    --password ${MONGO_INITDB_ROOT_PASSWORD}
'
```

To verify the connection, you can list databases from the mongo shell:

```mongosh
db.adminCommand( { listDatabases: 1 } )
```

### Clean up local environment

This command both shuts down the local server AND erases all local state:

```bash
docker-compose down -v
```

## Open Questions

- Does the deploy need two copies of the entire dist/ directory copied into both public/ and ssr/ ?
