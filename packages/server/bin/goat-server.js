#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// If dist exists, require from dist; otherwise use tsx/ts-node if in dev
const distPath = path.resolve(__dirname, '../dist/main.js');

if (fs.existsSync(distPath)) {
  const { runServer } = require(distPath);
  runServer();
} else {
  // Use tsx for development execution
  require('tsx/cjs');
  const { runServer } = require('../src/main.ts');
  runServer();
}
