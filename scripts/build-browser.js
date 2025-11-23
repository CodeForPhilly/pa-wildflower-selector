#!/usr/bin/env node

/**
 * Cross-platform browser build script
 * Replaces the Windows PowerShell script with a Node.js version
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building browser version...');

// Helper function to remove directory recursively (compatible with older Node versions)
function removeDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  
  const stat = fs.statSync(dirPath);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      removeDir(fullPath);
    }
    fs.rmdirSync(dirPath);
  } else {
    fs.unlinkSync(dirPath);
  }
}

// Helper function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }

  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Helper function to remove file
function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

try {
  // Clean up
  console.log('Cleaning up...');
  removeDir('dist');
  const cachePath = path.join('node_modules', '.cache');
  removeDir(cachePath);

  // Build browser version
  console.log('Building browser bundle...');
  
  // Use node_modules/.bin directly for better Windows compatibility
  const vueCliPath = path.join('node_modules', '.bin', 'vue-cli-service');
  
  execSync(`${vueCliPath} build`, { 
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true
  });

  // Copy to public
  if (fs.existsSync('dist')) {
    console.log('Copying files to public/ directory...');
    copyDir('dist', 'public');
    
    // Remove index.html from public
    const indexPath = path.join('public', 'index.html');
    removeFile(indexPath);
    
    // Remove dist directory
    removeDir('dist');
    
    console.log('Browser build complete! Files copied to public/ directory');
  } else {
    console.error('Build failed - dist directory not found');
    process.exit(1);
  }
} catch (error) {
  console.error('Build failed:', error.message);
  if (error.stdout) console.error('stdout:', error.stdout.toString());
  if (error.stderr) console.error('stderr:', error.stderr.toString());
  process.exit(1);
}

