const https = require('https');
const { spawn } = require('child_process');
const zlib = require('zlib');
const tar = require('tar');
const fs = require('fs');

// Function to check if a command exists
function commandExists(command) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, ['--version'], { shell: true });

    let found = false; // Flag to check if command outputs anything

    process.stdout.on('data', (data) => {
      if (data.toString()) {
        found = true;
      }
    });

    process.on('error', (err) => {
      reject(err); // Some other error
    });

    process.on('exit', (code) => {
      resolve(found); // Resolve based on the found flag, true if command outputs anything
    });
  });
}

function downloadAndSave(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, res => {
      res.pipe(file)
        .on('close', resolve)
        .on('error', reject);
    });
  });
}

function decompressGZAndRestore(filePath, restoreCommand) {
  return new Promise((resolve, reject) => {
    const restoreProcess = spawn(restoreCommand, { shell: true });

    restoreProcess.on('error', (err) => {
      reject(new Error(`'${restoreCommand.split(' ')[0]}' command error: ${err.message}. Ensure the command is correct and MongoDB Database Tools are installed and accessible.`));
    });

    restoreProcess.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Restore process exited with code ${code}. Ensure the command is correct and MongoDB Database Tools are installed and accessible.`));
      } else {
        resolve();
      }
    });

    fs.createReadStream(filePath)
      .pipe(zlib.createGunzip())
      .pipe(restoreProcess.stdin)
      .on('error', (error) => {
        // Handle EPIPE or other stream errors
        reject(new Error(`Error piping data to '${restoreCommand}': ${error.message}`));
      });
  });
}

function downloadAndExtractTar(url, extractPath) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      res.pipe(tar.x({ C: extractPath }))
        .on('finish', resolve)
        .on('error', reject);
    });
  });
}

// Beginning of your script logic
commandExists('mongorestore')
  .then(mongorestoreExists => {
    if (!mongorestoreExists) {
      console.error('Error: "mongorestore" command not found. Please ensure MongoDB Database Tools are installed and accessible in your PATH.');
      process.exit(1); // Exit with an error code
    }

    // If mongorestore exists, continue with the rest of your script's logic:
    downloadAndSave('https://boutell.dev/pa-wildflower-selector/pa-wildflower-selector.archive.gz', 'pa-wildflower-selector.archive.gz')
      .then(() => console.log('Compressed test data downloaded locally. Starting MongoDB restore.'))
      .then(() => decompressGZAndRestore('pa-wildflower-selector.archive.gz', 'mongorestore --drop --archive'))
      .then(() => console.log('Restored test data to MongoDB.'))
      .catch(err => console.error(`Error: ${err.message}`));

    downloadAndExtractTar('https://boutell.dev/pa-wildflower-selector/pa-wildflower-selector.tar', '.')
      .then(() => console.log('Test data downloaded and extracted.'))
      .catch(err => console.error(`Error: ${err.message}`));
  })
  .catch(err => {
    console.error(`Error checking for "mongorestore": ${err.message}`);
  });
