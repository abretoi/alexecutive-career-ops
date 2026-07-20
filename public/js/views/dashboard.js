import { scoreBadge, statusBadge, navigate, updateSessionIndicator } from '../app.js';
import { api } from '../api.js';
import { openSessionsModal } from '../components/sessionsPanel.js';

function relTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}

export async function renderDashboard(el, state) {
  // Load active session for context banner
  const activeSession = await api.sessions.active().catch(() => null);
  updateSessionIndicator(activeSession);

  const apps       = state.applications || [];
  const total      = apps.length;
  const applied    = apps.filter(a => ['Applied','Responded','Interview','Offer','Accepted'].includes(a.status)).length;
  const interviews = apps.filter(a => ['Interview','Offer','Accepted'].includes(a.status)).length;
  const offers     = apps.filter(a => ['Offer','Accepted'].includes(a.status)).length;
  const scores     = apps.map(a => parseFloat(a.score)).filter(n => !isNaN(n) && n > 0);
  const avgScore   = scores.length ? (scores.reduce((s,n)=>s+n,0)/scores.length).toFixed(1) : '—';

  const counts = {
    'Evaluated':    apps.filter(a=>a.status==='Evaluated').length,
    'Resume Ready': apps.filter(a=>a.status==='Resume Ready').length,
    'Applied':      applied,
    'Responded':    apps.filter(a=>a.status==='Responded').length,
    'Interview':    interviews,
    'Offer':        offers,
  };

  const recent = [...apps].sort((a,b) => (b.dateAdded||'').localeCompare(a.dateAdded||'')).slice(0,5);

  // Is this a fresh/empty session? (no apps, no profile name set)
  const isFreshSession = total === 0 && !state.profile?.name;
  // Has unsaved data from a previous session (data exists but no named active session)?
  const hasUnsavedHistory = total > 0 && (!activeSession?.id || !activeSession?.savedAt);

  el.innerHTML = `
  <div class="page-hdr">
    <h1>${isFreshSession ? 'Welcome to Alexecutive.' : 'Your Career, Accelerated.'}</h1>
    <p>${isFreshSession ? 'Set up your profile and upload your resume to get started.' : 'AI-powered career command center — every industry, every level, every stage.'}</p>
  </div>

  ${isFreshSession ? `
  <div style="margin-bottom:20px;padding:20px 22px;background:linear-gradient(135deg,color-mix(in oklab,var(--blue) 8%,transparent),color-mix(in oklab,var(--teal) 6%,transparent));border:1px solid color-mix(in oklab,var(--blue) 20%,transparent);border-radius:var(--r-lg)">
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">Clean session — ready to go.</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6">This is a fresh start. Complete these three steps to unlock all AI features.</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <div style="padding:12px 14px;background:color-mix(in oklab,var(--bg3) 80%,transparent);border-radius:var(--r-md);cursor:pointer" onclick="window.alexNavigate('profile')">
        <div style="font-size:11px;font-weight:700;color:var(--blue2);margin-bottom:4px">STEP 1</div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">Add your API key</div>
        <div style="font-size:11.5px;color:var(--text3)">Profile &amp; Settings</div>
      </div>
      <div style="padding:12px 14px;background:color-mix(in oklab,var(--bg3) 80%,transparent);border-radius:var(--r-md);cursor:pointer" onclick="window.alexNavigate('resume')">
        <div style="font-size:11px;font-weight:700;color:var(--teal);margin-bottom:4px">STEP 2</div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">Upload resume</div>
        <div style="font-size:11.5px;color:var(--text3)">Resume &amp; CV</div>
      </div>
      <div style="padding:12px 14px;background:color-mix(in oklab,var(--bg3) 80%,transparent);border-radius:var(--r-md);cursor:pointer" onclick="window.alexNavigate('search')">
        <div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:4px">STEP 3</div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">Search jobs</div>
        <div style="font-size:11.5px;color:var(--text3)">Job Search</div>
      </div>
    </div>
    ${(await api.sessions.list().catch(()=>[])).length ? `
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:flex;align-items:center;gap:10px">
      <span style="font-size:12px;color:var(--text3)">Have previous sessions?</span>
      <button class="btn btn-secondary btn-sm" id="dash-restore-btn">Restore a Session</button>
    </div>` : ''}
  </div>` : ''}

  ${hasUnsavedHistory ? `
  <div style="margin-bottom:16px;padding:10px 14px;background:color-mix(in oklab,var(--amber) 7%,transparent);border:1px solid color-mix(in oklab,var(--amber) 20%,transparent);border-radius:var(--r-md);display:flex;align-items:center;gap:12px">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--amber)" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0"><rect x="1.5" y="2" width="11" height="10" rx="1"/><path d="M4 2V1M10 2V1M1.5 5.5h11"/></svg>
    <span style="font-size:12.5px;color:var(--text2);flex:1">You have unsaved session data from a previous run. Save it to keep your history, or start fresh.</span>
    <button class="btn btn-secondary btn-sm" id="dash-save-banner-btn">Save Session</button>
    <button class="btn btn-ghost btn-sm" id="dash-sessions-btn">Manage</button>
  </div>` : ''}

  ${activeSession?.name && activeSession.name !== 'Unsaved Session' && !isFreshSession ? `
  <div style="margin-bottom:16px;padding:8px 14px;background:var(--bg3);border:1px solid var(--line);border-radius:var(--r-md);display:flex;align-items:center;gap:10px">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="2" width="10" height="8" rx="1"/><path d="M3.5 2V1M8.5 2V1M1 5h10"/></svg>
    <span style="font-size:12px;color:var(--text3)">Session: <b style="color:var(--text2)">${esc(activeSession.name)}</b></span>
    ${activeSession.savedAt ? `<span style="font-size:11px;color:var(--text4)">· Last saved ${relTime(activeSession.savedAt)}</span>` : ''}
    <button class="btn btn-ghost btn-sm" id="dash-manage-session-btn" style="margin-left:auto;font-size:11px">Manage</button>
  </div>` : ''}

  ${!state.hasApiKey ? `
  <div class="card c-amber" style="margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:12px">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--amber)" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0"><path d="M10 7v4M10 14v.5M2.5 17h15L10 3 2.5 17z"/></svg>
      <div>
        <div style="font-weight:600;color:var(--text);margin-bottom:2px">Anthropic API key not configured</div>
        <div style="font-size:13px">Add your key in Settings to enable AI job scoring, resume tailoring, and LinkedIn optimization.</div>
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-left:auto;flex-shrink:0" onclick="window.alexNavigate('profile')">Settings</button>
    </div>
  </div>` : ''}

  ${!state.resume ? `
  <div class="card c-teal" style="margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:12px">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--teal)" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0"><path d="M4 2h9l5 5v11H4V2z"/><path d="M13 2v5h5"/><path d="M7 10h6M7 13h6M7 16h3"/></svg>
      <div>
        <div style="font-weight:600;color:var(--text);margin-bottom:2px">No resume uploaded yet</div>
        <div style="font-size:13px">Upload your resume so Claude can tailor it per role and accurately score fit.</div>
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-left:auto;flex-shrink:0" onclick="window.alexNavigate('resume')">Upload Resume</button>
    </div>
  </div>` : ''}

  <div class="stats-row">
    <div class="stat blue">
      <div class="stat-label">Total Tracked</div>
      <div class="stat-value blue">${total}</div>
      <div class="stat-sub">Applications logged</div>
    </div>
    <div class="stat teal">
      <div class="stat-label">Applied</div>
      <div class="stat-value teal">${applied}</div>
      <div class="stat-sub">Submitted</div>
    </div>
    <div class="stat amber">
      <div class="stat-label">Interviews</div>
      <div class="stat-value amber">${interviews}</div>
      <div class="stat-sub">Active conversations</div>
    </div>
    <div class="stat green">
      <div class="stat-label">Avg Match Score</div>
      <div class="stat-value green">${avgScore}</div>
      <div class="stat-sub">Across evaluated roles</div>
    </div>
  </div>

  <div class="section">
    <div class="section-hdr">
      <span class="section-title">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6.5h9M6.5 2l4.5 4.5L6.5 11"/></svg>
        Quick Actions
      </span>
    </div>
    <div class="grid-3" style="gap:10px">
      ${quickCard(iconSearch,'Job Search','Search LinkedIn, Indeed, Glassdoor + 45 ATS boards','search')}
      ${quickCard(iconEval,'Evaluate Role','Paste a URL or JD — get full AI analysis','eval')}
      ${quickCard(iconDoc,'Tailor Resume','ATS-optimized resume + CV for any role','resume')}
      ${quickCard(iconPerson,'LinkedIn Optimizer','Rewrite headline, About, and skills','linkedin')}
      ${quickCard(iconTracker,'Applications','View, filter, and update your tracker','tracker')}
      ${quickCard(iconExport,'Export to CSV','Download for Google Sheets or Excel','export')}
    </div>
  </div>

  <div class="section">
    <div class="section-hdr">
      <span class="section-title">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1.5L8 5l3.5.5-2.5 2.5.5 3.5L6.5 10 4 11.5l.5-3.5L2 5.5 5.5 5z"/></svg>
        Pipeline
      </span>
      <div class="section-rule"></div>
      <button class="btn btn-ghost btn-sm" onclick="window.alexNavigate('tracker')">View all</button>
    </div>
    <div class="funnel">
      ${Object.entries(counts).map(([label, n]) => `
        <div class="funnel-stage">
          <div class="funnel-n" style="background:${stageGrad(label)};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${n}</div>
          <div class="funnel-l">${label}</div>
        </div>`).join('')}
    </div>
  </div>

  ${recent.length ? `
  <div class="section">
    <div class="section-hdr">
      <span class="section-title">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="2" width="10" height="9" rx="1.5"/><path d="M4 1v2M9 1v2M1.5 5h10"/></svg>
        Recent Activity
      </span>
      <div class="section-rule"></div>
      <button class="btn btn-ghost btn-sm" onclick="window.alexNavigate('tracker')">View all</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Company</th><th>Role</th><th>Score</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${recent.map(a => `
          <tr>
            <td class="primary">${esc(a.company)}</td>
            <td>${esc(a.role)}</td>
            <td>${scoreBadge(a.score)}</td>
            <td>${statusBadge(a.status)}</td>
            <td style="color:var(--text3);font-size:12px">${a.dateApplied || a.dateAdded || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}
  `;

  el.querySelectorAll('[data-qa]').forEach(card => {
    card.addEventListener('click', () => {
      const qa = card.dataset.qa;
      if (qa === 'eval')   document.getElementById('quick-eval-btn').click();
      else if (qa === 'export') api.export.csv();
      else navigate(qa);
    });
  });

  // Session banner buttons
  el.querySelector('#dash-restore-btn')?.addEventListener('click', () => {
    openSessionsModal(() => navigate('dashboard'));
  });
  el.querySelector('#dash-save-banner-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#dash-save-banner-btn');
    const name = prompt('Save this session as:', `Session ${new Date().toLocaleDateString()}`);
    if (!name) return;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const saved = await api.sessions.save(name.trim());
      updateSessionIndicator(saved);
      import('../app.js').then(({ toast }) => toast(`Saved as "${saved.name}"`, 'success'));
      navigate('dashboard');
    } catch { btn.disabled = false; btn.textContent = 'Save Session'; }
  });
  el.querySelector('#dash-sessions-btn')?.addEventListener('click', () => {
    openSessionsModal(() => navigate('dashboard'));
  });
  el.querySelector('#dash-manage-session-btn')?.addEventListener('click', () => {
    openSessionsModal(() => navigate('dashboard'));
  });
}

const iconSearch  = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M12.5 12.5l4 4"/></svg>`;
const iconEval    = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 2L11 7l5 .5-3.5 3.5L13 16l-4-2.5L5 16l.5-5L2 7.5 7 7z"/></svg>`;
const iconDoc     = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 2h7.5l4.5 4.5V16H4V2z"/><path d="M11 2v5h4.5"/><path d="M6.5 10h5M6.5 12.5h5M6.5 15h3"/></svg>`;
const iconPerson  = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="9" cy="6" r="3"/><path d="M2 17c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>`;
const iconTracker = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="2" width="12" height="14" rx="1.5"/><path d="M6.5 6.5h5M6.5 9.5h5M6.5 12.5h3"/></svg>`;
const iconExport  = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 2v9M5.5 7.5L9 11l3.5-3.5"/><path d="M2 13v2a1 1 0 001 1h12a1 1 0 001-1v-2"/></svg>`;

function quickCard(icon, title, desc, qa) {
  return `<div class="card card-sm" style="cursor:pointer" data-qa="${qa}">
    <div style="color:var(--blue2);margin-bottom:10px">${icon}</div>
    <div style="font-size:13.5px;font-weight:600;color:var(--text);margin-bottom:3px">${title}</div>
    <div style="font-size:12px;color:var(--text3);line-height:1.45">${desc}</div>
  </div>`;
}

function stageGrad(s) {
  const m = {
    'Evaluated':    'var(--grad-indigo)',
    'Resume Ready': 'var(--grad-blue)',
    'Applied':      'var(--grad-teal)',
    'Responded':    'var(--grad-teal)',
    'Interview':    'var(--grad-amber)',
    'Offer':        'var(--grad-green)',
  };
  return m[s] || 'var(--grad)';
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
