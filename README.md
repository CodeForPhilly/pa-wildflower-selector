# Choose Native Plants 🌱

<div align="center">

![GitHub license](https://img.shields.io/github/license/CodeForPhilly/pa-wildflower-selector)
![GitHub stars](https://img.shields.io/github/stars/CodeForPhilly/pa-wildflower-selector)
![GitHub issues](https://img.shields.io/github/issues/CodeForPhilly/pa-wildflower-selector)

**Help US residents find and source native plants for their gardens**

[Getting Started](#getting-started) •
[Development Modes](#development-modes) •
[Features](#features) •
[Architecture](#architecture) •
[Development](#development) •
[Database](#database-operations) •
[Contributing](#contributing)

</div>

## 🌟 Overview

[Choose Native Plants](https://choose-native-plants.com) (formerly "PA Wildflower Selector") is a web application that helps US residents find native plants suitable for their gardens. Users can search and filter plants based on various criteria like sun exposure, soil moisture, pollinators attracted, and more. The app also shows where to buy these plants locally.

<div align="center">
<img src="app-screenshot.png" alt="Application Screenshot" width="600">
</div>

## ✨ Features

- 🔍 Interactive plant search with multiple filter options
- 🌿 Detailed plant information including growing conditions
- 🏪 Local nursery finder showing where to buy plants
- 🧙 Quick search wizard for beginner gardeners
- 📱 Mobile-friendly responsive design

## 🏗️ Architecture

- **Frontend**: Vue.js web application
- **Backend**: Node.js server
- **Database**: MongoDB
- **Data Source**: ERA via Google Sheets
- **Vendor Integration**: PlantagentsAPI for local nursery data
  - [API Documentation](https://app.plantagents.org/swagger/index.html)

## 🚀 Getting Started

### Prerequisites

- Git
- User account with [Code for Philly](https://codeforphilly.org/)

**For Docker Mode:**
- Docker Desktop installed and running

**For Local Mode:**
- Node.js installed
- MongoDB Server Community Edition installed and running locally
- MongoDB Shell (mongosh) installed
- MongoDB Database Tools installed (required for `mongorestore` command used in database sync)
- AWS CLI installed (required for syncing database from Linode)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/CodeForPhilly/pa-wildflower-selector

# Navigate to project directory
cd pa-wildflower-selector

# Copy environment file
cp .env.example .env
# Edit .env with your configuration (see Development Modes section below)
```

Choose your development mode:
- **[Docker Mode](#docker-mode-quick-start)** - Recommended for beginners, uses Docker containers
- **[Local Mode](#local-mode-quick-start)** - For development without Docker

## 🔀 Development Modes

This project supports two development modes: **Docker** and **Local**. Choose the mode that best fits your workflow.

| Feature | Docker Mode | Local Mode |
|---------|-------------|------------|
| **MongoDB** | Runs in Docker container | Must be installed locally |
| **Setup Complexity** | Simple (Docker handles everything) | Requires local MongoDB setup |
| **Performance** | Slightly slower (container overhead) | Faster (direct execution) |
| **Best For** | Beginners, consistent environments | Advanced developers, faster iteration |
| **DB_HOST** | `mongodb` | `localhost` |

### Prerequisites by Mode

#### Docker Mode Prerequisites
- ✅ Docker Desktop installed and running
- ✅ `.env` file configured with Docker-specific values
- ❌ No local MongoDB installation needed

#### Local Mode Prerequisites
- ✅ Node.js installed
- ✅ MongoDB Server Community Edition installed and running locally
- ✅ MongoDB Shell (mongosh) installed
- ✅ MongoDB Database Tools installed (required for `mongorestore` command used in database sync) - [Download here](https://www.mongodb.com/try/download/database-tools)
- ✅ AWS CLI installed (required for syncing database from Linode)
- ✅ `.env` file configured with local-specific values

### Environment Variables Setup

The key difference between Docker and Local modes is the `DB_HOST` environment variable in your `.env` file.

#### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_HOST` | MongoDB host address | ✅ Yes |
| `DB_PORT` | MongoDB port (usually 27017) | ✅ Yes |
| `DB_NAME` | Database name | ✅ Yes |
| `DB_USER` | MongoDB username (if auth enabled) | ⚠️ Optional |
| `DB_PASSWORD` | MongoDB password (if auth enabled) | ⚠️ Optional |
| `PORT` | Node.js server port | ✅ Yes |
| `MASTER_CSV_URL` | Google Sheets CSV URL | ✅ Yes |
| `ARTICLES_CSV_URL` | Articles CSV URL | ✅ Yes |
| `LOCAL_MAP_CSV_URL` | Local map CSV URL | ✅ Yes |
| `ONLINE_STORES_CSV_URL` | Online stores CSV URL | ✅ Yes |
| `PAC_API_BASE_URL` | Plant Agents API base URL | ✅ Yes |
| `PAC_API_KEY` | Plant Agents API key | ✅ Yes |

#### Environment Variable Differences

| Variable | Docker Mode | Local Mode | Notes |
|----------|------------|------------|-------|
| `DB_HOST` | `mongodb` | `localhost` | Docker service name vs localhost |
| `DB_PORT` | `27017` (internal) | `27017` | Usually same, but check docker-compose |
| `PORT` | Set in docker-compose | `3000` or custom | Application port |
| `MONGODB_LOCAL_PORT` | `7017` (host mapping) | Not used | Docker port mapping |
| `NODE_LOCAL_PORT` | `6868` (host mapping) | Not used | Docker port mapping |

### Docker Mode Quick Start

1. **Prerequisites Check**
   ```bash
   # Verify Docker is running
   docker --version
   docker compose version
   ```

2. **Configure Environment**
   ```bash
   # Copy .env.example to .env if not already done
   cp .env.example .env
   
   # Edit .env and ensure:
   # DB_HOST=mongodb
   # (Other Docker-specific values should already be set)
   ```

3. **Start Docker Containers**
   ```bash
   npm run docker:up
   # Or: docker compose up -d --build
   ```

4. **Verify Setup**
   ```bash
   # Check containers are running
   docker compose ps
   
   # Check MongoDB connection
   node scripts/check-mongodb.js
   ```

5. **View Application**
   - Visit http://localhost:6868/

### Local Mode Quick Start

1. **Prerequisites Check**
   ```bash
   # Verify Node.js is installed
   node --version
   npm --version
   
   # Verify MongoDB Server is installed
   mongod --version
   
   # Verify MongoDB Shell is installed
   mongosh --version
   
   # Verify MongoDB service is running
   # Windows: Check Services panel or run: net start MongoDB
   # macOS: brew services list | grep mongodb
   # Linux: sudo systemctl status mongod
   ```

2. **Install MongoDB** (if not installed)
   
   **⚠️ Important:** You need to install **two separate components**:
   - **MongoDB Server Community Edition** (`mongod`) - The database server
   - **MongoDB Shell** (`mongosh`) - The command-line interface to interact with MongoDB
   
   **Windows:**
   
   **MongoDB Server Community Edition:**
   - Download from [MongoDB Community Server](https://www.mongodb.com/try/download/community)
   - Run the MSI installer and choose "Complete" installation
   - During installation, choose "Install MongoDB as a Service" to run automatically
   - Add MongoDB bin directory to your PATH (usually `C:\Program Files\MongoDB\Server\<version>\bin`)
   - Verify: Open Services (`services.msc`) and check "MongoDB" service is running
   - Or start manually: `net start MongoDB`
   
   **MongoDB Shell (mongosh):**
   - Download from [MongoDB Shell Install](https://www.mongodb.com/try/download/shell)
   - Run the MSI installer
   - The installer will automatically add mongosh to your PATH
   - Verify installation: `mongosh --version`
   
   **macOS:**
   ```bash
   # Using Homebrew
   brew tap mongodb/brew
   
   # Install MongoDB Server Community Edition
   brew install mongodb-community
   brew services start mongodb-community
   
   # Install MongoDB Shell
   brew install mongosh
   ```
   
   **Linux:**
   ```bash
   # Ubuntu/Debian
   # Install MongoDB Server Community Edition
   sudo apt-get install mongodb
   sudo systemctl start mongod
   sudo systemctl enable mongod
   
   # Install MongoDB Shell
   # Follow instructions at: https://www.mongodb.com/docs/mongodb-shell/install/
   ```

   **Install AWS CLI** (required for syncing database from Linode):
   
   For detailed installation instructions, see the [official AWS CLI installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
   
   **Windows:**
   - Using Chocolatey: `choco install awscli`
   - Or download MSI installer from the [AWS CLI installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
   
   **macOS:**
   ```bash
   brew install awscli
   ```
   Or follow the [macOS installation instructions](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
   
   **Linux:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install awscli
   ```
   Or follow the [Linux installation instructions](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
   
   **Verify AWS CLI Installation:**
   ```bash
   aws --version
   ```
   
   **Note:** AWS CLI credentials are configured via environment variables in your `.env` file:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `LINODE_BUCKET_NAME`
   - `LINODE_ENDPOINT_URL` (optional, defaults to `https://us-east-1.linodeobjects.com`)

3. **Verify MongoDB Installation**
   ```bash
   # Verify MongoDB Server is installed
   mongod --version
   
   # Verify MongoDB Shell is installed
   mongosh --version
   
   # Try connecting to MongoDB
   mongosh
   # Should connect to: mongodb://localhost:27017
   ```

4. **Configure Environment**
   ```bash
   # Copy .env.example to .env if not already done
   cp .env.example .env
   
   # Edit .env and change:
   # DB_HOST=localhost  (change from 'mongodb')
   # PORT=3000  (or your preferred port)
   ```

5. **Install Dependencies**
   ```bash
   npm install
   ```

6. **Run Development Setup Check**
   ```bash
   npm run predev:local
   # This will verify MongoDB connection and environment
   ```

7. **Start Development Server**
   ```bash
   npm run dev:local
   # This runs both Vue dev server and Node.js server
   ```

8. **View Application**
   - Vue dev server: http://localhost:8080/ (or configured port)
   - Node.js API: http://localhost:3000/ (or configured PORT)

### Switching Between Docker and Local Development

#### Switching from Docker to Local Mode

1. **Stop Docker Containers**
   ```bash
   npm run docker:down
   # Or: docker compose down
   ```

2. **Update `.env` File**
   ```bash
   # Change these values:
   DB_HOST=localhost  # was: mongodb
   # Remove or comment out Docker-specific port mappings if desired
   ```

3. **Verify MongoDB is Running Locally**
   ```bash
   # Check MongoDB service
   # Windows: services.msc or "net start MongoDB"
   # macOS: brew services list
   # Linux: sudo systemctl status mongod
   
   # Test connection
   node scripts/check-mongodb.js
   ```

4. **Start Local Development**
   ```bash
   npm run dev:local
   ```

#### Switching from Local to Docker Mode

1. **Stop Local Development Server**
   - Press `Ctrl+C` to stop `npm run dev:local`

2. **Update `.env` File**
   ```bash
   # Change these values:
   DB_HOST=mongodb  # was: localhost
   # Ensure Docker port mappings are set correctly
   ```

3. **Start Docker Containers**
   ```bash
   npm run docker:up
   ```

4. **Verify Setup**
   ```bash
   docker compose ps
   node scripts/check-mongodb.js
   ```

### Sync Images (Both Modes)

#### Docker Mode
```bash
docker compose exec app npm run sync-images
```

#### Local Mode
```bash
npm run sync-images
# Images will be stored in ./images directory
```

### Update Database (Both Modes)

To update your local MongoDB with the latest changes from the Google Sheets:

#### Docker Mode
```bash
docker compose exec app npm run fast-update-data
```

#### Local Mode
```bash
npm run fast-update-data
```

### Sync Database from Linode (Local Mode)

To sync your local database with the latest backup from Linode Object Storage:

**Prerequisites:**
- AWS CLI must be installed (see Local Mode Prerequisites above)
- MongoDB Database Tools must be installed (includes `mongorestore` command) - [Download here](https://www.mongodb.com/try/download/database-tools)
- Environment variables configured in `.env`:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `LINODE_BUCKET_NAME`
  - `LINODE_ENDPOINT_URL` (optional)

**Sync Command:**
```bash
npm run sync:down
```

This script will:
1. List available database backups from Linode Object Storage
2. Download the latest backup
3. Restore it to your local MongoDB instance using `mongorestore`

**Note:** This is primarily useful for Local Mode development. Docker Mode typically uses the production database or creates its own test data.

## 💾 Database Operations

### MongoDB Connection

#### Docker Mode
Connect to MongoDB using MongoDB Compass with:
```
mongodb://[username]:[password]@localhost:7017/pa-wildflower-selector?authSource=admin
```
(Replace `[username]` and `[password]` with values from your `.env` file)

#### Local Mode
Connect to MongoDB using MongoDB Compass with:
```
mongodb://[username]:[password]@localhost:27017/pa-wildflower-selector?authSource=admin
```
(Replace `[username]` and `[password]` with values from your `.env` file, or omit if authentication is disabled)

## 🛠️ Development

### Available Scripts

#### Docker Scripts
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers

#### Local Development Scripts
- `npm run dev:local` - Run both Vue dev server and Node.js server (recommended)
- `npm run dev:client` - Run Vue dev server only
- `npm run dev:server` - Run Node.js server only
- `npm run dev:full` - Run both servers concurrently (alternative to dev:local)

#### Build Scripts (used by Dockerfile - do not modify)
- `npm run build` - Build for production (SSR + browser)
- `npm run build-ssr` - Build SSR bundle
- `npm run build-browser` - Build browser bundle

#### Utility Scripts
- `npm run check-mongodb` - Verify MongoDB connection (via scripts/check-mongodb.js)
- `npm run predev:local` - Run development environment checks before starting local dev

### Project Structure

- **UI Code**: Located in `src/` directory
- **Server Code**: Located in the main project directory (`lib/`, `app.js`)
- **Scripts**: Helper scripts in `scripts/` directory
- **Configuration**: `.env` file (copy from `.env.example`)

### Troubleshooting

#### MongoDB Connection Issues

**Docker Mode:**
- Ensure Docker containers are running: `docker compose ps`
- Check MongoDB container logs: `docker compose logs mongodb`
- Verify `.env` has `DB_HOST=mongodb`

**Local Mode:**
- Verify MongoDB Server is installed: `mongod --version`
- Verify MongoDB Shell is installed: `mongosh --version`
- Verify MongoDB Server is running:
  - Windows: Check Services panel or run `net start MongoDB`
  - macOS: `brew services list` or `brew services start mongodb-community`
  - Linux: `sudo systemctl status mongod` or `sudo systemctl start mongod`
- Test connection: `mongosh` or `node scripts/check-mongodb.js`
- Verify `.env` has `DB_HOST=localhost`
- **Note:** If `mongosh` command is not found, you need to install MongoDB Shell separately (see Installation section above)

#### Port Conflicts

- If ports are already in use, update `PORT` in `.env` (Local mode) or port mappings in `docker-compose.yml` (Docker mode)
- Check what's using the port:
  - Windows: `netstat -ano | findstr :PORT`
  - macOS/Linux: `lsof -i :PORT`

#### Environment Variable Issues

- Ensure `.env` file exists (copy from `.env.example`)
- Verify all required variables are set (see Environment Variables Setup section)
- Check that `DB_HOST` matches your mode (`mongodb` for Docker, `localhost` for Local)

## 👥 Contributing

We welcome contributions from the community! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Contact

For any questions or inquiries, please email us at [contact@choosenativeplants.com](mailto:contact@choosenativeplants.com).

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.