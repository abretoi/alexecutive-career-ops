/** app.js — main router, state, and shell wiring — Alexecutive Career Ops */
import { api } from './api.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSearch }    from './views/search.js';
import { renderTracker }   from './views/tracker.js';
import { renderResume }    from './views/resume.js';
import { renderLinkedIn }  from './views/linkedin.js';
import { renderProfile }   from './views/profile.js';
import { renderOutreach }   from './views/outreach.js';
import { renderInterview }  from './views/interview.js';
import { renderAnalytics }  from './views/analytics.js';
import { renderAppWriter }  from './views/appWriter.js';
import { openSessionsModal } from './components/sessionsPanel.js';

// ── Global state ──────────────────────────────────────────────
export const state = {
  profile:      null,
  resume:       null,
  applications: [],
  hasApiKey:    false,
  currentView:  'dashboard',
  applyQueue:   [],       // {job, status:'queued'|'applied'|'skipped'}
  autoQueueThreshold: 0, // 0 = off; score value = auto-queue above this
};

// ── Toast system ─────────────────────────────────────────────
export function toast(msg, type = 'info', duration = 3500) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Modal ─────────────────────────────────────────────────────
export function openModal(title, sub, bodyHtml) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal">
      <button class="modal-close">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
      </button>
      <div class="modal-title">${title}</div>
      ${sub ? `<div class="modal-sub">${sub}</div>` : ''}
      ${bodyHtml}
    </div>`;
  bg.querySelector('.modal-close').onclick = () => bg.remove();
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  document.body.appendChild(bg);
  return bg;
}

// ── Score badge ───────────────────────────────────────────────
export function scoreBadge(score) {
  if (score === null || score === undefined) return '<span class="score-badge none">—</span>';
  const cls = score >= 4.5 ? 'exc' : score >= 3.5 ? 'good' : score >= 3.0 ? 'ok' : 'weak';
  return `<span class="score-badge ${cls}">${parseFloat(score).toFixed(1)}/5</span>`;
}

export function statusBadge(status = 'Evaluated') {
  const cls = {
    'Evaluated':    'evaluated',
    'Resume Ready': 'resume-ready',
    'Applied':      'applied',
    'Responded':    'responded',
    'Interview':    'interview',
    'Offer':        'offer',
    'Accepted':     'accepted',
    'Rejected':     'rejected',
    'Withdrawn':    'withdrawn',
    'Skipped':      'skipped',
  }[status] || 'evaluated';
  return `<span class="status s-${cls}">${status}</span>`;
}

// ── Router ────────────────────────────────────────────────────
const VIEWS = {
  dashboard: renderDashboard,
  search:    renderSearch,
  tracker:   renderTracker,
  resume:    renderResume,
  linkedin:  renderLinkedIn,
  profile:   renderProfile,
  outreach:   renderOutreach,
  interview:  renderInterview,
  analytics:  renderAnalytics,
  appWriter:  renderAppWriter,
};

const TITLES = {
  dashboard: 'Dashboard',
  search:    'Job Search',
  tracker:   'Applications',
  resume:    'Resume & CV',
  linkedin:  'LinkedIn Optimizer',
  profile:   'Profile & Settings',
  outreach:  'Outreach & Networking',
  interview: 'Interview Prep',
  analytics: 'Analytics',
  appWriter: 'Job Application Assistance',
};

export function navigate(view) {
  if (!VIEWS[view]) return;
  state.currentView = view;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  document.getElementById('page-title').textContent = TITLES[view] || view;
  const main = document.getElementById('main');
  main.innerHTML = '<div class="loading-row" style="padding:24px"><div class="spinner"></div> Loading…</div>';
  VIEWS[view](main, state);
}

// ── Session indicator ─────────────────────────────────────────
function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Saved just now';
  if (mins < 60) return `Saved ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `Saved ${hrs}h ago` : `Saved ${new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;
}

export function updateSessionIndicator(session) {
  const nameEl    = document.getElementById('session-name');
  const savedAtEl = document.getElementById('session-saved-at');
  if (!nameEl) return;
  if (session?.name) {
    nameEl.textContent    = session.name;
    savedAtEl.textContent = session.savedAt ? relTime(session.savedAt) : '';
  } else {
    nameEl.textContent    = 'Unsaved Session';
    savedAtEl.textContent = 'Not saved yet';
  }
}

// Auto-save every 5 minutes
let _autoSaveTimer = null;
function startAutoSave() {
  if (_autoSaveTimer) clearInterval(_autoSaveTimer);
  _autoSaveTimer = setInterval(async () => {
    try {
      const saved = await api.sessions.autosave();
      updateSessionIndicator(saved);
    } catch { /* silent */ }
  }, 5 * 60 * 1000);
}

// ── Shell init ────────────────────────────────────────────────
async function init() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.view));
  });

  document.getElementById('export-btn').addEventListener('click', () => api.export.csv());
  document.getElementById('quick-eval-btn').addEventListener('click', () => showEvalInput());

  // Sessions button — open sessions manager modal
  document.getElementById('sessions-btn').addEventListener('click', () => {
    openSessionsModal(() => {
      // Refresh state after modal closes (user may have loaded a session)
      api.sessions.active().then(s => updateSessionIndicator(s)).catch(() => {});
    });
  });

  // Quick save button — save current session with a name prompt
  document.getElementById('save-session-btn').addEventListener('click', async () => {
    const btn = document.getElementById('save-session-btn');
    const active = await api.sessions.active().catch(() => null);
    const defaultName = active?.name && active.name !== 'Unsaved Session'
      ? active.name
      : `Session ${new Date().toLocaleDateString()}`;
    const name = prompt('Save session as:', defaultName);
    if (name === null) return; // cancelled
    btn.disabled = true;
    try {
      const saved = await api.sessions.save(name.trim() || defaultName);
      updateSessionIndicator(saved);
      toast(`Session saved as "${saved.name}"`, 'success');
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Session indicator click → open sessions modal
  document.getElementById('session-indicator')?.addEventListener('click', () => {
    openSessionsModal(() => {
      api.sessions.active().then(s => updateSessionIndicator(s)).catch(() => {});
    });
  });

  try {
    [state.profile, state.applications] = await Promise.all([
      api.profile.get().catch(() => ({})),
      api.tracker.list().catch(() => []),
    ]);
    state.resume = await api.resume.get().catch(() => null);
    const cfg = await api.config.get().catch(() => ({}));
    state.hasApiKey = cfg.hasKey || false;
    state.aiProvider = cfg.provider || 'anthropic';
    state.noKeyNeeded = cfg.noKeyNeeded || false;
    state.aiPowerModel = cfg.aiPowerModel || '';
  } catch {}

  // Load active session info for sidebar indicator
  const activeSession = await api.sessions.active().catch(() => null);
  updateSessionIndicator(activeSession);
  startAutoSave();

  updateShellState();
  navigate('dashboard');
}

function updateShellState() {
  const dot    = document.getElementById('api-dot');
  const status = document.getElementById('api-status');
  const count  = document.getElementById('app-count');

  const aiReady = state.hasApiKey;
  dot.classList.toggle('ok', aiReady);
  if (aiReady) {
    // Show the EXACT connected model, trimmed of org prefixes for width
    // (e.g. "meta/llama-3.3-70b-instruct" → "llama-3.3-70b-instruct").
    const model = (state.aiPowerModel || '').split('/').pop();
    status.textContent = model || (state.noKeyNeeded ? 'Model enabled' : 'AI connected');
    status.title = `${state.aiProvider || ''} · ${state.aiPowerModel || ''}`;
  } else {
    status.textContent = 'API key not set';
    status.title = '';
  }
  count.textContent  = state.applications.length;
}

// ── Quick evaluate modal ──────────────────────────────────────
function showEvalInput() {
  const modal = openModal(
    'Evaluate a Job',
    'Paste a job URL or the full job description below.',
    `<div class="field"><textarea class="input" id="eval-jd-input" rows="8" placeholder="Paste job URL or full job description here…"></textarea></div>
     <div style="display:flex;gap:8px">
       <button class="btn btn-primary" id="do-eval-btn">
         <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 1L7.5 4.5 11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"/></svg>
         Evaluate
       </button>
       <button class="btn btn-ghost" onclick="this.closest('.modal-bg').remove()">Cancel</button>
     </div>
     <div id="eval-result" style="margin-top:16px"></div>`
  );

  modal.querySelector('#do-eval-btn').addEventListener('click', async () => {
    const input = modal.querySelector('#eval-jd-input').value.trim();
    if (!input) return;
    const btn = modal.querySelector('#do-eval-btn');
    const out  = modal.querySelector('#eval-result');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:1.5px"></div> Evaluating…';
    out.innerHTML = '';

    try {
      const job = input.startsWith('http')
        ? { url: input, title: 'Evaluating from URL…', company: '', description: '' }
        : { title: 'Pasted Job Description', company: 'Unknown', description: input };

      const result = await api.jobs.evaluate(job);
      out.innerHTML = renderEvalResult(result);

      await api.tracker.add({
        company:   result.job?.company || job.company || 'Unknown',
        role:      result.job?.title   || job.title   || 'Unknown',
        archetype: result.archetype,
        score:     result.score,
        status:    'Evaluated',
        url:       job.url || '',
        notes:     result.blockA?.oneLiner || '',
      });
      state.applications = await api.tracker.list();
      updateShellState();
    } catch (e) {
      out.innerHTML = `<div style="color:var(--rose);font-size:13px;margin-top:4px">${e.message}</div>`;
    }

    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 1L7.5 4.5 11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"/></svg> Evaluate`;
  });
}

export function openEvalModal(job) {
  const modal = openModal(
    `${job.company} — ${job.title}`,
    job.location || '',
    `<div class="loading-row"><div class="spinner"></div> Evaluating…</div><div id="eval-result"></div>`
  );

  api.jobs.evaluate(job).then(result => {
    const out = modal.querySelector('#eval-result');
    modal.querySelector('.loading-row')?.remove();
    if (out) {
      out.innerHTML = renderEvalResult(result);
      wireEvalTailoring(out, result.job || job);
    }

    api.tracker.add({
      company:   result.job?.company || job.company,
      role:      result.job?.title   || job.title,
      archetype: result.archetype,
      score:     result.score,
      status:    'Evaluated',
      url:       job.url || '',
      notes:     result.blockA?.oneLiner || '',
    }).then(() => {
      api.tracker.list().then(apps => { state.applications = apps; updateShellState(); });
    });
  }).catch(e => {
    modal.querySelector('.loading-row')?.remove();
    const out = modal.querySelector('#eval-result');
    if (out) out.innerHTML = `<div style="color:var(--rose);font-size:13px;padding:12px 0">
      <b>Evaluation failed:</b> ${esc(e.message)}<br>
      <span style="font-size:11.5px;color:var(--text3);margin-top:4px;display:block">Check that your AI provider is configured in Settings and try again.</span>
    </div>`;
  });
}

function renderEvalResult(r) {
  const scoreClass = r.score >= 4.5 ? 'exc' : r.score >= 3.5 ? 'good' : r.score >= 3.0 ? 'ok' : 'weak';
  const checkSvg   = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--green)"  stroke-width="2" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg>`;
  const warnSvg    = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round"><path d="M6 4v3M6 9v.5M1.5 10.5h9L6 1.5 1.5 10.5z"/></svg>`;
  const starSvg    = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--blue)"  stroke-width="1.5" stroke-linecap="round"><path d="M6 1L7.5 4.5 11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"/></svg>`;

  return `
    <div class="eval-block">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <span class="score-badge ${scoreClass}">${r.score?.toFixed(1)}/5</span>
        <strong style="color:var(--text)">${esc(r.job?.company)} — ${esc(r.job?.title)}</strong>
        <span class="chip chip-blue">${esc(r.archetype)}</span>
        <span class="chip chip-${r.verdict==='Apply'?'green':r.verdict==='Consider'?'amber':'red'}">${esc(r.verdict)}</span>
      </div>
      <p style="font-size:13px;color:var(--text2)">${esc(r.blockA?.oneLiner || '')}</p>
    </div>
    ${r.blockA?.strengths?.length ? `<div class="eval-block">
      <div class="eval-block-title">Strengths</div>
      ${r.blockA.strengths.map(s => `<div class="match-row">${checkSvg}<span>${esc(s)}</span></div>`).join('')}
    </div>` : ''}
    ${r.blockA?.gaps?.length ? `<div class="eval-block">
      <div class="eval-block-title">Gaps</div>
      ${r.blockA.gaps.map(g => `<div class="match-row">${warnSvg}<span>${esc(g)}</span></div>`).join('')}
    </div>` : ''}
    ${r.blockB?.requirements?.length ? `<div class="eval-block">
      <div class="eval-block-title">Requirements Match</div>
      ${r.blockB.requirements.map(req => {
        const c = req.match === 'strong' ? 'var(--green)' : req.match === 'partial' ? 'var(--amber)' : 'var(--rose)';
        return `<div class="match-row" style="align-items:flex-start"><span style="color:${c};font-size:10px;min-width:52px;margin-top:1px;font-weight:600">${esc(req.match?.toUpperCase())}</span><span><b>${esc(req.req)}</b>${req.note ? ` — <span style="color:var(--text3)">${esc(req.note)}</span>` : ''}</span></div>`;
      }).join('')}
    </div>` : ''}
    ${(r.blockD?.salaryAssessment || r.blockD?.marketRange) ? `<div class="eval-block">
      <div class="eval-block-title">Compensation</div>
      ${r.blockD.salaryAssessment ? `<div class="match-row">${starSvg}<span>${esc(r.blockD.salaryAssessment)}</span></div>` : ''}
      ${r.blockD.marketRange ? `<div class="match-row">${starSvg}<span>Market range: ${esc(r.blockD.marketRange)}</span></div>` : ''}
      ${r.blockD.flag ? `<div class="match-row">${warnSvg}<span>${esc(r.blockD.flag)}</span></div>` : ''}
    </div>` : ''}
    ${r.blockE?.keywordsToAdd?.length ? `<div class="eval-block">
      <div class="eval-block-title">Resume Keywords to Add</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${r.blockE.keywordsToAdd.map(k => `<span class="chip chip-blue" style="font-size:10px">${esc(k)}</span>`).join('')}</div>
      ${r.blockE.summaryChanges ? `<div style="font-size:12px;color:var(--text3);margin-top:6px">${esc(r.blockE.summaryChanges)}</div>` : ''}
    </div>` : ''}
    ${r.blockF?.questions?.length ? `<div class="eval-block">
      <div class="eval-block-title">Likely Interview Questions</div>
      ${r.blockF.questions.map(q => `<div class="match-row">${starSvg}<span>${esc(q)}</span></div>`).join('')}
      ${r.blockF.companyInsights ? `<div style="font-size:12px;color:var(--text3);margin-top:6px;padding:6px 8px;background:var(--bg3);border-radius:var(--r-sm)">${esc(r.blockF.companyInsights)}</div>` : ''}
      ${r.blockF.askTheInterviewer?.length ? `<div style="font-size:11px;font-weight:600;color:var(--text3);margin-top:8px;margin-bottom:4px">Ask the Interviewer</div>${r.blockF.askTheInterviewer.map(q => `<div class="match-row" style="opacity:.8">${starSvg}<span style="color:var(--teal)">${esc(q)}</span></div>`).join('')}` : ''}
    </div>` : ''}
    <div class="eval-block" style="border:1px solid rgba(10,132,255,.25);background:rgba(10,132,255,.05)">
      <div class="eval-block-title">Tailor Resume to This Role</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Rewrites your resume specifically for this job, ATS-scores the result, and can save it as a per-role version.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="eval-tailor-btn">Tailor Resume (ATS-Optimized)</button>
      </div>
      <div id="eval-tailor-out" style="margin-top:12px"></div>
    </div>`;
}

// Wire the in-modal Tailor Resume / Generate CV actions so users can tailor per role
// without leaving the evaluation. Saves results as named resume versions.
function wireEvalTailoring(container, job) {
  const out = container.querySelector('#eval-tailor-out');
  const tailorBtn = container.querySelector('#eval-tailor-btn');

  const run = async () => {
    const orig = tailorBtn.textContent;
    tailorBtn.disabled = true;
    tailorBtn.innerHTML = '<div class="spinner"></div>';
    out.innerHTML = `<div class="loading-row"><div class="spinner"></div> Tailoring resume for ${esc(job.title || 'this role')}…</div>`;
    try {
      const r = await api.jobs.tailor({ title: job.title, company: job.company, description: job.description || '' });
      out.innerHTML = renderInlineTailored(r, 'tailor', job);
      out.querySelector('#eval-save-version')?.addEventListener('click', async () => {
        try {
          await api.resumeVersions.add({
            name: `Resume — ${job.company || ''} ${job.title || ''}`.trim(),
            role: job.title || '', company: job.company || '',
            content: r, kind: 'tailor',
          });
          toast('Saved as a per-role version (Resume & CV → Versions)', 'success');
        } catch (e) { toast('Save failed: ' + e.message, 'error'); }
      });
      // Per-job ATS score of the TAILORED version — every application-ready
      // resume carries its own score before submission.
      const slot = out.querySelector('#eval-ats-slot');
      if (slot) {
        slot.innerHTML = `<div class="loading-row" style="font-size:11px"><div class="spinner"></div> ATS-scoring…</div>`;
        api.resume.atsCheck(r).then(ats => {
          const c = (ats.score ?? 0) >= 80 ? '#34d399' : (ats.score ?? 0) >= 60 ? 'var(--blue)' : 'var(--amber)';
          slot.innerHTML = `<span style="font-size:13px;font-weight:800;color:${c}">ATS ${ats.score ?? '—'}/100 ${esc(ats.grade || '')}</span>`;
        }).catch(() => { slot.innerHTML = ''; });
      }
    } catch (e) {
      out.innerHTML = `<div style="color:var(--rose);font-size:12.5px">Failed: ${esc(e.message)}<br><span style="color:var(--text3)">Check that your AI provider is configured in Settings.</span></div>`;
    } finally {
      tailorBtn.disabled = false;
      tailorBtn.textContent = orig;
    }
  };

  tailorBtn?.addEventListener('click', run);
}

// Compact tailored-resume renderer for the eval modal (self-contained; strips AI placeholder tokens).
function renderInlineTailored(r, kind, job) {
  const clean = s => { const t = String(s == null ? '' : s).trim(); return /^<[^<>]{1,25}>$/.test(t) ? '' : t; };
  const list = a => (Array.isArray(a) ? a : []).map(x => clean(typeof x === 'string' ? x : (x?.text || x?.value || ''))).filter(Boolean);
  const dt = d => !d ? '' : (typeof d === 'string' ? d : [d.startDate||d.start, d.endDate||d.end].filter(Boolean).join(' – '));
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <strong style="font-size:12px;color:var(--text)">Tailored Resume · ${esc(job.title || '')}</strong>
      <span id="eval-ats-slot"></span>
      <button class="btn btn-secondary btn-sm" id="eval-save-version">Save as Version for This Role</button>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px;font-family:Georgia,serif;font-size:12px;max-height:340px;overflow:auto">
      ${clean(r.name) ? `<div style="font-weight:700;text-align:center">${esc(clean(r.name))}</div>` : ''}
      ${clean(r.contact) ? `<div style="text-align:center;color:var(--text3);font-size:11px;margin-bottom:8px">${esc(clean(r.contact))}</div>` : ''}
      ${clean(r.summary) ? `<div style="font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.6px;margin:8px 0 4px">Summary</div><div>${esc(clean(r.summary))}</div>` : ''}
      ${list(r.skills).length ? `<div style="font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.6px;margin:8px 0 4px">Skills</div><div>${list(r.skills).map(esc).join(' · ')}</div>` : ''}
      ${(r.experience || []).length ? `<div style="font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.6px;margin:8px 0 4px">Experience</div>
        ${r.experience.map(e => `<div style="margin-bottom:8px"><div style="font-weight:700">${esc(clean(e.title))} <span style="color:var(--text3);font-weight:400">${esc(clean(e.company))}${dt(e.dates) ? ' · ' + esc(dt(e.dates)) : ''}</span></div>
          <ul style="margin:2px 0;padding-left:16px">${list(e.bullets).map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`).join('')}` : ''}
    </div>
    ${clean(r.changesSummary) ? `<div style="font-size:11.5px;color:var(--text3);margin-top:8px">${esc(clean(r.changesSummary))}</div>` : ''}`;
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Apply Queue ───────────────────────────────────────────────
export function addToQueue(jobs) {
  let added = 0;
  for (const job of jobs) {
    const already = state.applyQueue.find(q => q.job.id === job.id);
    if (!already) { state.applyQueue.push({ job, status: 'queued' }); added++; }
  }
  if (added) {
    updateQueueBadge();
    toast(`${added} job${added !== 1 ? 's' : ''} added to Apply Queue`, 'success');
    // Add to tracker with Queued status
    for (const job of jobs) {
      api.tracker.add({ company: job.company, role: job.title, score: job.score, status: 'Queued', url: job.url || '', notes: 'In apply queue' })
        .catch(() => {});
    }
    state.applications = state.applications.concat(
      jobs.map(j => ({ company: j.company, role: j.title, score: j.score, status: 'Queued', url: j.url }))
    );
    updateShellState();
  }
}

export function removeFromQueue(jobId) {
  state.applyQueue = state.applyQueue.filter(q => q.job.id !== jobId);
  updateQueueBadge();
}

function updateQueueBadge() {
  const pending = state.applyQueue.filter(q => q.status === 'queued').length;
  const badge = document.getElementById('queue-badge');
  if (badge) {
    badge.textContent = pending;
    badge.style.display = pending > 0 ? 'inline-flex' : 'none';
  }
}

export function openBatchApplyModal() {
  const queued = state.applyQueue.filter(q => q.status === 'queued');
  if (!queued.length) { toast('No jobs in queue', 'info'); return; }

  let idx = 0;
  let currentPacket = null;
  let modalEl = null;

  function buildModal() {
    const total   = queued.length;
    const item    = queued[idx];
    const job     = item?.job;
    const applied = state.applyQueue.filter(q => q.status === 'applied').length;

    const progressPct = total > 0 ? Math.round((idx / total) * 100) : 0;

    modalEl = openModal(
      'Apply Queue',
      `${applied} applied · ${total - idx} remaining`,
      `<div class="queue-modal-wrap">
        <div class="queue-progress-bar"><div class="queue-progress-fill" style="width:${progressPct}%"></div></div>
        <div class="queue-job-info">
          <span class="queue-job-counter">${idx + 1} / ${total}</span>
          <span class="queue-job-title">${esc(job?.title)} <span class="queue-job-co">at ${esc(job?.company)}</span></span>
          ${job?.location ? `<span class="queue-job-loc">${esc(job.location)}</span>` : ''}
        </div>

        <div id="queue-packet-area">
          <div class="loading-row" style="padding:20px 0">
            <div class="spinner"></div> Generating application packet…
          </div>
        </div>

        <div class="queue-actions">
          ${job?.url ? `<a href="${esc(job.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" id="q-open-btn">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 2H2.5A1.5 1.5 0 001 3.5v5A1.5 1.5 0 002.5 10h5A1.5 1.5 0 009 8.5V7M6 1h4v4M9 2 5.5 5.5"/></svg>
            Open Job URL
          </a>` : ''}
          <button class="btn btn-primary btn-sm" id="q-applied-btn">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1.5 5.5l3 3 5-5"/></svg>
            Mark Applied → Next
          </button>
          <button class="btn btn-ghost btn-sm" id="q-skip-btn">Skip →</button>
        </div>
      </div>`
    );

    // Generate packet
    api.jobs.applicationPacket(job).then(packet => {
      currentPacket = packet;
      const area = modalEl?.querySelector('#queue-packet-area');
      if (!area) return;
      area.innerHTML = renderPacket(packet, job);
      // Wire copy buttons
      area.querySelectorAll('.copy-field-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const text = btn.dataset.text;
          navigator.clipboard.writeText(text).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
          });
        });
      });
    }).catch(() => {
      const area = modalEl?.querySelector('#queue-packet-area');
      if (area) area.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:12px 0">Could not generate packet — check your API key. You can still open the job URL manually.</div>`;
    });

    // Wire buttons
    modalEl.querySelector('#q-applied-btn')?.addEventListener('click', async () => {
      item.status = 'applied';
      // Update tracker status
      const app = state.applications.find(a => a.company === job.company && a.role === job.title);
      if (app?.id) await api.tracker.update(app.id, { status: 'Applied', dateApplied: new Date().toISOString().slice(0,10) }).catch(() => {});
      advance();
    });

    modalEl.querySelector('#q-skip-btn')?.addEventListener('click', () => {
      item.status = 'skipped';
      advance();
    });
  }

  function advance() {
    idx++;
    if (idx >= queued.length) {
      const applied = state.applyQueue.filter(q => q.status === 'applied').length;
      const existingBg = document.querySelector('.modal-bg');
      if (existingBg) existingBg.remove();
      updateQueueBadge();
      toast(`Queue complete — ${applied} applied, ${queued.length - applied} skipped`, 'success');
      return;
    }
    const bg = document.querySelector('.modal-bg');
    if (bg) bg.remove();
    buildModal();
  }

  buildModal();
}

function renderPacket(packet, job) {
  function copyBtn(text) {
    const safe = String(text).replace(/"/g, '&quot;');
    return `<button class="copy-field-btn btn btn-ghost btn-sm" data-text="${safe}" style="flex-shrink:0;font-size:10px;padding:2px 8px">Copy</button>`;
  }
  function field(label, text) {
    return `<div class="packet-field">
      <div class="packet-field-label">${label}</div>
      <div class="packet-field-row">
        <div class="packet-field-text">${esc(text)}</div>
        ${copyBtn(text)}
      </div>
    </div>`;
  }

  const answerFields = (packet.answers || []).map(a =>
    field(a.question, a.answer)
  ).join('');

  const keywords = (packet.keyKeywords || []).map(k =>
    `<span class="chip chip-indigo" style="font-size:10px">${esc(k)}</span>`
  ).join('');

  return `
    <div class="packet-wrap">
      ${field('Opening Pitch', packet.openingPitch)}
      ${field('Cover Letter', packet.coverLetter)}
      ${answerFields}
      ${keywords ? `<div class="packet-field">
        <div class="packet-field-label">ATS Keywords to Include</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${keywords}</div>
      </div>` : ''}
    </div>`;
}

window.alexNavigate = navigate;
window.alexState    = state;
window.openBatchApply = openBatchApplyModal;

init();
