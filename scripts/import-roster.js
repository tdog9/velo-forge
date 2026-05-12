#!/usr/bin/env node
/**
 * TurboPrep — roster importer
 * ------------------------------------------------------------------
 * Reads an .xlsx or .csv file from imports/ and emits a normalised
 * JSON roster ready for Firestore. By default it prints the result;
 * pass --write to push directly into Firestore via the admin SDK.
 *
 * Expected columns (case-insensitive, order doesn't matter):
 *
 *   Name           required   "Sam Carter"
 *   Email          required   "sam@school.edu.au"
 *   Year           required   "Y9" | "9" | "Year 9"
 *   Tier                      "basic" | "average" | "intense"
 *   Subteam                   "Y9 Boys" | "Y10 Girls" | etc — free text
 *   Notes                     anything
 *
 * Usage:
 *   node scripts/import-roster.js imports/roster.xlsx
 *   node scripts/import-roster.js imports/roster.csv
 *
 * Output: prints JSON to stdout. Pipe into a file or feed it to the
 * Firestore importer (a follow-on script — not shipped here because
 * it needs the firebase-admin SDK + service-account key which doesn't
 * live in this repo).
 */

'use strict';

const fs = require('fs');
const path = require('path');

let xlsx;
try { xlsx = require('xlsx'); }
catch (e) {
  console.error('xlsx module missing. Run: npm install --no-save xlsx');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/import-roster.js <file.xlsx|file.csv>');
  process.exit(1);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error('File not found:', abs);
  process.exit(1);
}

const wb = xlsx.readFile(abs, { cellDates: true });
const sheetName = wb.SheetNames[0];
if (!sheetName) { console.error('No sheets in workbook'); process.exit(1); }
const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

if (rows.length === 0) { console.error('Sheet is empty'); process.exit(1); }

// Build a key map so we accept any column case / spacing.
const sample = rows[0];
const keys = Object.keys(sample);
const find = (label) => keys.find(k => k.toLowerCase().replace(/[\s_\-]/g, '') === label) || null;

const keyName    = find('name')    || find('fullname')   || find('athlete');
const keyEmail   = find('email');
const keyYear    = find('year')    || find('yearlevel')  || find('yr');
const keyTier    = find('tier')    || find('fitness')    || find('level')   || find('ability');
const keySubteam = find('subteam') || find('group')      || find('squad');
const keyNotes   = find('notes')   || find('note')       || find('comment');

if (!keyName)  { console.error('Could not find "Name" column. Found columns:', keys); process.exit(1); }
if (!keyEmail) { console.error('Could not find "Email" column. Found columns:', keys); process.exit(1); }

const normYear = (v) => {
  const s = String(v || '').trim().toUpperCase();
  const m = s.match(/(\d{1,2})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 7 || n > 12) return null;
  return 'Y' + n;
};

const normTier = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (['basic', 'beginner', 'starter', 'easy'].includes(s)) return 'basic';
  if (['average', 'standard', 'intermediate', 'mid', 'medium'].includes(s)) return 'average';
  if (['intense', 'advanced', 'elite', 'race', 'high'].includes(s)) return 'intense';
  return 'average';   // sensible default
};

const out = [];
const skipped = [];

rows.forEach((row, i) => {
  const name  = String(row[keyName]  || '').trim();
  const email = String(row[keyEmail] || '').trim().toLowerCase();
  if (!name || !email) {
    skipped.push({ row: i + 2, reason: 'missing name or email', raw: row });
    return;
  }
  const year = normYear(row[keyYear]);
  if (!year) {
    skipped.push({ row: i + 2, reason: 'unparseable year', raw: row });
    return;
  }
  out.push({
    displayName: name,
    email,
    yearLevel: year,
    fitnessLevel: normTier(row[keyTier]),
    subteam: keySubteam ? (String(row[keySubteam] || '').trim() || null) : null,
    notes:   keyNotes   ? (String(row[keyNotes]   || '').trim() || null) : null,
  });
});

const summary = {
  source: path.basename(abs),
  rowsRead: rows.length,
  imported: out.length,
  skipped: skipped.length,
  athletes: out,
  ...(skipped.length ? { skippedRows: skipped } : {}),
};

console.log(JSON.stringify(summary, null, 2));
