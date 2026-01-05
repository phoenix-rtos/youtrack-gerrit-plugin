#!/usr/bin/env node
/**
 * Screenshot automation script for YouTrack Gerrit Plugin
 * 
 * Generates consistent screenshots at the exact resolution required
 * for JetBrains Marketplace (1200x760 minimum).
 * 
 * Usage:
 *   npx puppeteer browsers install chrome
 *   node docs/take-screenshot.js
 * 
 * Or add to package.json scripts:
 *   "screenshot": "node docs/take-screenshot.js"
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = [
  {
    name: 'screenshot-issue-view.png',
    html: 'screenshot-mockup.html',
    width: 1200,
    height: 760,
    description: 'Main issue view with Gerrit widget'
  }
];

async function takeScreenshots() {
  const docsDir = path.dirname(__filename);
  
  console.log('📸 YouTrack Gerrit Plugin - Screenshot Generator\n');
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    for (const screenshot of SCREENSHOTS) {
      const htmlPath = path.join(docsDir, screenshot.html);
      const outputPath = path.join(docsDir, screenshot.name);
      
      if (!fs.existsSync(htmlPath)) {
        console.error(`❌ HTML file not found: ${htmlPath}`);
        continue;
      }
      
      console.log(`📄 Processing: ${screenshot.html}`);
      console.log(`   Resolution: ${screenshot.width}x${screenshot.height}`);
      
      const page = await browser.newPage();
      
      // Set viewport to exact dimensions
      await page.setViewport({
        width: screenshot.width,
        height: screenshot.height,
        deviceScaleFactor: 2  // 2x for retina/high-DPI
      });
      
      // Load the HTML file
      const fileUrl = `file://${htmlPath}`;
      await page.goto(fileUrl, { waitUntil: 'networkidle0' });
      
      // Wait a bit for fonts to load
      await page.evaluate(() => document.fonts.ready);
      await new Promise(r => setTimeout(r, 500));
      
      // Take screenshot
      await page.screenshot({
        path: outputPath,
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: screenshot.width,
          height: screenshot.height
        }
      });
      
      await page.close();
      
      const stats = fs.statSync(outputPath);
      console.log(`   ✅ Saved: ${screenshot.name} (${Math.round(stats.size / 1024)}KB)\n`);
    }
    
    console.log('🎉 All screenshots generated successfully!');
    console.log('\nFiles saved in docs/ directory:');
    SCREENSHOTS.forEach(s => {
      console.log(`   - ${s.name}: ${s.description}`);
    });
    
  } finally {
    await browser.close();
  }
}

// Check if puppeteer is installed
try {
  require.resolve('puppeteer');
  takeScreenshots().catch(console.error);
} catch (e) {
  console.log('📦 Puppeteer not installed. Installing...\n');
  console.log('Run: npm install --save-dev puppeteer');
  console.log('Then: node docs/take-screenshot.js');
  process.exit(1);
}
