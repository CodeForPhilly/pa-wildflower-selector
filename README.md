# pa-wildflower-selector

## System requirements

Your development system must have:

* MacOS, Linux, or WSL (Windows Subsystem for Linux)
* mongodb (100.5.2 or better)
* mongodb database tools (4.x or better)
* nodejs (16.x)
* imagemagick command line utilities
  

## Developing on Windows in WSL 

[Windows Subsystem for Linux, or WSL](https://en.wikipedia.org/wiki/Windows_Subsystem_for_Linux) is a service provided to developers that allows a Windows 10 user to have a full Linux kernel installed and running in a virtual machine under the hood, allowing for access to a complete Unix filesystem and command line while continuing to use Windows GUI apps.

First, make sure the that you have WSL installed on your system and that you're using version 2. 
You can check both of these requirements by running ```wsl -l -v``` in your Powershell Terminal or Commmand Prompt. If this returns an error follow the instructions [here](https://docs.microsoft.com/en-us/windows/wsl/install). 

WSL comes with an outdated version of Node. Run the following commands in your WSL shell to remove node, install a node version manager and install the latest stable version of node ([reference](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl)). 

```
sudo apt-get purge --auto-remove nodejs

sudo apt-get install curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
command -v nvm

nvm install --lts
nvm ls
```



## Install MongoDB on Windows

Installing MongoDB on Windows instructions on Microsoft website. Scroll down to Install MongoDB section at: https://docs.microsoft.com/en-us/windows/wsl/tutorials/wsl-database

## Install MongoDB on Mac OS

Installation of MongoDB Community Edition instructions for Mac OS can be found on the MongoDB website at: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/

## Project setup

In a new terminal windows:

###  Clone the project:

```
git clone https://github.com/CodeForPhilly/pa-wildflower-selector
```

### Install the npm dependencies:

```
cd pa-wildflower-selector
npm install
```

### Start up both a local server and the frontend app

```
npm run dev
```

### Compile and minify project for production

```
npm run build
```

### Tests the production experience locally

```
npm run ssr-dev
```

This is much slower and doesn't restart automatically, but it is important to check before deploying to production, in order to make sure we haven't broken server side rendering with changes to the Vue application that are browser-specific. If you must do something browser-specific, wrap it in an `if ((typeof window) !== 'undefined') { ... }` block.



### Download a copy of the database

### Run:

```
npm run restore-test-data
```

You can also rebuild it from scratch, but this takes hours to run because of the need to obtain images from wikipedia and wikimedia.

> First, you will need to obtain the files `settings.json` and `service-account.json` from Tom, Zach or Kio. These files are not in the repository because they grant API access to certain google sheets resources. You do not need these files unless you wish to run `npm run update-data` yourself. You can use `npm run restore-test-data` for most work.

```
npm run update-data
```

This takes time because it contacts Google Sheets and Wikimedia.

```
npm run fast-update-data
```

Significantly faster, but **skips images**, so use it only if you already have the images you need.



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



## Help us improve these instructions

Please open an issue if you have a question or improvement about these instructions: https://github.com/CodeForPhilly/pa-wildflower-selector/issues
