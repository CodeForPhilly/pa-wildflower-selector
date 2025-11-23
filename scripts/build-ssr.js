#!/usr/bin/env node

/**
 * Cross-platform SSR build script
 * Replaces the Windows PowerShell script with a Node.js version
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building SSR version...');

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

// Helper function to move directory
function moveDir(src, dest) {
  if (fs.existsSync(src)) {
    // Remove destination if it exists
    if (fs.existsSync(dest)) {
      removeDir(dest);
    }
    // Create parent directory if needed
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    // Move the directory
    fs.renameSync(src, dest);
  }
}

try {
  // Clean up
  console.log('Cleaning up...');
  removeDir('dist');
  const cachePath = path.join('node_modules', '.cache');
  removeDir(cachePath);

  // Build SSR
  console.log('Building SSR bundle...');
  
  // Use node_modules/.bin directly for better Windows compatibility
  const env = { ...process.env, SSR: 'true' };
  const vueCliPath = path.join('node_modules', '.bin', 'vue-cli-service');
  
  execSync(`${vueCliPath} build`, { 
    stdio: 'inherit',
    cwd: process.cwd(),
    env: env,
    shell: true
  });

  // Move dist to ssr
  if (fs.existsSync('dist')) {
    moveDir('dist', 'ssr');
    console.log('SSR build complete! Output in ssr/ directory');
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

