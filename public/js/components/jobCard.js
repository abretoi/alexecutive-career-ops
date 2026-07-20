/** Reusable job card component — Alexecutive Career Ops */

const COLORS = ['#0a84ff','#06b6d4','#30d158','#5e5ce6','#ff9f0a','#409cff','#00b8a9','#3b82f6'];
const LEVEL_LABELS = {
  internship:'Intern', entry:'Entry', mid:'Mid-Level', senior:'Senior',
  lead:'Lead/Staff', manager:'Manager', director:'Director',
  vp:'VP/SVP', executive:'Executive', 'c-suite':'C-Suite',
};
function logoColor(company) { let h = 0; for (const c of company) h = (h * 31 + c.charCodeAt(0)) & 0xffffff; return COLORS[h % COLORS.length]; }

function companyLogoHtml(job) {
  const initials = (job.company || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  const color = logoColor(job.company || '');
  // Try to get domain from job URL for favicon; fall back to colored initials
  let domain = '';
  try { if (job.url) domain = new URL(job.url).hostname.replace(/^www\./, ''); } catch {}
  if (domain) {
    return `<div class="job-co-logo" style="background:${color};overflow:hidden;padding:0">
      <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64"
           width="36" height="36" style="width:100%;height:100%;object-fit:contain;border-radius:inherit"
           onerror="this.parentElement.innerHTML='<span style=\\'font-size:13px;font-weight:700;color:#fff\\'>${initials}</span>';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center'">
    </div>`;
  }
  return `<div class="job-co-logo" style="background:${color}">${initials}</div>`;
}

function scoreClass(score) {
  if (!score) return 'none';
  return score >= 4.5 ? 'exc' : score >= 3.5 ? 'good' : score >= 3.0 ? 'ok' : 'weak';
}

function cardAccentClass(score) {
  if (!score) return '';
  return score >= 4.5 ? 'jc-green' : score >= 3.5 ? '' : score >= 3.0 ? 'jc-amber' : 'jc-rose';
}

function relativeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  if (diff < 7)  return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff/7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const BOARD_NAMES = {
  linkedin:'LinkedIn', indeed:'Indeed', glassdoor:'Glassdoor', zip_recruiter:'ZipRecruiter',
  google:'Google Jobs', greenhouse:'Greenhouse', lever:'Lever', ashby:'Ashby',
  wellfound:'Wellfound', yc:'Y Combinator', startupjobs:'startup.jobs',
  welcomejungle:'Welcome to the Jungle', cord:'Cord', builtin:'Built In',
  remotive:'Remotive', remoteco:'Remote.co', justremote:'Just Remote',
  '4dayweek':'4 Day Week', remoterocketship:'Remote Rocketship', jobalert:'JobAlert',
  hrjobsremote:'HR Jobs Remote', '80khours':'80k Hours', idealist:'Idealist',
  dataaxy:'Dataaxy', topstartups:'Top Startups',
};

function boardLabel(source) {
  return BOARD_NAMES[source?.toLowerCase()] || source || 'Direct';
}

// Daily applicant rate [min, max] for estimate calculation (mirrors server-side)
const DAILY_RATE = {
  linkedin:[18,55], indeed:[12,40], glassdoor:[8,28], zip_recruiter:[10,35], google:[10,30],
  greenhouse:[3,12], lever:[2,10], ashby:[2,8], wellfound:[4,14], yc:[6,20],
  startupjobs:[2,8], welcomejungle:[4,15], cord:[2,7], builtin:[5,18],
  remotive:[4,14], remoteco:[2,8], justremote:[2,7], '4dayweek':[1,6],
  remoterocketship:[3,10], jobalert:[2,8], hrjobsremote:[2,7],
  '80khours':[3,10], idealist:[3,12], dataaxy:[2,8], topstartups:[2,8],
};

function fmtApplicants(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function applicantMeta(job) {
  const multiBoard = (job.seenOnBoards || []).length > 1;
  const boardCount = (job.seenOnBoards || []).length;
  const primarySrc = job.source?.toLowerCase();

  // 1 — Actual count from posting
  if (job.numApplicants) {
    const label = multiBoard
      ? `${fmtApplicants(job.numApplicants)}+ applicants (${boardCount} boards)`
      : `${fmtApplicants(job.numApplicants)}+ applicants`;
    return `<span class="applicant-meta applicant-actual" title="${multiBoard ? 'Aggregate across ' + (job.seenOnBoards||[]).map(b=>BOARD_NAMES[b]||b).join(', ') : 'Applicant count from job posting'}">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="3.5" cy="3" r="1.5"/><path d="M1 8.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><circle cx="7" cy="3" r="1.5"/><path d="M6 8.5c0-1.4 1.1-2.5 2.5-2.5"/></svg>
      ${label}
    </span>`;
  }

  // 2 — Estimate based on board + days posted
  const rates = DAILY_RATE[primarySrc] || [2, 8];
  let days = 7;
  if (job.datePosted) {
    const d = new Date(job.datePosted);
    if (!isNaN(d)) days = Math.max(1, Math.min(90, Math.floor((Date.now() - d) / 86400000)));
  }
  const estMin = Math.round(rates[0] * days);
  const estMax = Math.round(rates[1] * days);

  const label = multiBoard
    ? `~${fmtApplicants(estMin)}–${fmtApplicants(estMax)} est. applicants (${boardCount} boards)`
    : `~${fmtApplicants(estMin)}–${fmtApplicants(estMax)} est. applicants`;

  return `<span class="applicant-meta applicant-est" title="${multiBoard
    ? 'Aggregate estimate across ' + (job.seenOnBoards||[]).map(b=>BOARD_NAMES[b]||b).join(', ')
    : 'Estimated based on board activity + days posted — not from posting'}">
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="3.5" cy="3" r="1.5"/><path d="M1 8.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><circle cx="7" cy="3" r="1.5"/><path d="M6 8.5c0-1.4 1.1-2.5 2.5-2.5"/></svg>
    ${label}
  </span>`;
}

export function renderJobCard(job, opts = {}) {
  const score = job.score;
  const sc    = scoreClass(score);
  const ac    = cardAccentClass(score);
  const { selectionMode = false, selected = false } = opts;

  // Build display salary string from available fields
  let salaryDisplay = job.salary || '';
  if (!salaryDisplay && (job.salaryMin || job.salaryMax)) {
    const fmt = n => '$' + Number(n).toLocaleString();
    salaryDisplay = job.salaryMin && job.salaryMax
      ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`
      : fmt(job.salaryMin || job.salaryMax);
  }

  return `
  <div class="job-card ${ac}${selected ? ' job-card-selected' : ''}">
    ${selectionMode ? `<label class="job-card-select-label"><input type="checkbox" class="job-card-select-cb" data-job-id="${esc(job.id)}" ${selected ? 'checked' : ''}><span class="job-card-select-check"></span></label>` : ''}
    <div class="job-card-top">
      ${companyLogoHtml(job)}
      <div class="job-info">
        <div class="job-title" title="${esc(job.title)}">${esc(job.title)}</div>
        <div class="job-company">${esc(job.company)}</div>
      </div>
      ${score ? `<span class="score-badge ${sc}" style="margin-left:auto;flex-shrink:0">${score.toFixed(1)}</span>` : ''}
    </div>

    <div class="job-meta">
      ${job.location ? `<span>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="5.5" cy="4.5" r="2"/><path d="M5.5 1.5C3.6 1.5 2 3 2 4.8c0 2.6 3.5 5.2 3.5 5.2s3.5-2.6 3.5-5.2C9 3 7.4 1.5 5.5 1.5z"/></svg>
        ${esc(job.location)}</span>` : ''}
      ${salaryDisplay ? `<span>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="5.5" cy="5.5" r="4"/><path d="M5.5 3v.8M5.5 7.2V8M4 5.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5S7 7 5.5 7 4 6.3 4 5.5z"/></svg>
        ${esc(salaryDisplay)}</span>` : ''}
      ${job.datePosted ? `<span>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="1.5" y="2" width="8" height="7.5" rx="1"/><path d="M1.5 4.5h8M3.5 1v2M7.5 1v2"/></svg>
        ${relativeDate(job.datePosted)}</span>` : ''}
      ${job.source ? `<span style="color:var(--text4)">
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="4.5" cy="4.5" r="3.5"/><path d="M3 4.5h3M4.5 3v3"/></svg>
        ${boardLabel(job.source)}</span>` : ''}
      ${applicantMeta(job)}
    </div>

    <div class="job-chips">
      ${job.remote      ? '<span class="chip chip-teal">Remote</span>' : ''}
      ${job.jobType     ? `<span class="chip chip-gray">${esc(job.jobType.replace(/_/g,' '))}</span>` : ''}
      ${job.careerLevel ? `<span class="chip chip-indigo">${esc(LEVEL_LABELS[job.careerLevel] || job.careerLevel)}</span>` : ''}
      ${job.easyApply   ? '<span class="chip chip-green">Easy Apply</span>' : ''}
      ${job.archetype   ? `<span class="chip chip-blue">${esc(job.archetype)}</span>` : ''}
      ${job.verdict     ? `<span class="chip chip-${job.verdict==='Apply'?'green':job.verdict==='Consider'?'amber':'red'}">${esc(job.verdict)}</span>` : ''}
      ${job.keywordMatch && job.keywordMatch.pct != null ? `<span class="chip chip-kw" title="ATS keyword match: ${job.keywordMatch.matched?.slice(0,5).join(', ') || ''}${(job.keywordMatch.matched?.length||0)>5?' …':''}">
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M1 5l2.5 2.5L8 1.5"/></svg>
        ${job.keywordMatch.pct}% ATS
      </span>` : ''}
    </div>
    <div class="job-salary-row" id="salary-row-${esc(job.id)}">
      ${salaryDisplay
        ? `<span class="salary-badge salary-posted">
             <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="5" cy="5" r="3.5"/><path d="M5 2.8v.5m0 3.5v.5m-1.5-2c0-.6.6-1 1.5-1s1.5.4 1.5 1-.6 1-1.5 1-1.5.4-1.5 1 .6 1 1.5 1"/></svg>
             ${esc(salaryDisplay)}
           </span>`
        : `<span style="font-size:11px;color:var(--text4);font-style:italic">Salary not listed</span>
           <button class="btn btn-ghost btn-sm salary-est-btn" data-job-id="${esc(job.id)}" style="font-size:11px;padding:3px 9px;margin-left:6px">
             <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="5" cy="5" r="3.5"/><path d="M5 2.8v.5m0 3.5v.5"/></svg>
             Est. Salary
           </button>`
      }
    </div>

    ${job.scoreReason ? `<div class="job-reason">${esc(job.scoreReason)}</div>` : ''}

    <div class="job-actions">
      <button class="btn btn-primary btn-sm evaluate-btn">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5.5 1L7 4l3.5.5L8 7l.5 3.5L5.5 9 3 10.5l.5-3.5L1 4.5 4.5 4z"/></svg>
        Evaluate
      </button>
<button class="btn btn-secondary btn-sm save-btn">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5.5 1v7M3 6l2.5 2.5L8 6"/><path d="M1 10h9"/></svg>
        Save
      </button>
      ${job.url ? `<a href="${esc(job.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 2H2.5A1.5 1.5 0 001 3.5v5A1.5 1.5 0 002.5 10h5A1.5 1.5 0 009 8.5V7M6 1h4v4M9 2 5.5 5.5"/></svg>
        View
      </a>` : ''}
    </div>
  </div>`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
