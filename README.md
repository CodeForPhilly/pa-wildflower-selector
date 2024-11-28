# Choose Native Plants (fomerly "PA Wildflower Selector"

A web application that helps US residents find native plants suitable for their gardens. Users can search and filter plants based on various criteria like sun exposure, soil moisture, pollinators attracted, and more. The app also shows where to buy these plants locally.

## Features

- Interactive plant search and filtering
- Detailed plant information including growing conditions
- Local nursery finder showing where to buy plants
- Quick search wizard for beginner gardeners
- Mobile-friendly responsive design

## Architecture

- **Frontend**: Vue.js web application
- **Backend**: Node.js server
- **Database**: MongoDB
- **Data Source**: ERA via Google Sheets
- **Vendor Integration**: PlantagentsAPI for local nursery data
  - [API Documentation](https://app.plantagents.org/swagger/index.html)

## Prerequisites

1. Docker Desktop installed and running
2. Git
3. Access to Code for Philly Slack channel (for env keys and secrets)

## Project setup (Docker Based)

Join the Code for Philly slack channel and ask for the env key, secrets.yaml, and images.

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/CodeForPhilly/pa-wildflower-selector

```
git clone https://github.com/CodeForPhilly/pa-wildflower-selector
```

Then you can install the npm dependencies at the server app and ui app levels:


```
cd pa-wildflower-selector
```

For local development, `docker-compose` is used to create a consistent and disposable environment without any modification to or dependency on software installed to the developer's workstation. This approach also provides close parity between local development and container-based deployment in production to Kubernetes.

Make sure Docker Desktop is running and run this Docker compose command:


```
docker compose up -d --build
```

## First time and occasional stuff
If you ran docker compose for the first time, you should see http://localhost:6868/ running with no images or data.

### Copy images to images folder.


### Populate mongodb based on google sheets plant listing.

Run:


```
docker-compose exec app node ./download.js --skip-images
```

### Massage the mongodb data so the UI can work with it.

Run:


```
docker-compose exec app node massage.js
```


### Where is the UI code?

In `src/`.

### Where is the server-side app code that answers queries?

In the main folder of the project.


## Database Operations

### Querying MongoDB
You can run these commands in the MongoDB container to check the database state:

```bash
# Count total plants
db.plants.count()

# Count plants in Alabama
db.plants.find({"States": "AL"}).count()

# Find a specific plant
db.plants.findOne({_id: "Asclepias tuberosa"})

# Count images in Docker container
docker exec pa-wildflower-selector-app-1 sh -c "ls -1 images/*.jpg | wc -l"
```

### Data Updates
To update the plant data and images:

```bash
# Full update (including image downloads)
npm run update-data

# Quick update (skip image downloads)
npm run fast-update-data
```

### Database Sync
Two scripts are available for database synchronization:

- `scripts/sync-down.sh`: Downloads MongoDB data and images from remote server
- `scripts/sync-up.sh`: Uploads local MongoDB data and images to remote server

## Development Environment

### Docker Setup
The application runs in Docker containers. Key ports:
- MongoDB: 7017 (host) -> 27017 (container)
- Application: 6868 (host) -> 8080 (container)

```bash
# Start the development environment
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the environment
docker-compose down
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
- MongoDB credentials
- API endpoints
- Port mappings

### SOURCE DATA
The source data is from ERA that is populated on a google sheet ("ERA" and "ONLINE" sheets).
https://docs.google.com/spreadsheets/d/1R_zhN3GUxhDEMlGFMhcPB_gAoaE9IoyWi10I_nM9f3o

Citation for the source data:
United States Department of Agriculture and US Federal Highway Administration. 2017. National database for pollinator-friendly revegetation and restoration. Compiled by Mark W. Skinner, Gretchen LeBuhn, David Inouye, Terry Griswold, and Jennifer Hopwood. Online at . Contact Mark W. Skinner for updates or more information.