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

## Developing on Windows in WSL 

First, make sure the that you have WSL installed on your system and that you're using version 2. 
You can check both of these requirements by running ```wsl -l -v``` in your Powershell Terminal or Commmand Prompt. 
If this returns an error follow the instructions [here](https://docs.microsoft.com/en-us/windows/wsl/install). 

WSL comes with an outdated version of Node. Run the following commands in your WSL shell to remove node, install a node version manager and install 
the latest stable version of node ([reference](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl)). 

```
sudo apt-get purge --auto-remove nodejs

sudo apt-get install curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
command -v nvm

nvm install --lts
nvm ls
```

There are many ways to download Mongo but Microsoft [suggests](https://docs.microsoft.com/en-us/windows/wsl/tutorials/wsl-database) doing so in the following steps: 

```
cd ~
sudo apt update
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

mongod --version
```

A commonly missed step is not creating a directory for mongo to write to (this step my not be listed in other instructions because the directory is created during installation on Mac OS and Linux). 

```
mkdir -p ~/data/db
sudo chown -R `id -un` ~/data/db
```

Run a Mongo instance: 

```
sudo mongod --dbpath ~/data/db
```

Open a new terminal to continue with instructions from here. 

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

> First, you will need to obtain the file `secrets.yaml` from Tom, Zach or Charles. This file is not in the repository because it grants API access to certain resources that could be maliciously overwritten. You do not need this fileunless you wish to run `npm run update-data` yourself. You can use `npm run restore-test-data` for most work.

```
npm run update-data
```

This takes time because it contacts Google Sheets and Wikimedia.

```
npm run fast-update-data
```

Significantly faster, but **skips images**, so use it only if you already have the images you need.

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
