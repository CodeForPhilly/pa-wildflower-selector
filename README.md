# Choose Native Plants

[Choose Native Plants](https://choose-native-plants.com) helps US residents find native plants for their gardens and locate nearby nurseries that sell them.

![Application screenshot](app-screenshot.png)

## What it does

- Searches and filters plants by growing conditions and ecological value
- Shows plant details, native range, and local availability
- Includes a garden planner and favorites
- Supports desktop and mobile browsers

The app uses Vue 3, Node.js/Express, and MongoDB. Plant data originates in shared Google Sheets, images live in Linode Object Storage, and nursery availability comes from Plant Agents.

## Local development

### Prerequisites

- Node.js 20 LTS (the version used by the Docker image)
- MongoDB Community Server, running locally
- [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) (`mongorestore`)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), needed only to restore a database backup
- Access to the project's shared environment values

`mongosh` is useful for inspecting the database but is not required to run the app.

### First-time setup

```bash
git clone https://github.com/CodeForPhilly/pa-wildflower-selector
cd pa-wildflower-selector
npm ci
cp .env.example .env
```

Ask in the Code for Philly `#choose-native-plants-pa` Slack channel for the private values, then edit `.env` for native local development:

```dotenv
DB_HOST=localhost
DB_PORT=27017
PORT=8080
```

If your local MongoDB does not use authentication, leave `MONGODB_USER` and `MONGODB_PASSWORD` blank. Keep all real credentials in `.env`; it is ignored by Git.

Download the image library:

```bash
npm run sync-images
```

This command uses the project's AWS SDK and does not require the AWS CLI. It downloads into the ignored `images/` directory and safely skips files that are already current.

Restore the latest shared database backup:

```bash
npm run sync:down:db
```

Database restore requires both `aws` and `mongorestore` to be available on `PATH`. MongoDB does not support every cross-version dump/restore combination; use a server version compatible with the backup when `mongorestore` reports a version warning.

Check the setup and start both servers:

```bash
npm run dev:local
```

Open [http://localhost:8080](http://localhost:8080). The Vue development server runs on port 8080 and proxies API and image requests to Express on port 3000.

The first backend start may take a few minutes while missing plant embeddings are generated. Later starts should be quick.

## Docker

Docker remains available for a containerized environment:

```bash
cp .env.example .env
# Set DB_HOST=mongodb and add the private values.
npm run docker:up
```

Open [http://localhost:6868](http://localhost:6868), or the value configured by `NODE_LOCAL_PORT`.

```bash
npm run docker:down
```

The Compose stack pins MongoDB 5.0.6. Local development is often more convenient when working directly with sync and database tools.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev:local` | Validate local setup and run client + server |
| `npm run dev:client` | Run only the Vue client |
| `npm run dev:server` | Run only Express on port 3000 |
| `npm run sync-images` | Download Linode images |
| `npm run sync:down:db` | Download and restore the latest database backup |
| `npm run fast-update-data` | Refresh plant data from the source sheets |
| `npm run lint` | Run lint checks |
| `npm run build` | Build SSR and browser bundles |
| `npm run docker:up` | Build and start the Compose stack |
| `npm run docker:down` | Stop the Compose stack |

Run `npm run` to see the complete script list, including schema, index, embedding, and upload utilities.

## Environment and ports

| Setting | Native local | Docker |
| --- | --- | --- |
| `DB_HOST` | `localhost` | `mongodb` |
| `DB_PORT` | `27017` | `27017` |
| Browser URL | `http://localhost:8080` | `http://localhost:6868` |
| Express port | `3000` | Value of `PORT` |
| MongoDB host port | `27017` | Value of `MONGODB_LOCAL_PORT` |

Never commit `.env`, downloaded images, database backups, or `node_modules`. They are already covered by `.gitignore`.

## Troubleshooting

### MongoDB check fails

- Confirm the MongoDB service is running.
- Confirm `DB_HOST=localhost` and `DB_PORT` matches the local service.
- If authentication is disabled locally, clear `MONGODB_USER` and `MONGODB_PASSWORD`.
- Run `node scripts/check-mongodb.js` for a focused connection check.

### Client loads but data requests fail

- Confirm Express is listening on port 3000.
- Do not give the local client and server the same port.
- Use `npm run dev:local`; its scripts reserve 8080 for Vue and 3000 for Express.

### Sync command is missing a program

- Image sync needs Node.js and the `.env` Linode values.
- Database sync additionally needs AWS CLI and MongoDB Database Tools on `PATH`.
- Restart the terminal after installing Windows packages so its `PATH` refreshes.

## Project layout

- `src/` — Vue application
- `app.js`, `lib/` — Express server and database access
- `scripts/` — sync, migration, indexing, embedding, and maintenance tools
- `public/` — static assets bundled with the app
- `images/` — downloaded plant images; ignored by Git
- `helm-chart/`, `deployment/` — deployment configuration

The development-only studio image pipeline is documented in [`scripts/studio_images/README.md`](scripts/studio_images/README.md).

## Contributing

1. Create a feature branch.
2. Make and verify a focused change.
3. Commit and push the branch.
4. Open a pull request.

Questions are welcome in the Code for Philly project channel or at [contact@choosenativeplants.com](mailto:contact@choosenativeplants.com).

This project is licensed under the [MIT License](LICENSE).
