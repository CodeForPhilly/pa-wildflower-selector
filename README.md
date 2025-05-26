# Choose Native Plants 🌱

<div align="center">

![GitHub license](https://img.shields.io/github/license/CodeForPhilly/pa-wildflower-selector)
![GitHub stars](https://img.shields.io/github/stars/CodeForPhilly/pa-wildflower-selector)
![GitHub issues](https://img.shields.io/github/issues/CodeForPhilly/pa-wildflower-selector)

**Help US residents find and source native plants for their gardens**

[Getting Started](#getting-started) •
[Features](#features) •
[Architecture](#architecture) •
[Development](#development) •
[Database](#database-operations) •
[Contributing](#contributing)

</div>

## 🌟 Overview

[Choose Native Plants](https://choosenativeplants.com) (formerly "PA Wildflower Selector") is a web application that helps US residents find native plants suitable for their gardens. Users can search and filter plants based on various criteria like sun exposure, soil moisture, pollinators attracted, and more. The app also shows where to buy these plants locally.

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

- Docker Desktop installed and running
- Git
- User account with [Code for Philly](https://codeforphilly.org/) 

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/CodeForPhilly/pa-wildflower-selector

# Navigate to project directory
cd pa-wildflower-selector

# Start the Docker environment
docker compose up -d --build
```

### Sync down only the images (without database)
   ```bash
docker compose exec app sh /app/scripts/sync-images
   ```
### Update database with latest Google Sheet changes
To update your local MongoDB with the latest changes from the Google Sheets without re-downloading all images:
   ```bash
docker compose exec app npm run fast-update-data
   ```

### View the application locally
After setup, visit http://localhost:6868/ to view the application.

## 💾 Database Operations

### MongoDB Connection

Connect to MongoDB using MongoDB Compass with:
```
mongodb://[username]:[password]@localhost:7017/pa-wildflower-selector?authSource=admin
```

## 🛠️ Development

### Project Structure

- **UI Code**: Located in `src/` directory
- **Server Code**: Located in the main project directory

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