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

## Setup Instructions (leveraging Docker)

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/CodeForPhilly/pa-wildflower-selector

# Navigate to project directory
cd pa-wildflower-selector
```

### 2. Configuration

1. Join the Code for Philly Slack channel
2. Request the following files:
   - Environment key
   - secrets.yaml
   - Plant images package

### 3. Launch Development Environment

```bash
# Build and start containers
docker compose up -d --build
```

The application will be available at http://localhost:6868/

### 4. Data Setup

After first launch, you'll need to:

1. **Add Plant Images**
   - Copy provided images to the images folder

2. **Import Plant Data**
   ```bash
   # Import from Google Sheets (skipping image download)
   docker-compose exec app node ./download.js --skip-images
   ```

3. **Process Data**
   ```bash
   # Transform data for UI compatibility
   docker-compose exec app node massage.js
   ```

## Project Structure

- `/src` - Frontend Vue.js application code
- `/lib` - Backend server utilities
- `/public` - Static assets
- `/helm-chart` - Kubernetes deployment configuration