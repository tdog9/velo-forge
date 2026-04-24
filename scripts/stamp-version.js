#!/usr/bin/env node
// Stamp a per-build version into sw.js (CACHE_NAME) and app.js (APP_VERSION)
// so every deploy invalidates the PWA cache. On Netlify we use COMMIT_REF;
// locally we fall back to a UTC timestamp.
//
// Idempotent: re-runs overwrite the previous stamp.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stamp = (process.env.COMMIT_REF || process.env.NETLIFY_COMMIT_REF || '').slice(0, 7)
  || new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);

function rewrite(file, pattern, replace) {
  const full = path.join(root, file);
  const src = fs.readFileSync(full, 'utf8');
  const next = src.replace(pattern, replace);
  if (src === next) {
    console.warn('stamp-version: pattern not found in', file);
    return;
  }
  fs.writeFileSync(full, next);
}

rewrite('sw.js',  /const CACHE_NAME = 'turboprep-[^']+';/, `const CACHE_NAME = 'turboprep-${stamp}';`);
rewrite('app.js', /const APP_VERSION = '[^']+';/g,         `const APP_VERSION = '${stamp}';`);

console.log('stamp-version: stamped', stamp);
