#!/usr/bin/env node
/**
 * One-off parser for the Venom team's "HPR (Venom) | Race Schedule & Data.xlsx"
 * (Casey Fields Race #2). Produces three artefacts:
 *
 *   1. roster.json        — the 8 unique riders, normalised for team_invites
 *   2. race-archive.json  — the race result + per-stint data, ready for the
 *                           race_archive/casey-fields-race-2/... Firestore tree
 *   3. summary.md         — a human-readable race brief
 *
 * Writes to imports/parsed-venom/. Pure file-IO; no Firestore writes.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const SRC = '/Users/tennyhearn/dev/tdog-industries/HPR (Venom) &#x7c; Race Schedule & Data.xlsx';
const OUT_DIR = path.join(__dirname, '..', 'imports', 'parsed-venom');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Read sheet ─────────────────────────────────────────────────────
const wb = xlsx.readFile(SRC, { cellDates: false });
const sheetName = 'Casey Fields – Race #2';
const ws = wb.Sheets[sheetName];
if (!ws) { console.error('Sheet not found:', sheetName); process.exit(1); }
const rows = xlsx.utils.sheet_to_json(ws, { defval: '', header: 1, raw: true });

// ── Helpers ────────────────────────────────────────────────────────
// Excel times come through as fractional days. Convert to HH:MM strings.
function excelToTime(v) {
  if (typeof v !== 'number') return String(v || '').trim();
  // Excel "day" 1.0 == 24h. Take fraction × 24 for hours.
  const totalMin = Math.round(v * 24 * 60);
  let h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  // The schedule runs 10AM-4PM. Values below noon may be 12-hour, but
  // Excel stores PM times as ≥0.5. We render as 12-hour for display.
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function clean(s) { return String(s || '').trim().replace(/\s+/g, ' '); }
function nullIfDash(s) { const c = clean(s); return c === '—' || c === '' ? null : c; }

// ── 1. Stint table (rows 5-13 in the sheet = indices 4-12) ─────────
const stints = [];
for (let r = 4; r <= 12; r++) {
  const row = rows[r] || [];
  const num = clean(row[0]);
  if (!/^\d+$/.test(num)) continue;
  stints.push({
    stintNumber: parseInt(num, 10),
    timeWindow: clean(row[1]),         // "10:00 - 10:45"
    durationMin: parseInt(String(row[2]).match(/\d+/)?.[0] || '0', 10),
    timeIn:  excelToTime(row[3]),
    timeOut: excelToTime(row[4]),
    rider:   clean(row[5]),
    backup1: nullIfDash(row[6]),
    backup2: nullIfDash(row[7]),
    note:    clean(row[8]) || null,    // e.g. "Pit time: 45 seconds"
  });
}

// ── 2. Per-rider data (rows 17-24 = indices 16-23) ─────────────────
const riderData = [];
for (let r = 16; r <= 23; r++) {
  const row = rows[r] || [];
  const num = clean(row[0]);
  if (!/^\d+$/.test(num)) continue;
  const name = clean(row[1]);
  if (!name) continue;
  // Lap tally may be "10 (5)" or "11 (5)" — the (n) is laps in second stint
  const lapTallyRaw = clean(row[6]);
  const lapTallyMatch = lapTallyRaw.match(/^(\d+)(?:\s*\((\d+)\))?/);
  const lapsPrimary = lapTallyMatch ? parseInt(lapTallyMatch[1], 10) : null;
  const lapsBonus   = lapTallyMatch?.[2] ? parseInt(lapTallyMatch[2], 10) : 0;
  riderData.push({
    riderNumber: parseInt(num, 10),
    name,
    foamMm:    parseInt(String(row[2]).match(/-?\d+/)?.[0] || '0', 10) || null,
    headRest:  parseInt(String(row[3]).match(/-?\d+/)?.[0] || '0', 10) || null,
    posIn:     nullIfDash(row[4]),
    posOut:    nullIfDash(row[5]),
    lapTally:  lapTallyRaw || null,
    lapsPrimary,
    lapsBonus,
    lapsTotal: (lapsPrimary || 0) + lapsBonus,
    conditions: clean(row[7]) || null,
    delays:     clean(row[8]) || null,
    notes:      clean(row[9]) || null,
  });
}

// ── 3. Build roster ────────────────────────────────────────────────
// Athletes for team_invites — emails are placeholders (admin fills in
// real ones before pushing). Year/tier default sensibly.
const roster = riderData.map(r => ({
  displayName: r.name,
  email: `${r.name.toLowerCase().replace(/\s+/g, '.')}@cgs.vic.edu.au`,
  yearLevel: 'Y10',          // placeholder; admin can edit per athlete
  fitnessLevel: 'average',   // placeholder
  subteam: 'Venom',
  notes: r.notes || null,
}));

// ── 4. Build race archive entry ────────────────────────────────────
const totalLaps = riderData.reduce((s, r) => s + (r.lapsTotal || 0), 0);
const raceArchive = {
  raceId:   'casey-fields-race-2',
  raceName: 'Casey Fields — Race #2',
  raceYear: 2026,                                // adjust if these data are older
  team:     'Venom',
  schedule: '10:00 AM – 4:00 PM',
  stintCount: stints.length,
  totalLaps,
  drivers: riderData.map(r => ({
    name: r.name,
    laps: r.lapsTotal,
    foamMm: r.foamMm,
    headRest: r.headRest,
    posIn: r.posIn,
    posOut: r.posOut,
    conditions: r.conditions,
    delays: r.delays,
    notes: r.notes,
  })),
  stints,
  summary: buildSummary(riderData, stints, totalLaps),
};

function buildSummary(rd, st, total) {
  const top = [...rd].sort((a, b) => (b.lapsTotal || 0) - (a.lapsTotal || 0)).slice(0, 3);
  return `${st.length} stints · ${total} total laps. Top contributors: ${top.map(r => r.name + ' (' + r.lapsTotal + ')').join(', ')}.`;
}

// ── 5. Human-readable Markdown brief ───────────────────────────────
let md = `# Casey Fields — Race #2 (Venom)\n\n`;
md += `**Schedule**: ${raceArchive.schedule}  ·  **Stints**: ${stints.length}  ·  **Total laps**: ${totalLaps}\n\n`;
md += `## Stint schedule\n\n`;
md += `| # | Time | Duration | Rider | 1st backup | 2nd backup | Note |\n`;
md += `|---|------|----------|-------|------------|------------|------|\n`;
stints.forEach(s => {
  md += `| ${s.stintNumber} | ${s.timeWindow} | ${s.durationMin}m | ${s.rider} | ${s.backup1 || '—'} | ${s.backup2 || '—'} | ${s.note || ''} |\n`;
});
md += `\n## Per-rider data\n\n`;
md += `| Rider | Laps | Foam | Headrest | Pos in→out | Conditions | Notes |\n`;
md += `|-------|------|------|----------|-----------|------------|-------|\n`;
riderData.forEach(r => {
  md += `| ${r.name} | ${r.lapTally || '—'} | ${r.foamMm || '—'}mm | ${r.headRest ?? '—'} | ${r.posIn || '—'} → ${r.posOut || '—'} | ${r.conditions || ''} | ${(r.notes || '').slice(0, 100)} |\n`;
});
md += `\n## Roster (8 riders → ready for TurboPrep team)\n\n`;
roster.forEach(r => {
  md += `- **${r.displayName}** · ${r.subteam} · ${r.yearLevel} · ${r.fitnessLevel}\n`;
});
md += `\n_Emails are placeholders (\`firstname.lastname@cgs.vic.edu.au\`) — replace with real addresses before push._\n`;

// ── Write outputs ──────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT_DIR, 'roster.json'),       JSON.stringify(roster, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'race-archive.json'), JSON.stringify(raceArchive, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'summary.md'),        md);

console.log('✓ Parsed Casey Fields Race #2 (Venom)');
console.log('  ' + stints.length + ' stints');
console.log('  ' + riderData.length + ' riders');
console.log('  ' + totalLaps + ' total laps');
console.log('\nOutputs written to ' + path.relative(process.cwd(), OUT_DIR) + '/');
console.log('  • roster.json       (' + roster.length + ' athletes)');
console.log('  • race-archive.json (Firestore-ready)');
console.log('  • summary.md        (human-readable brief)');
