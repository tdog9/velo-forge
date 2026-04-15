// TurboPrep Health Checker
// Runs on every 5th load + once daily
// Sends report to hearn.tenny@icloud.com if issues found

const HC_LOAD_KEY   = 'tp_hc_load_count';
const HC_DAILY_KEY  = 'tp_hc_last_daily';
const HC_ERRORS_KEY = 'tp_hc_captured_errors';
const REPORT_EMAIL  = 'hearn.tenny@icloud.com';

// ── Passive error capture (runs immediately on import) ────────────────────────
window.addEventListener('error', e => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(HC_ERRORS_KEY) || '[]');
    stored.push({ type:'js_error', message: e.message||'Unknown', file:(e.filename||'').split('/').pop(), line:e.lineno||0, ts:Date.now() });
    sessionStorage.setItem(HC_ERRORS_KEY, JSON.stringify(stored.slice(-30)));
  } catch(_) {}
});
window.addEventListener('unhandledrejection', e => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(HC_ERRORS_KEY) || '[]');
    stored.push({ type:'promise', message: e.reason?.message||String(e.reason)||'Rejection', ts:Date.now() });
    sessionStorage.setItem(HC_ERRORS_KEY, JSON.stringify(stored.slice(-30)));
  } catch(_) {}
});

// ── UI checks ─────────────────────────────────────────────────────────────────
function runUIChecks() {
  const issues = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Overflowing elements
  document.querySelectorAll('.card,.btn,.input,.tab-btn,.page-title,.sheet,.modal').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 20) issues.push({ type:'overflow_right', el:el.className.split(' ')[0], detail:`${Math.round(r.right)}px > ${vw}px viewport` });
  });

  // Too many fixed elements visible (z-index stack issues)
  const fixedVisible = Array.from(document.querySelectorAll('*')).filter(el => {
    const s = getComputedStyle(el);
    return s.position==='fixed' && s.display!=='none' && el.offsetHeight>0 && el.offsetWidth>0;
  });
  if (fixedVisible.length > 8) issues.push({ type:'z_stack_overflow', detail:`${fixedVisible.length} fixed elements visible` });

  // Critical IDs missing
  ['main-app','content','tab-bar'].forEach(id => {
    if (!document.getElementById(id)) issues.push({ type:'missing_critical_el', detail:`#${id}` });
  });

  // Oversized SVGs (the big icon bug)
  document.querySelectorAll('svg').forEach(svg => {
    if (svg.hasAttribute('style') || svg.hasAttribute('width') || svg.hasAttribute('height')) return;
    const r = svg.getBoundingClientRect();
    if (r.width > 80 || r.height > 80) {
      issues.push({ type:'oversized_svg', detail:`${Math.round(r.width)}x${Math.round(r.height)} in <${svg.parentElement?.tagName?.toLowerCase()}.${svg.parentElement?.className?.split(' ')[0]}>` });
    }
  });

  // Tab bar check
  const tabBar = document.querySelector('.tab-bar');
  if (tabBar) {
    const r = tabBar.getBoundingClientRect();
    if (r.height < 40 || r.height > 130) issues.push({ type:'tabbar_bad_height', detail:`${Math.round(r.height)}px` });
  }

  // Duplicate IDs
  const seen = {};
  document.querySelectorAll('[id]').forEach(el => {
    if (seen[el.id]) issues.push({ type:'duplicate_id', detail:`#${el.id}` });
    seen[el.id] = true;
  });

  // Broken images
  document.querySelectorAll('img').forEach(img => {
    if (img.complete && img.naturalWidth === 0 && img.src) {
      issues.push({ type:'broken_img', detail:img.src.split('/').pop() });
    }
  });

  // Content scroll check
  const content = document.getElementById('content');
  if (content) {
    const cs = getComputedStyle(content);
    if ((cs.overflowY==='hidden'||cs.overflow==='hidden') && content.scrollHeight > content.clientHeight+100) {
      issues.push({ type:'content_unscrollable', detail:`scrollH=${content.scrollHeight} clientH=${content.clientHeight}` });
    }
  }

  return issues;
}

// ── Save to Firestore ─────────────────────────────────────────────────────────
async function saveToFirestore(report, A) {
  if (!A?.db || !A?.setDoc || !A?.doc) return;
  try {
    const key = new Date().toISOString().split('T')[0];
    await A.setDoc(A.doc(A.db, 'health_reports', key), { ...report, savedAt: new Date() }, { merge: true });
  } catch(_) {}
}

// ── Email report ──────────────────────────────────────────────────────────────
async function emailReport(report) {
  if (!report.issueCount) return;

  const subject = `TurboPrep Health: ${report.issueCount} issue${report.issueCount!==1?'s':''} — ${report.date}`;
  const lines = [
    `TurboPrep Automated Health Report`,
    `Date: ${report.date}  Time: ${new Date(report.ts).toLocaleTimeString('en-AU')}`,
    `Device: ${report.vw}x${report.vh}  UA: ${report.ua.slice(0,60)}`,
    ``,
    `SUMMARY`,
    `  JS Errors:  ${report.jsErrors}`,
    `  UI Issues:  ${report.uiIssues}`,
    `  Total:      ${report.issueCount}`,
    ``,
    `DETAILS`,
    ...report.issues.map((i,n) => `  ${n+1}. [${i.type}] ${i.detail||i.message||''} ${i.file?'@ '+i.file+':'+i.line:''}`),
    ``,
    `Open Admin → Maintenance to view in app.`,
    `--- TurboPrep v4.5 Auto-Report ---`
  ].join('\n');

  // EmailJS (configure keys in Firebase remote config or global settings)
  const svc  = window._hcEjsSvc  || '';
  const tpl  = window._hcEjsTpl  || '';
  const key  = window._hcEjsKey  || '';

  if (svc && tpl && key) {
    try {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          service_id: svc, template_id: tpl, user_id: key,
          template_params: { to_email: REPORT_EMAIL, subject, body: lines }
        })
      });
      return;
    } catch(_) {}
  }

  // Fallback: open mailto (opens mail client if on desktop)
  const mailto = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
  if (document.visibilityState === 'visible' && window.innerWidth > 768) {
    window.open(mailto, '_blank');
  }
}

// ── Show badge in admin maintenance tab ───────────────────────────────────────
function showAdminBadge(count) {
  if (!count) return;
  // Try to find admin maintenance button
  setTimeout(() => {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.trim() === 'Maintenance' && !btn.querySelector('.hc-badge')) {
        const b = document.createElement('span');
        b.className = 'hc-badge';
        b.title = `${count} health issue${count!==1?'s':''} detected`;
        b.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#ef4444;color:#fff;font-size:9px;font-weight:800;margin-left:5px;flex-shrink:0;vertical-align:middle';
        b.textContent = count > 9 ? '9+' : String(count);
        btn.appendChild(b);
      }
    });
  }, 1000);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function runHealthCheck(A, force = false) {
  try {
    const loadCount = parseInt(localStorage.getItem(HC_LOAD_KEY) || '0') + 1;
    localStorage.setItem(HC_LOAD_KEY, String(loadCount));

    const lastDaily  = parseInt(localStorage.getItem(HC_DAILY_KEY) || '0');
    const isDailyDue = Date.now() - lastDaily > 23.5 * 60 * 60 * 1000;
    const is5thLoad  = loadCount % 5 === 0;

    if (!force && !is5thLoad && !isDailyDue) return null;
    if (isDailyDue) localStorage.setItem(HC_DAILY_KEY, String(Date.now()));

    // Wait for page to fully render
    await new Promise(r => setTimeout(r, 3500));

    const sessionErrors = (() => { try { return JSON.parse(sessionStorage.getItem(HC_ERRORS_KEY)||'[]'); } catch(_){return[];} })();
    const uiIssues      = runUIChecks();
    const allIssues     = [...sessionErrors, ...uiIssues];

    const report = {
      date: new Date().toISOString().split('T')[0],
      ts: Date.now(),
      vw: window.innerWidth,
      vh: window.innerHeight,
      ua: navigator.userAgent,
      loadCount,
      trigger: isDailyDue ? 'daily' : is5thLoad ? '5th_load' : 'forced',
      jsErrors: sessionErrors.length,
      uiIssues: uiIssues.length,
      issueCount: allIssues.length,
      issues: allIssues.slice(0, 40)
    };

    // Always save to Firestore
    await saveToFirestore(report, A);

    // Store locally for admin view
    try { localStorage.setItem('tp_hc_last_report', JSON.stringify(report)); } catch(_) {}

    if (report.issueCount > 0) {
      showAdminBadge(report.issueCount);
      await emailReport(report);
    }

    return report;
  } catch(e) {
    return null;
  }
}

export function getLastHealthReport() {
  try { return JSON.parse(localStorage.getItem('tp_hc_last_report') || 'null'); } catch(_) { return null; }
}

export function forceHealthCheck(A) { return runHealthCheck(A, true); }
