// TurboPrep — Race report ingestion + template generation
// ----------------------------------------------------------------------------
// Browser-side module. Lazy-loads SheetJS for xlsx I/O. Reads the same
// "Casey Fields-style" race report format the coach already uses, pushes
// the parsed stints + per-rider notes into Firestore, and can generate
// a blank template pre-filled with a subteam's members (in any order).
//
// Exposed on window.RaceReport so app.js can wire it into the Coach UI
// without an ES-module restructure.

(function () {
  if (window.RaceReport) return;

  // ── SheetJS loader ─────────────────────────────────────────────────
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (window._xlsxLoading) return window._xlsxLoading;
    window._xlsxLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js';
      s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('SheetJS load failed'));
      s.onerror = () => reject(new Error('SheetJS network error'));
      document.head.appendChild(s);
    });
    return window._xlsxLoading;
  }

  // ── Helpers ────────────────────────────────────────────────────────
  const clean = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  const nullIfDash = (s) => { const c = clean(s); return c === '—' || c === '' ? null : c; };
  function excelToTime(v) {
    if (typeof v !== 'number') return clean(v);
    const totalMin = Math.round(v * 24 * 60);
    let h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  // ── Parse uploaded xlsx ────────────────────────────────────────────
  // Accepts a File / Blob / ArrayBuffer. Returns the same shape as the
  // scripts/import-race-venom.js node parser.
  async function parseRaceReport(input) {
    const XLSX = await loadXLSX();
    let data = input;
    if (input instanceof Blob || input instanceof File) {
      data = await input.arrayBuffer();
    }
    const wb = XLSX.read(data, { type: 'array', cellDates: false });
    // Pick the first sheet that LOOKS like a race report (has a stint
    // header row). Falls back to the first sheet.
    let ws = null, sheetName = null;
    for (const name of wb.SheetNames) {
      const candidate = wb.Sheets[name];
      const probe = XLSX.utils.sheet_to_json(candidate, { defval: '', header: 1, raw: true }).slice(0, 12);
      if (probe.some(r => Array.isArray(r) && r.some(c => /stint\s*time/i.test(String(c))))) {
        ws = candidate; sheetName = name; break;
      }
    }
    if (!ws) { ws = wb.Sheets[wb.SheetNames[0]]; sheetName = wb.SheetNames[0]; }
    if (!ws) throw new Error('Workbook has no readable sheet');
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1, raw: true });

    // Title (row 1) + sub (row 2)
    const titleRow = rows[0] || [];
    const subRow = rows[1] || [];
    const title = clean(titleRow[0]) || sheetName;
    const sub = clean(subRow[0]);

    // Find the stint header row — the row whose first non-empty cell is
    // exactly "#" and the second cell contains "Stint" (matches the
    // Casey Fields format). Robust to top-of-sheet padding rows.
    let stintHeaderIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const r = rows[i] || [];
      if (clean(r[0]) === '#' && /stint/i.test(String(r[1] || ''))) { stintHeaderIdx = i; break; }
    }
    if (stintHeaderIdx === -1) throw new Error('Could not find stint header row. Expected "#" and "Stint time" in the first 10 rows.');

    // Walk down stint rows until a blank or non-numeric "#"
    const stints = [];
    for (let r = stintHeaderIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const num = clean(row[0]);
      if (!/^\d+$/.test(num)) break;
      stints.push({
        stintNumber: parseInt(num, 10),
        timeWindow:  clean(row[1]),
        durationMin: parseInt(String(row[2]).match(/\d+/)?.[0] || '0', 10),
        timeIn:      excelToTime(row[3]),
        timeOut:     excelToTime(row[4]),
        rider:       clean(row[5]),
        backup1:     nullIfDash(row[6]),
        backup2:     nullIfDash(row[7]),
        note:        clean(row[8]) || null,
      });
    }

    // Find the per-rider header row (Rider · Foam · Headrest · Pos in · …)
    let riderHeaderIdx = -1;
    for (let i = stintHeaderIdx; i < rows.length; i++) {
      const r = rows[i] || [];
      if (clean(r[0]) === '#' && /rider/i.test(String(r[1] || ''))) { riderHeaderIdx = i; break; }
    }
    const riderData = [];
    if (riderHeaderIdx !== -1) {
      for (let r = riderHeaderIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const num = clean(row[0]);
        if (!/^\d+$/.test(num)) break;
        const name = clean(row[1]);
        if (!name) continue;
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
    }

    const totalLaps = riderData.reduce((s, r) => s + (r.lapsTotal || 0), 0);
    return { sheetName, title, sub, stints, riderData, totalLaps };
  }

  // ── Bar chart for laps per rider (inline SVG, no chart lib) ────────
  function renderChart(parsed, container) {
    if (!container) return;
    const data = (parsed.riderData || []).slice().sort((a, b) => (b.lapsTotal || 0) - (a.lapsTotal || 0));
    if (!data.length) { container.innerHTML = '<div style="color:var(--muted-fg);font-size:12px;text-align:center;padding:20px">No rider data parsed.</div>'; return; }
    const maxLaps = Math.max(...data.map(r => r.lapsTotal || 0), 1);
    const palette = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6'];
    let html = `<div style="display:flex;flex-direction:column;gap:8px">`;
    data.forEach((r, i) => {
      const pct = Math.round(((r.lapsTotal || 0) / maxLaps) * 100);
      const colour = palette[i % palette.length];
      html += `
        <div style="display:grid;grid-template-columns:80px 1fr 40px;gap:8px;align-items:center;font-size:12px">
          <div style="font-weight:700;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escAttr(r.name)}</div>
          <div style="position:relative;height:18px;border-radius:6px;background:rgba(var(--fg-rgb,20,22,28),.06);overflow:hidden">
            <div style="position:absolute;inset:0;width:${pct}%;background:linear-gradient(90deg, ${colour}, ${colour}aa);transition:width .6s cubic-bezier(.18,.89,.32,1)"></div>
          </div>
          <div style="font-weight:800;color:var(--fg);text-align:right;font-variant-numeric:tabular-nums">${r.lapsTotal || 0}</div>
        </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
  }
  function escAttr(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  // ── Generate a blank template ──────────────────────────────────────
  // Pre-fills the stint table with athletes from a chosen subteam (or
  // the whole team). `order` is an array of uids in the order the coach
  // wants riders to appear in stints #1..N. Backups auto-cycle.
  async function generateBlankTemplate({ raceName, teamLabel, members, order, stintCount = 8, stintMin = 45, startTime = '10:00 AM' }) {
    const XLSX = await loadXLSX();
    // Resolve member ordering. `order` is an array of uids; fall back
    // to the natural members order if order is empty.
    const byUid = Object.fromEntries(members.map(m => [m.uid, m]));
    const ordered = (order && order.length ? order : members.map(m => m.uid))
      .map(uid => byUid[uid]).filter(Boolean);
    // Auto-fill backups by rotating the ordered list 1 + 2 positions.
    const pickBackup = (i, offset) => ordered[(i + offset) % ordered.length]?.displayName || '—';

    // ── Sheet 1: Stint schedule ────────────────────────────────────────
    const sheet1 = [
      [raceName || 'Race report'],
      [`${stintCount} stints  ·  starts ${startTime}`],
      [],
      ['#', 'Stint time', 'Duration', 'Time in', 'Time out', 'Rider', '1st backup', '2nd backup', 'Notes'],
    ];
    // Compute start time minutes-from-midnight
    const parseStart = (t) => {
      const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!m) return 10 * 60;
      let h = parseInt(m[1], 10); const mins = parseInt(m[2], 10);
      const ampm = (m[3] || 'AM').toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + mins;
    };
    const fmtTime = (totalMin) => {
      let h = Math.floor(totalMin / 60) % 24; const m = totalMin % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = ((h + 11) % 12) + 1;
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    let cursor = parseStart(startTime);
    for (let i = 0; i < stintCount; i++) {
      const rider = ordered[i % ordered.length];
      const start = cursor;
      const end = cursor + stintMin;
      sheet1.push([
        i + 1,
        `${fmtTime(start)} - ${fmtTime(end)}`,
        `${stintMin} min`,
        '',     // time in (coach fills)
        '',     // time out
        rider?.displayName || `Rider ${i + 1}`,
        pickBackup(i, 1),
        pickBackup(i, 2),
        '',
      ]);
      cursor = end;
    }

    // ── Sheet 2: Per-rider data ────────────────────────────────────────
    sheet1.push([]);   // spacer
    sheet1.push(['#', 'Rider', 'Foam (mm)', 'Head rest', 'Pos. in', 'Pos. out', 'Lap tally', 'Conditions', 'Delays', 'Notes']);
    ordered.forEach((m, i) => {
      sheet1.push([i + 1, m.displayName, 25, '', '', '', '', '', '', '']);
    });

    // ── Sheet 3: Sync metadata (hidden from coach but used on re-upload) ───
    const meta = [
      ['_TURBOPREP_TEMPLATE'],
      ['teamId',    teamLabel || ''],
      ['raceName',  raceName || ''],
      ['generatedAt', new Date().toISOString()],
      ['stintCount', stintCount],
      [],
      ['Rider', 'UID', 'Email'],
      ...ordered.map(m => [m.displayName, m.uid, m.email || '']),
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
    ws1['!cols'] = [{ wch: 4 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws1, (raceName || 'Race').slice(0, 28));
    const ws2 = XLSX.utils.aoa_to_sheet(meta);
    XLSX.utils.book_append_sheet(wb, ws2, '_meta');

    const fname = ((raceName || 'race-report').replace(/[^\w\s-]/g, '').trim() || 'race-report') + '.xlsx';
    XLSX.writeFile(wb, fname);
    return fname;
  }

  // ── Push parsed race report into Firestore ─────────────────────────
  // Writes:
  //   • race_archive/{raceId}/years/{year}/{teamId} — race entry
  //   • users/{uid}/race_notes/{raceId} — per-rider note (matched by name)
  // The uidByName map (parsed from sheet3 meta on re-upload, OR built
  // from the current team's members) lets us route notes to real users.
  async function pushRaceReport({ parsed, raceId, raceYear, teamId, teamMembers, fb }) {
    if (!fb?.db) throw new Error('Firestore handle missing');
    const { db, doc, collection, setDoc, serverTimestamp } = fb;
    const name = clean(parsed.title) || 'Race';
    const drivers = (parsed.riderData || []).map(r => ({
      name: r.name, laps: r.lapsTotal, foamMm: r.foamMm, headRest: r.headRest,
      posIn: r.posIn, posOut: r.posOut, conditions: r.conditions, delays: r.delays,
      notes: r.notes,
    }));
    // Archive entry
    const archiveRef = doc(db, 'race_archive', raceId, 'years', String(raceYear), 'teams', teamId);
    await setDoc(archiveRef, {
      raceId, raceYear, teamId, raceName: name, schedule: parsed.sub || '',
      stintCount: parsed.stints.length,
      totalLaps: parsed.totalLaps,
      stints: parsed.stints,
      drivers,
      summary: buildSummary(parsed),
      createdAt: serverTimestamp(),
    }, { merge: true });
    // Per-rider notes — match by name. Race reports often use first
    // names only (Felix, Hugh, Tenny, …) while user accounts carry
    // full names ("Tenny Hearn"). Build a lookup that tolerates:
    //   • exact full-name match (case-insensitive)
    //   • first-token match  ("Tenny" → "Tenny Hearn")
    //   • last-token match   ("Hearn" → "Tenny Hearn")
    //   • email-prefix match ("tenny" → tenny@cgs.vic.edu.au)
    // First-token wins if multiple matches exist.
    const byKey = new Map();
    const put = (k, uid) => {
      const lk = String(k || '').trim().toLowerCase();
      if (!lk || byKey.has(lk)) return;   // first-write wins → exact > first > last
      byKey.set(lk, uid);
    };
    (teamMembers || []).forEach(m => {
      if (!m?.uid) return;
      const full = String(m.displayName || '').trim();
      put(full, m.uid);
      if (full.includes(' ')) {
        const parts = full.split(/\s+/);
        put(parts[0], m.uid);
        put(parts[parts.length - 1], m.uid);
      }
      const email = String(m.email || '').trim();
      if (email.includes('@')) put(email.split('@')[0], m.uid);
    });
    function resolveUid(rawName) {
      const n = String(rawName || '').trim();
      if (!n) return null;
      // Strip trailing "(2)" / "(B)" markers — stint #9 in the Venom
      // sheet is "Felix (2)" which means Felix's second stint.
      const cleaned = n.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      if (byKey.has(cleaned)) return byKey.get(cleaned);
      // Final fallback: first token only
      const first = cleaned.split(/\s+/)[0];
      return byKey.get(first) || null;
    }
    const writes = [];
    const matched = [];
    const unmatched = [];
    (parsed.riderData || []).forEach(r => {
      if (!r.notes) return;
      const uid = resolveUid(r.name);
      if (!uid) { unmatched.push(r.name); return; }
      matched.push({ name: r.name, uid });
      const ref = doc(db, 'users', uid, 'race_notes', raceId);
      writes.push(setDoc(ref, {
        raceId, raceYear, raceName: name, teamId,
        laps: r.lapsTotal, foamMm: r.foamMm, headRest: r.headRest,
        posIn: r.posIn, posOut: r.posOut, conditions: r.conditions,
        delays: r.delays, notes: r.notes,
        createdAt: serverTimestamp(),
      }, { merge: true }));
    });
    await Promise.all(writes);
    return {
      archived: 1,
      notesWritten: writes.length,
      totalRiders: parsed.riderData.length,
      matched,
      unmatched,
    };
  }

  function buildSummary(parsed) {
    const data = (parsed.riderData || []).slice().sort((a, b) => (b.lapsTotal || 0) - (a.lapsTotal || 0));
    const top = data.slice(0, 3).map(r => `${r.name} (${r.lapsTotal})`).join(', ');
    return `${parsed.stints.length} stints · ${parsed.totalLaps} total laps. Top contributors: ${top}.`;
  }

  // ── AI brief — optional, async, never blocks the push ──────────────
  async function requestAiBrief(parsed) {
    try {
      const fnUrl = '/.netlify/functions/ai-coach';
      const prompt = `You are reviewing a HPR race report. Return ONE paragraph (max 80 words) of coach takeaways: who pulled the team, who needs attention, any recurring setup or technique themes. Be specific. No bullet points.\n\nDATA:\n${JSON.stringify({
        race: parsed.title, schedule: parsed.sub, totalLaps: parsed.totalLaps,
        riders: (parsed.riderData || []).map(r => ({ name: r.name, laps: r.lapsTotal, foam: r.foamMm, conditions: r.conditions, delays: r.delays, notes: r.notes })),
      })}`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], system: 'You are an experienced HPR race coach.' }),
      });
      if (!res.ok) throw new Error('ai-coach ' + res.status);
      const j = await res.json();
      return (j.message || j.text || '').trim();
    } catch (e) {
      console.warn('AI brief failed (non-fatal):', e?.message || e);
      return null;
    }
  }

  window.RaceReport = {
    loadXLSX, parseRaceReport, renderChart,
    generateBlankTemplate, pushRaceReport, requestAiBrief,
  };
})();
