const https = require('https'); // Required for making HTTPS requests
const { spawn } = require('child_process'); // Required for spawning child processes
const zlib = require('zlib'); // Required for compressing and decompressing data
const tar = require('tar'); // Required for working with tar archives
const fs = require('fs'); // Required for working with the file system
const https = require('https');
const tar = require('tar');
const { spawn } = require('child_process');
const fs = require('fs');

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
    fs.createReadStream(filePath)
      .pipe(zlib.createGunzip())
      .pipe(restoreProcess.stdin)
      .on('close', resolve)
      .on('error', reject);
    restoreProcess.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Restore process exited with code ${code}`));
      }
    });
  });
}

downloadAndSave('https://boutell.dev/pa-wildflower-selector/pa-wildflower-selector.archive.gz', 'pa-wildflower-selector.archive.gz')
  .then(() => console.log('Compressed test data downloaded locally. Starting MongoDB restore.'))
  .then(() => decompressGZAndRestore('pa-wildflower-selector.archive.gz', 'mongorestore --drop --archive'))
  .then(() => console.log('Restored test data MongoDB.'))
  .catch(err => console.error(err));


  function downloadAndExtractTar(url, extractPath) {
    return new Promise((resolve, reject) => {
      https.get(url, res => {
        res.pipe(tar.x({ C: extractPath }))
          .on('finish', resolve)
          .on('error', reject);
      });
    });
  }

  downloadAndExtractTar('https://boutell.dev/pa-wildflower-selector/pa-wildflower-selector.tar', '.')
    .then(() => console.log('Test data downloaded and extracted.'))
    .catch(err => console.error(err));
