import { api } from '../api.js';
import { renderJobCard } from '../components/jobCard.js';
import { toast, openEvalModal, addToQueue, openBatchApplyModal, state } from '../app.js';

let stopStream   = null;
let likedJobs    = [];
let selectMode   = false;
let selectedJobs = new Set(); // job IDs

export async function renderSearch(el) {
  el.innerHTML = `
  <div class="page-hdr">
    <h1>Job Search</h1>
    <p>Live search across 14 sources — LinkedIn, Indeed, Google for Jobs, Glassdoor &amp; ZipRecruiter via your connected account, direct company career pages via Greenhouse, Lever, and Ashby, plus Wellfound, Y Combinator, startup.jobs, Welcome to the Jungle, Cord, Built In, and Remotive. 70 metro regions searchable.</p>
  </div>

  <div class="search-shell">
    <div class="filter-panel">
      <div class="filter-title">Search Filters</div>

      <div class="filter-group" style="position:relative">
        <label class="filter-group-label">Keywords / Role</label>
        <div class="tag-input-wrap" id="keywords-wrap" style="min-height:38px;cursor:text">
          <input class="tag-real-input" id="f-keywords" placeholder="Type any role or keywords — Enter to add" autocomplete="off" style="font-size:13px;min-width:180px">
        </div>
        <div id="keywords-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:3px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-md);z-index:200;max-height:220px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.25)"></div>
      </div>

      <div class="filter-group" style="position:relative">
        <label class="filter-group-label">Location</label>
        <div class="tag-input-wrap" id="locations-wrap" style="min-height:38px;cursor:text">
          <input class="tag-real-input" id="f-location" placeholder="Add city/state, press Enter" autocomplete="off" style="font-size:13px;min-width:130px">
        </div>
        <div id="locations-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:3px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-md);z-index:200;max-height:220px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.25)"></div>
      </div>

      <div class="filter-group" style="position:relative">
        <label class="filter-group-label">Target Companies <span style="font-size:9px;font-weight:400;color:var(--teal)">resolves ANY company's career site</span></label>
        <div class="tag-input-wrap" id="target-companies-wrap">
          <input class="tag-real-input" id="target-companies-input" placeholder="Type any company — probes its real careers page" autocomplete="off">
        </div>
        <div id="target-companies-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:3px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-md);z-index:200;max-height:220px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.25)"></div>
      </div>

      <div class="filter-group" style="position:relative">
        <label class="filter-group-label">Exclude Companies</label>
        <div class="tag-input-wrap" id="exclude-companies-wrap">
          <input class="tag-real-input" id="exclude-companies-input" placeholder="e.g. current employer" autocomplete="off">
        </div>
        <div id="exclude-companies-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:3px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-md);z-index:200;max-height:220px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.25)"></div>
      </div>

      <div class="filter-sep"></div>

      <div class="filter-group">
        <label class="filter-group-label">Date Posted</label>
        <select class="input" id="f-date" style="font-size:12.5px">
          <option value="">Any time</option>
          <option value="1">Last 24 hours</option>
          <option value="3">Last 3 days</option>
          <option value="7" selected>Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      <div class="filter-group">
        <label class="filter-group-label">Work Arrangement</label>
        <div class="check-list">
          <label class="check-item"><input type="checkbox" value="remote" name="remote" checked> Remote</label>
          <label class="check-item"><input type="checkbox" value="hybrid" name="remote" checked> Hybrid</label>
          <label class="check-item"><input type="checkbox" value="onsite" name="remote" checked> On-site</label>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-group-label">Job Type</label>
        <div class="check-list">
          <label class="check-item"><input type="checkbox" value="fulltime"   name="jtype" checked> Full-time</label>
          <label class="check-item"><input type="checkbox" value="contract"   name="jtype"> Contract</label>
          <label class="check-item"><input type="checkbox" value="parttime"   name="jtype"> Part-time</label>
          <label class="check-item"><input type="checkbox" value="internship" name="jtype"> Internship</label>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-group-label">Career Level</label>
        <div class="check-list">
          <label class="check-item"><input type="checkbox" value="entry"     name="level"> Entry Level</label>
          <label class="check-item"><input type="checkbox" value="mid"       name="level" checked> Mid-Level</label>
          <label class="check-item"><input type="checkbox" value="senior"    name="level" checked> Senior</label>
          <label class="check-item"><input type="checkbox" value="lead"      name="level"> Lead / Staff</label>
          <label class="check-item"><input type="checkbox" value="manager"   name="level"> Manager</label>
          <label class="check-item"><input type="checkbox" value="director"  name="level"> Director</label>
          <label class="check-item"><input type="checkbox" value="vp"        name="level"> VP / SVP</label>
          <label class="check-item"><input type="checkbox" value="executive" name="level"> Executive / C-Suite</label>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-group-label">Min Salary (Annual USD)</label>
        <select class="input" id="f-minsalary" style="font-size:12.5px">
          <option value="">No minimum</option>
          <option value="40000">$40,000+</option>
          <option value="60000">$60,000+</option>
          <option value="80000">$80,000+</option>
          <option value="100000">$100,000+</option>
          <option value="120000">$120,000+</option>
          <option value="150000">$150,000+</option>
          <option value="180000">$180,000+</option>
          <option value="200000">$200,000+</option>
          <option value="250000">$250,000+</option>
        </select>
      </div>

      <div class="filter-group">
        <label class="filter-group-label">Company Size</label>
        <div class="check-list">
          <label class="check-item"><input type="checkbox" value="startup"    name="csize"> Startup / SMB (&lt;200)</label>
          <label class="check-item"><input type="checkbox" value="mid"        name="csize"> Mid-size (200–1k)</label>
          <label class="check-item"><input type="checkbox" value="large"      name="csize"> Large (1k–10k)</label>
          <label class="check-item"><input type="checkbox" value="enterprise" name="csize"> Enterprise (10k+)</label>
        </div>
        <div style="font-size:9.5px;color:var(--text4);margin-top:3px">Known employers only; unclassified jobs always shown.</div>
      </div>

      <div class="filter-group">
        <label class="filter-group-label">Primary Industry</label>
        <div class="check-list" style="max-height:170px;overflow-y:auto">
          ${['Technology/Engineering','Finance/Accounting','Healthcare/Medical','Legal/Compliance','Creative/Marketing','Operations/Supply Chain','Sales/Business Dev','People/HR','Government/Nonprofit','Scientific/R&D']
            .map(i => `<label class="check-item"><input type="checkbox" value="${i}" name="industry"> ${i}</label>`).join('')}
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-group-label" style="display:flex;justify-content:space-between;align-items:center">
          Boards
          <span style="display:flex;gap:6px">
            <button type="button" id="boards-all-btn"  style="font-size:10px;color:var(--blue);background:none;border:none;cursor:pointer;padding:0">All</button>
            <button type="button" id="boards-none-btn" style="font-size:10px;color:var(--text3);background:none;border:none;cursor:pointer;padding:0">None</button>
          </span>
        </label>
        <div class="check-list-boards">
          <div class="boards-cat">Major Aggregators</div>
          <label class="check-item"><input type="checkbox" value="linkedin"       name="board" checked> LinkedIn</label>
          <label class="check-item"><input type="checkbox" value="indeed"         name="board" checked> Indeed</label>
          <label class="check-item" id="board-google-label" title="Google Jobs indexes essentially every company career page on the internet. Google requires a one-time human verification — connect Google in Profile &amp; Settings → Platform Accounts to enable."><input type="checkbox" value="google" name="board" disabled> Google for Jobs <span id="board-google-state" style="font-size:9px;color:var(--text4)">connect account</span></label>
          <label class="check-item" id="board-glassdoor-label" title="Searches Glassdoor through YOUR logged-in account session. Connect Glassdoor in Profile &amp; Settings → Platform Accounts to enable."><input type="checkbox" value="glassdoor" name="board" disabled> Glassdoor <span id="board-glassdoor-state" style="font-size:9px;color:var(--text4)">connect account</span></label>
          <label class="check-item" id="board-zip-label" title="Searches ZipRecruiter through YOUR logged-in account session. Connect ZipRecruiter in Profile &amp; Settings → Platform Accounts to enable."><input type="checkbox" value="zip_recruiter" name="board" disabled> ZipRecruiter <span id="board-zip-state" style="font-size:9px;color:var(--text4)">connect account</span></label>

          <div class="boards-cat">Company Career Pages (Direct)</div>
          <label class="check-item" title="Searches company career websites directly — Amazon.jobs plus Workday-hosted careers for NVIDIA, Adobe, Salesforce, Capital One, Wells Fargo, CVS Health, Humana, and Target. No aggregator in between."><input type="checkbox" value="companysites" name="board" checked> Major Employers <span style="font-size:9px;color:var(--teal)">direct</span></label>
          <label class="check-item"><input type="checkbox" value="greenhouse" name="board" checked> Greenhouse</label>
          <label class="check-item"><input type="checkbox" value="lever"      name="board" checked> Lever</label>
          <label class="check-item"><input type="checkbox" value="ashby"      name="board" checked> Ashby</label>

          <div class="boards-cat">Startup &amp; Tech</div>
          <label class="check-item"><input type="checkbox" value="wellfound"     name="board" checked> Wellfound</label>
          <label class="check-item"><input type="checkbox" value="yc"            name="board" checked> Y Combinator</label>
          <label class="check-item"><input type="checkbox" value="startupjobs"   name="board" checked> startup.jobs</label>
          <label class="check-item"><input type="checkbox" value="welcomejungle" name="board" checked> Welcome to the Jungle</label>
          <label class="check-item"><input type="checkbox" value="cord"          name="board" checked> Cord</label>
          <label class="check-item"><input type="checkbox" value="builtin"       name="board" checked> Built In</label>

          <div class="boards-cat">Open Web</div>
          <label class="check-item" title="Broad-web coverage: The Muse (400k+ postings across thousands of companies), Arbeitnow, RemoteOK, Himalayas, and Jobicy — jobs sourced from across the internet, not one curated list."><input type="checkbox" value="openweb" name="board" checked> Open-Web Aggregators <span style="font-size:9px;color:var(--teal)">400k+ index</span></label>

          <div class="boards-cat">Remote-Only</div>
          <label class="check-item"><input type="checkbox" value="remotive"      name="board" checked> Remotive</label>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-top:6px;line-height:1.45">
          Every enabled board returns real results.
          <br><strong style="color:var(--text2)">Glassdoor &amp; ZipRecruiter</strong> block anonymous automated search (anti-bot walls), so they search through <strong>your own logged-in session</strong> — connect them once in Profile &amp; Settings → Platform Accounts and the checkboxes unlock automatically.
          Dead-feed boards (Remote.co, Just Remote, 4 Day Week, Remote Rocketship, JobAlert, HR Jobs Remote, 80,000 Hours, Idealist, Dataaxy) were removed rather than shown returning nothing.
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-group-label" style="display:flex;justify-content:space-between">
          Min Match Score <span id="score-val" style="color:var(--text)">3.0</span>
        </label>
        <input type="range" id="f-score" min="1" max="5" step="0.5" value="3">
      </div>

      <div class="filter-sep"></div>

      <div class="filter-group">
        <label class="filter-group-label">Auto-Queue Threshold</label>
        <select class="input" id="f-autoque" style="font-size:12.5px">
          <option value="0">Off — manual selection only</option>
          <option value="3.5">≥ 3.5 — Good match</option>
          <option value="4.0">≥ 4.0 — Strong match</option>
          <option value="4.5">≥ 4.5 — Excellent match only</option>
        </select>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;line-height:1.4">
          Jobs scoring at or above this threshold are automatically added to your Apply Queue.
        </div>
      </div>

      <div class="filter-sep"></div>

      <button class="btn btn-primary" id="search-btn" style="width:100%">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M10 10l2.5 2.5"/></svg>
        Search Jobs
      </button>
      <button class="btn btn-ghost btn-sm" id="stop-btn" style="width:100%;margin-top:6px;display:none">Stop</button>

    </div>

    <div class="results-area">
      <div id="search-status" style="color:var(--text3);font-size:13px;min-height:20px;margin-bottom:10px"></div>
      <div class="results-header" id="results-header" style="display:none">
        <span class="results-count" id="results-count"></span>
        <div style="display:flex;align-items:center;gap:8px">
          <select class="sort-select" id="sort-select">
            <option value="score">Highest Score</option>
            <option value="date">Most Recent</option>
            <option value="company">Company A–Z</option>
          </select>
          <button class="btn btn-ghost btn-sm" id="select-mode-btn" style="font-size:11px;white-space:nowrap">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="1.5" width="8" height="8" rx="1.5"/><path d="M3.5 5.5l1.5 1.5 2.5-3"/></svg>
            Select
          </button>
          <button class="btn btn-ghost btn-sm" id="process-queue-btn" style="font-size:11px;white-space:nowrap;display:none">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1.5 5.5l3 3 5-5"/></svg>
            Process Queue (<span id="queue-count-hdr">0</span>)
          </button>
        </div>
      </div>
      <div class="select-bar" id="select-bar" style="display:none">
        <span id="select-bar-label">0 selected</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" id="select-all-btn" style="font-size:11px">Select All</button>
          <button class="btn btn-ghost btn-sm" id="select-score-btn" style="font-size:11px">Select ≥ 4.0</button>
          <button class="btn btn-ghost btn-sm" id="select-none-btn" style="font-size:11px">None</button>
          <button class="btn btn-primary btn-sm" id="queue-selected-btn" style="font-size:11px" disabled>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>
            Queue Selected
          </button>
        </div>
      </div>
      <div class="jobs-grid" id="jobs-grid"></div>

      <div id="recs-section" style="display:none;margin-top:28px">
        <div class="section-hdr">
          <span class="section-title">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1L8 4.5l4 .5-3 2.5 1 4L6.5 10 3 11.5l1-4L1 5l4-.5z"/></svg>
            Top Recommendations
          </span>
          <div class="section-rule"></div>
          <span style="font-size:11.5px;color:var(--text3)">Based on your profile + interactions</span>
        </div>
        <div class="recs-grid" id="recs-grid"></div>
      </div>
    </div>
  </div>`;

  const grid        = el.querySelector('#jobs-grid');
  const status      = el.querySelector('#search-status');
  const btn         = el.querySelector('#search-btn');
  const stopBtn     = el.querySelector('#stop-btn');
  const resHdr      = el.querySelector('#results-header');
  const resCount    = el.querySelector('#results-count');
  const scoreSlider = el.querySelector('#f-score');
  const scoreVal    = el.querySelector('#score-val');
  const selectBar   = el.querySelector('#select-bar');
  const selectBarLbl = el.querySelector('#select-bar-label');
  const selectModeBtn = el.querySelector('#select-mode-btn');
  const processQueueBtn = el.querySelector('#process-queue-btn');
  const queueCountHdr   = el.querySelector('#queue-count-hdr');

  let allJobs = [];

  // ── Unlock session-backed boards (Glassdoor/ZipRecruiter) when connected ──
  (async () => {
    try {
      const r = await api.platforms.status();
      const connected = new Set((r.platforms || []).filter(p => p.connected).map(p => p.platform));
      const wire = (platform, value, labelId, stateId) => {
        const cb = el.querySelector(`input[name=board][value="${value}"]`);
        const state = el.querySelector(`#${stateId}`);
        if (!cb) return;
        if (connected.has(platform)) {
          cb.disabled = false; cb.checked = true;
          if (state) { state.textContent = 'via your account'; state.style.color = '#34d399'; }
        }
      };
      wire('glassdoor', 'glassdoor', 'board-glassdoor-label', 'board-glassdoor-state');
      wire('ziprecruiter', 'zip_recruiter', 'board-zip-label', 'board-zip-state');
      wire('google', 'google', 'board-google-label', 'board-google-state');
    } catch { /* platform status optional */ }
  })();

  // ── Prefill Min Salary + location from the user's saved profile ──
  (async () => {
    try {
      const profile = await api.profile.get();
      const salSel = el.querySelector('#f-minsalary');
      if (salSel && profile?.salaryMin && !salSel.value) {
        // Snap the profile's salaryMin down to the nearest available dropdown tier
        const tiers = [...salSel.options].map(o => parseInt(o.value) || 0).filter(Boolean).sort((a, b) => a - b);
        const match = [...tiers].reverse().find(t => t <= profile.salaryMin);
        if (match) salSel.value = String(match);
      }
      // If the user hasn't typed a location and set a non-remote preference, leave blank (they may want broad results)
    } catch { /* profile is optional */ }
  })();

  // ── Select mode helpers ───────────────────────────────────
  function toggleSelectMode(on) {
    selectMode = on ?? !selectMode;
    if (!selectMode) selectedJobs.clear();
    selectModeBtn.style.background = selectMode ? 'rgba(10,132,255,.15)' : '';
    selectModeBtn.style.color      = selectMode ? 'var(--blue)' : '';
    selectBar.style.display = selectMode ? 'flex' : 'none';
    sortAndRender(el.querySelector('#sort-select').value);
    updateSelectBar();
  }

  function updateSelectBar() {
    const n = selectedJobs.size;
    if (selectBarLbl) selectBarLbl.textContent = `${n} selected`;
    const qBtn = el.querySelector('#queue-selected-btn');
    if (qBtn) qBtn.disabled = n === 0;
    // Update queue count in header
    const qPending = state.applyQueue.filter(q => q.status === 'queued').length;
    if (queueCountHdr) queueCountHdr.textContent = qPending;
    if (processQueueBtn) processQueueBtn.style.display = qPending > 0 ? '' : 'none';
  }

  el.querySelector('#select-mode-btn')?.addEventListener('click', () => toggleSelectMode());
  el.querySelector('#process-queue-btn')?.addEventListener('click', () => openBatchApplyModal());

  el.querySelector('#select-all-btn')?.addEventListener('click', () => {
    allJobs.forEach(j => selectedJobs.add(j.id));
    sortAndRender(el.querySelector('#sort-select').value);
    updateSelectBar();
  });

  el.querySelector('#select-none-btn')?.addEventListener('click', () => {
    selectedJobs.clear();
    sortAndRender(el.querySelector('#sort-select').value);
    updateSelectBar();
  });

  el.querySelector('#select-score-btn')?.addEventListener('click', () => {
    allJobs.filter(j => (j.score || 0) >= 4.0).forEach(j => selectedJobs.add(j.id));
    sortAndRender(el.querySelector('#sort-select').value);
    updateSelectBar();
  });

  el.querySelector('#queue-selected-btn')?.addEventListener('click', () => {
    const jobs = allJobs.filter(j => selectedJobs.has(j.id));
    addToQueue(jobs);
    selectedJobs.clear();
    sortAndRender(el.querySelector('#sort-select').value);
    updateSelectBar();
  });

  scoreSlider.addEventListener('input', () => { scoreVal.textContent = scoreSlider.value; });

  el.querySelector('#boards-all-btn')?.addEventListener('click', () => {
    el.querySelectorAll('[name=board]').forEach(cb => cb.checked = true);
  });
  el.querySelector('#boards-none-btn')?.addEventListener('click', () => {
    el.querySelectorAll('[name=board]').forEach(cb => cb.checked = false);
  });

  setupAutocompleteTagInput(el, 'target-companies-wrap',  'target-companies-input',  'target-companies-dropdown',  COMPANY_SUGGESTIONS);
  setupAutocompleteTagInput(el, 'exclude-companies-wrap', 'exclude-companies-input', 'exclude-companies-dropdown', COMPANY_SUGGESTIONS);
  setupAutocompleteTagInput(el, 'keywords-wrap', 'f-keywords', 'keywords-dropdown', KEYWORD_SUGGESTIONS);
  setupAutocompleteTagInput(el, 'locations-wrap', 'f-location', 'locations-dropdown', LOCATION_SUGGESTIONS);

  el.querySelector('#sort-select').addEventListener('change', e => sortAndRender(e.target.value));

  btn.addEventListener('click', runSearch);
  stopBtn.addEventListener('click', () => { stopStream?.(); resetSearchUI('Stopped.'); });

  function resetSearchUI(msg = '') {
    btn.disabled = false; btn.style.display = ''; stopBtn.style.display = 'none';
    status.textContent = msg;
  }

  async function runSearch() {
    if (stopStream) { stopStream(); stopStream = null; }
    allJobs = []; grid.innerHTML = ''; resHdr.style.display = 'none';

    const params = {
      keywords:         getKeywordString(el),
      location:         getLocationString(el),
      daysAgo:          parseInt(el.querySelector('#f-date').value) || 7,
      remote:           [...el.querySelectorAll('[name=remote]:checked')].map(c => c.value),
      jobTypes:         [...el.querySelectorAll('[name=jtype]:checked')].map(c => c.value),
      boards:           [...el.querySelectorAll('[name=board]:checked')].map(c => c.value),
      minScore:         parseFloat(scoreSlider.value) || 3.0,
      targetCompanies:  getTagValues(el.querySelector('#target-companies-wrap')),
      excludeCompanies: getTagValues(el.querySelector('#exclude-companies-wrap')),
      careerLevels:     [...el.querySelectorAll('[name=level]:checked')].map(c => c.value),
      minSalary:        parseInt(el.querySelector('#f-minsalary').value) || null,
      companySizes:     [...el.querySelectorAll('[name=csize]:checked')].map(c => c.value),
      industries:       [...el.querySelectorAll('[name=industry]:checked')].map(c => c.value),
    };

    if (!params.keywords) { toast('Add at least one keyword or role title to search.', 'error'); return; }

    btn.disabled = true; btn.style.display = 'none'; stopBtn.style.display = '';
    status.innerHTML = `<div class="loading-row"><div class="spinner"></div> Searching across boards…</div>`;

    try {
      const autoQueThreshold = parseFloat(el.querySelector('#f-autoque').value) || 0;
      state.autoQueueThreshold = autoQueThreshold;

      const searchId = await api.jobs.search(params);
      let renderQueued = false;
      const scheduleRender = () => {   // coalesce bursts into one paint
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => { renderQueued = false; renderJobsGrid(); });
      };
      stopStream = api.jobs.stream(searchId, {
        onJob(job) {
          if (!allJobs.find(j => j.id === job.id)) {
            allJobs.push(job);
            // Auto-queue if score meets threshold
            if (autoQueThreshold > 0 && (job.score || 0) >= autoQueThreshold) {
              addToQueue([job]);
              updateSelectBar();
            }
          }
          scheduleRender();
        },
        // Background AI-score enrichment patches already-rendered cards
        onUpdate(upd) {
          const j = allJobs.find(x => x.id === upd.id);
          if (j) {
            j.score = upd.score; j.verdict = upd.verdict;
            j.archetype = upd.archetype; j.scoreReason = upd.scoreReason;
            if (autoQueThreshold > 0 && (j.score || 0) >= autoQueThreshold) {
              addToQueue([j]); updateSelectBar();
            }
          }
          scheduleRender();
        },
        onStatus(s) {
          if (s.phase === 'scoring') {
            // Phase 1 done — results are all in. Free the UI; scores stream in.
            btn.disabled = false; btn.style.display = ''; stopBtn.style.display = 'none';
            status.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
              <span style="color:#34d399;font-weight:700">✓ ${allJobs.length} results loaded</span>
              <span class="spinner" style="width:11px;height:11px"></span>
              <span style="color:var(--text3)">AI match scores streaming in…</span></div>`;
          } else {
            status.innerHTML = `<div class="loading-row"><div class="spinner"></div> ${s.message || 'Searching…'}</div>`;
          }
        },
        onDone() {
          stopStream = null;
          resetSearchUI(`${allJobs.length} result${allJobs.length !== 1 ? 's' : ''} found · AI scoring complete`);
          if (likedJobs.length > 0) loadRecommendations();
        },
        onError() { resetSearchUI('Search error — check console.'); },
      });
    } catch (e) {
      resetSearchUI(''); toast(e.message, 'error');
    }
  }


  async function openSalaryModal(job, card) {
    const btn = card.querySelector('.salary-est-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

    let data;
    try {
      data = await api.jobs.salaryEstimate(job);
    } catch (e) {
      toast('Salary estimate failed: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Est. Salary'; }
      return;
    }

    // Inline update the salary row
    const salRow = card.querySelector('#salary-row-' + job.id);
    if (salRow && data.estimatedBand) {
      const b = data.estimatedBand;
      const fmt = n => n >= 1000 ? '$' + Math.round(n / 1000) + 'K' : '$' + n;
      salRow.innerHTML = `
        <span class="salary-badge salary-estimated">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="5" cy="5" r="3.5"/><path d="M5 2.8v.5m0 3.5v.5"/></svg>
          ${fmt(b.p50)}/yr est.
        </span>
        <span class="salary-est-label">${data.confidenceLevel || 'est.'} confidence</span>
        <button class="btn btn-ghost btn-sm" onclick="openSalaryDetailModal(${JSON.stringify(JSON.stringify(data)).slice(1,-1)})" style="font-size:10px;padding:2px 7px">Details</button>
      `;
    }

    // Full detail modal
    if (data.estimatedBand) {
      const b = data.estimatedBand;
      const fmt = n => n ? '$' + Number(n).toLocaleString() : '—';
      const srcs = (data.primarySources || []).map(s => `<span class="salary-source-pill">${s}</span>`).join('');
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-bg" id="salary-modal-bg" onclick="if(event.target===this)this.remove()">
          <div class="modal" style="max-width:480px">
            <button class="modal-close" onclick="document.getElementById('salary-modal-bg').remove()">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg>
            </button>
            <div class="modal-title">Salary Intelligence</div>
            <div class="modal-sub">${job.title} · ${job.company} · ${job.location || 'United States'}</div>

            ${data.hasPostedSalary && data.postedSalary ? `
              <div style="background:color-mix(in oklab,var(--green) 10%,transparent);border:1px solid color-mix(in oklab,var(--green) 25%,transparent);border-radius:var(--r-md);padding:10px 14px;margin-bottom:14px;font-size:13px;color:#34d399;font-weight:600">
                Posted salary: ${data.postedSalary}
              </div>` : ''}

            <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Market Pay Bands (Annual USD)</div>
            <div class="salary-modal-band">
              <div class="salary-pct"><div class="salary-pct-label">25th %ile</div><div class="salary-pct-value p25">${fmt(b.p25)}</div></div>
              <div class="salary-pct"><div class="salary-pct-label">Median</div><div class="salary-pct-value p50">${fmt(b.p50)}</div></div>
              <div class="salary-pct"><div class="salary-pct-label">75th %ile</div><div class="salary-pct-value p75">${fmt(b.p75)}</div></div>
              <div class="salary-pct"><div class="salary-pct-label">90th %ile</div><div class="salary-pct-value p90">${fmt(b.p90)}</div></div>
            </div>

            ${data.locationAdjustment ? `<div style="font-size:12px;color:var(--text2);margin-bottom:10px">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="5" cy="4" r="2"/><path d="M5 1.5C3.3 1.5 1.5 3 1.5 4.5 1.5 7 5 9 5 9s3.5-2 3.5-4.5C8.5 3 6.7 1.5 5 1.5z"/></svg>
              ${data.locationAdjustment}
            </div>` : ''}

            <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Data Sources</div>
            <div class="salary-source-list">${srcs}</div>
            <div style="font-size:11.5px;color:var(--text2);line-height:1.5;margin-top:6px">${data.sourceContext || ''}</div>

            ${data.totalCompNote ? `<div style="margin-top:12px;padding:10px 12px;background:var(--bg2);border-radius:var(--r-md);font-size:11.5px;color:var(--text2);border:1px solid var(--line)">
              <span style="font-weight:600;color:var(--text)">Total Comp:</span> ${data.totalCompNote}
            </div>` : ''}

            <div style="margin-top:10px;font-size:10.5px;color:var(--text3);font-style:italic">
              Confidence: ${data.confidenceLevel || '—'} — ${data.confidenceNote || ''}
            </div>
          </div>
        </div>
      `);
    }
  }

  function renderJobsGrid() {
    const sort = el.querySelector('#sort-select').value;
    sortAndRender(sort);
    resCount.textContent = `${allJobs.length} job${allJobs.length !== 1 ? 's' : ''}`;
    resHdr.style.display = 'flex';
    updateSelectBar();
  }

  function sortAndRender(sort) {
    const sorted = [...allJobs].sort((a, b) => {
      if (sort === 'score') return (b.score || 0) - (a.score || 0);
      if (sort === 'date')  return (b.datePosted || '').localeCompare(a.datePosted || '');
      return (a.company || '').localeCompare(b.company || '');
    });
    grid.innerHTML = sorted.map(j => renderJobCard(j, { selectionMode: selectMode, selected: selectedJobs.has(j.id) })).join('');
    attachCardHandlers(grid, sorted);

    if (selectMode) {
      grid.querySelectorAll('.job-card-select-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          const id = cb.dataset.jobId;
          if (cb.checked) selectedJobs.add(id);
          else selectedJobs.delete(id);
          const card = cb.closest('.job-card');
          if (card) card.classList.toggle('job-card-selected', cb.checked);
          updateSelectBar();
        });
      });
    }
  }

  async function loadRecommendations() {
    const recsGrid    = el.querySelector('#recs-grid');
    const recsSection = el.querySelector('#recs-section');
    recsSection.style.display = '';
    recsGrid.innerHTML = `<div class="loading-row"><div class="spinner"></div> Finding top recommendations…</div>`;
    try {
      const recs = await api.jobs.recommend(likedJobs[likedJobs.length - 1]);
      recsGrid.innerHTML = (recs.jobs || []).map(j => renderJobCard(j)).join('');
      attachCardHandlers(recsGrid, recs.jobs || []);
    } catch { recsGrid.innerHTML = ''; recsSection.style.display = 'none'; }
  }

  function attachCardHandlers(container, jobs) {
    container.querySelectorAll('.job-card').forEach((card, i) => {
      const job = jobs[i];
      if (!job) return;

      card.querySelector('.evaluate-btn')?.addEventListener('click', e => {
        e.stopPropagation(); openEvalModal(job);
      });

      card.querySelector('.save-btn')?.addEventListener('click', async e => {
        e.stopPropagation();
        likedJobs.push(job);
        try {
          await api.tracker.add({ company: job.company, role: job.title, url: job.url, score: job.score, status: 'Evaluated' });
          toast('Saved to Applications', 'success');
        } catch { toast('Could not save', 'error'); }
      });

      card.querySelector('.salary-est-btn')?.addEventListener('click', e => {
        e.stopPropagation(); openSalaryModal(job, card);
      });
    });
  }
}

function openModalDirect(html) {
  const id = 'modal-' + Date.now();
  const bg = document.createElement('div');
  bg.className = 'modal-bg'; bg.dataset.modalId = id;
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
  return id;
}

function setupTagInput(el, wrapId, inputId) {
  const wrap  = el.querySelector('#' + wrapId);
  const input = el.querySelector('#' + inputId);
  const addTag = val => {
    val = val.trim();
    if (!val) return;
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.innerHTML = `${esc(val)}<button type="button">&times;</button>`;
    pill.dataset.value = val;
    pill.querySelector('button').onclick = () => pill.remove();
    wrap.insertBefore(pill, input);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input.value); input.value = ''; }
    if (e.key === 'Backspace' && !input.value) { wrap.querySelector('.tag-pill:last-of-type')?.remove(); }
  });
  input.addEventListener('blur', () => { if (input.value) { addTag(input.value); input.value = ''; } });
  wrap.addEventListener('click', () => input.focus());
}

function getTagValues(wrap) {
  return [...wrap.querySelectorAll('.tag-pill')].map(p => p.dataset.value);
}

function getKeywordString(el) {
  const wrap  = el.querySelector('#keywords-wrap');
  const input = el.querySelector('#f-keywords');
  const tags  = getTagValues(wrap);
  const typed = input?.value.trim();
  if (typed) tags.push(typed);
  return tags.join(' OR ');
}

function getLocationString(el) {
  const wrap  = el.querySelector('#locations-wrap');
  const input = el.querySelector('#f-location');
  const tags  = getTagValues(wrap);
  const typed = input?.value.trim();
  if (typed) tags.push(typed);
  return tags[0] || '';  // jobspy takes one location; use first
}

const KEYWORD_SUGGESTIONS = [
  'Software Engineer','Senior Software Engineer','Staff Engineer','Principal Engineer',
  'Product Manager','Senior Product Manager','Director of Product','VP of Product',
  'Data Scientist','Senior Data Scientist','Data Analyst','Business Analyst',
  'Machine Learning Engineer','AI Engineer','ML Ops',
  'DevOps Engineer','Site Reliability Engineer','Platform Engineer','Cloud Engineer',
  'Frontend Engineer','Backend Engineer','Full Stack Engineer',
  'UX Designer','Product Designer','UI Designer',
  'Engineering Manager','Director of Engineering','VP of Engineering','CTO',
  'Operations Manager','Director of Operations','VP of Operations',
  'Finance Manager','Financial Analyst','FP&A Analyst','Controller','CFO',
  'Marketing Manager','Growth Manager','Digital Marketing Manager',
  'Sales Manager','Account Executive','Business Development',
  'Strategy Manager','Chief of Staff','Program Manager','Project Manager',
  'HR Manager','People Operations','Talent Acquisition',
  'Legal Counsel','Compliance Manager','General Counsel',
  'Customer Success Manager','Account Manager',
  'Supply Chain Manager','Logistics Manager','Procurement Manager',
  'Consultant','Management Consultant','Strategy Consultant',
  'Analyst','Associate','Director','Vice President','Manager',
];

const COMPANY_SUGGESTIONS = [
  'Google','Meta','Apple','Microsoft','Amazon','Netflix','Salesforce','Stripe',
  'Airbnb','Uber','Lyft','Twitter','LinkedIn','Spotify','Slack','Dropbox',
  'Palantir','Snowflake','Databricks','Figma','Notion','Airtable','Asana',
  'HubSpot','Twilio','Cloudflare','MongoDB','Elastic','HashiCorp','GitLab',
  'GitHub','Atlassian','Zoom','DocuSign','Workday','ServiceNow','Okta',
  'CrowdStrike','Palo Alto Networks','Datadog','New Relic','Splunk','Dynatrace',
  'JPMorgan Chase','Goldman Sachs','Morgan Stanley','Citi','Bank of America',
  'McKinsey','Bain','BCG','Deloitte','Accenture','PwC','EY','KPMG',
  'Tesla','SpaceX','Rivian','Lucid Motors','Ford','GM','Toyota','BMW',
  'Johnson & Johnson','Pfizer','Moderna','AstraZeneca','Merck','Abbott',
  'Mayo Clinic','Cleveland Clinic','Kaiser Permanente','CVS Health','UnitedHealth',
];

const LOCATION_SUGGESTIONS = [
  // Work arrangement
  'Remote','Hybrid','On-site',
  // Metro / region searches (Nielsen-market coverage) — matches every city in the metro
  'New York Metro, NY (NYC)','Los Angeles Metro, CA (Greater Los Angeles)','Chicago Metro, IL (Chicagoland)',
  'Philadelphia Metro, PA (Philly)','Dallas-Fort Worth, TX (DFW)','San Francisco Bay Area, CA (Bay Area)',
  'Atlanta Metro, GA (Greater Atlanta)','Houston Metro, TX (Greater Houston)','Washington DC Metro, DC (Dmv Area)',
  'Boston Metro, MA (Greater Boston)','Phoenix Metro, AZ (Valley Of The Sun)','Seattle-Tacoma, WA (Puget Sound)',
  'Tampa-St. Petersburg, FL (Tampa Bay)','Minneapolis-St. Paul, MN (Twin Cities)','Detroit Metro, MI (Metro Detroit)',
  'Denver-Boulder, CO (Front Range)','Orlando Metro, FL','Miami-Fort Lauderdale, FL (South Florida)',
  'Cleveland-Akron, OH (Northeast Ohio)','Sacramento Metro, CA','Charlotte Metro, NC',
  'Portland Metro, OR','St. Louis Metro, MO','Raleigh-Durham, NC (Research Triangle)',
  'Pittsburgh Metro, PA','Salt Lake City Metro, UT (Wasatch Front)','Nashville Metro, TN (Middle Tennessee)',
  'Baltimore Metro, MD','San Diego Metro, CA','San Antonio Metro, TX',
  'Indianapolis Metro, IN (Indy)','Columbus Metro, OH','Kansas City Metro, MO (KC)',
  'Austin Metro, TX (Silicon Hills)','Cincinnati Metro, OH','Milwaukee Metro, WI',
  'Las Vegas Metro, NV','Oklahoma City Metro, OK (OKC)','Jacksonville Metro, FL',
  'Grand Rapids Metro, MI (West Michigan)','Hampton Roads, VA (Norfolk Metro)','Birmingham Metro, AL',
  'Memphis Metro, TN','Louisville Metro, KY','New Orleans Metro, LA (NOLA)',
  'Buffalo Metro, NY (Western New York)','Richmond Metro, VA','Providence Metro, RI',
  'Albany Metro, NY (Capital Region)','Tucson Metro, AZ','Fresno Metro, CA (Central Valley)',
  'Albuquerque Metro, NM','Omaha Metro, NE','Honolulu Metro, HI (Oahu)',
  'Boise Metro, ID (Treasure Valley)','Des Moines Metro, IA','Madison Metro, WI',
  'Spokane Metro, WA (Inland Northwest)','Hartford-New Haven, CT','Tulsa Metro, OK',
  'Knoxville Metro, TN','Charleston Metro, SC (Lowcountry)','Piedmont Triad, NC (Triad)',
  'Rochester Metro, NY','Dayton Metro, OH','El Paso Metro, TX (Borderplex)',
  'Little Rock Metro, AR','Baton Rouge Metro, LA','Colorado Springs Metro, CO',
  'Greenville-Spartanburg, SC (Upstate Sc)',
  // Northeast
  'New York, NY','Brooklyn, NY','Manhattan, NY','Queens, NY',
  'Boston, MA','Cambridge, MA','Providence, RI','Hartford, CT',
  'Philadelphia, PA','Pittsburgh, PA','Allentown, PA',
  'Newark, NJ','Jersey City, NJ','Trenton, NJ',
  'Albany, NY','Buffalo, NY','Rochester, NY','Syracuse, NY',
  'Portland, ME','Burlington, VT','Manchester, NH',
  'Baltimore, MD','Annapolis, MD',
  'Washington, DC','Arlington, VA','Alexandria, VA','McLean, VA',
  'Richmond, VA','Virginia Beach, VA','Norfolk, VA','Roanoke, VA',
  // Southeast
  'Atlanta, GA','Savannah, GA','Augusta, GA','Columbus, GA',
  'Charlotte, NC','Raleigh, NC','Durham, NC','Chapel Hill, NC','Greensboro, NC','Winston-Salem, NC','Cary, NC','Research Triangle Park, NC',
  'Columbia, SC','Charleston, SC','Greenville, SC',
  'Nashville, TN','Memphis, TN','Knoxville, TN','Chattanooga, TN',
  'Miami, FL','Orlando, FL','Tampa, FL','Jacksonville, FL','Fort Lauderdale, FL','Boca Raton, FL','Gainesville, FL','Tallahassee, FL','St. Petersburg, FL','Sarasota, FL',
  'Birmingham, AL','Huntsville, AL','Montgomery, AL','Mobile, AL',
  'Jackson, MS','Biloxi, MS',
  'New Orleans, LA','Baton Rouge, LA','Shreveport, LA',
  'Little Rock, AR','Fayetteville, AR',
  'Louisville, KY','Lexington, KY',
  // Midwest
  'Chicago, IL','Naperville, IL','Rockford, IL','Aurora, IL',
  'Detroit, MI','Grand Rapids, MI','Ann Arbor, MI','Lansing, MI','Kalamazoo, MI','Dearborn, MI',
  'Minneapolis, MN','Saint Paul, MN','Rochester, MN','Duluth, MN',
  'Columbus, OH','Cleveland, OH','Cincinnati, OH','Akron, OH','Dayton, OH','Toledo, OH',
  'Indianapolis, IN','Fort Wayne, IN','South Bend, IN',
  'Milwaukee, WI','Madison, WI','Green Bay, WI',
  'Kansas City, MO','St. Louis, MO','Springfield, MO',
  'Omaha, NE','Lincoln, NE',
  'Des Moines, IA','Cedar Rapids, IA',
  'Sioux Falls, SD','Fargo, ND',
  // Southwest
  'Dallas, TX','Fort Worth, TX','Austin, TX','Houston, TX','San Antonio, TX','El Paso, TX','Plano, TX','Irving, TX','Frisco, TX','McKinney, TX','Lubbock, TX','Amarillo, TX','Corpus Christi, TX',
  'Phoenix, AZ','Tucson, AZ','Scottsdale, AZ','Mesa, AZ','Tempe, AZ','Chandler, AZ','Gilbert, AZ',
  'Albuquerque, NM','Santa Fe, NM','Las Cruces, NM',
  'Oklahoma City, OK','Tulsa, OK',
  'Las Vegas, NV','Henderson, NV','Reno, NV',
  // Mountain West
  'Denver, CO','Boulder, CO','Colorado Springs, CO','Fort Collins, CO','Aurora, CO',
  'Salt Lake City, UT','Provo, UT','Ogden, UT',
  'Boise, ID','Nampa, ID',
  'Billings, MT','Missoula, MT',
  'Cheyenne, WY','Casper, WY',
  // Pacific Northwest
  'Seattle, WA','Bellevue, WA','Tacoma, WA','Spokane, WA','Redmond, WA','Kirkland, WA',
  'Portland, OR','Eugene, OR','Salem, OR','Bend, OR',
  'Anchorage, AK',
  // California
  'San Francisco, CA','Oakland, CA','San Jose, CA','Berkeley, CA',
  'Los Angeles, CA','Santa Monica, CA','Culver City, CA','Burbank, CA','Pasadena, CA','Long Beach, CA',
  'San Diego, CA','Carlsbad, CA','Chula Vista, CA',
  'Sacramento, CA','Fresno, CA','Bakersfield, CA','Stockton, CA','Modesto, CA',
  'Irvine, CA','Anaheim, CA','Santa Ana, CA','Riverside, CA','San Bernardino, CA',
  'Santa Barbara, CA','San Luis Obispo, CA','Monterey, CA',
  'Silicon Valley, CA',
  // Hawaii
  'Honolulu, HI','Maui, HI',
  // Canada
  'Toronto, Canada','Vancouver, Canada','Montreal, Canada','Calgary, Canada',
  'Ottawa, Canada','Edmonton, Canada','Winnipeg, Canada','Quebec City, Canada',
  // UK & Europe
  'London, UK','Manchester, UK','Birmingham, UK','Edinburgh, UK','Bristol, UK','Leeds, UK','Glasgow, UK',
  'Dublin, Ireland',
  'Berlin, Germany','Munich, Germany','Hamburg, Germany','Frankfurt, Germany','Cologne, Germany',
  'Amsterdam, Netherlands','Rotterdam, Netherlands',
  'Paris, France','Lyon, France',
  'Zurich, Switzerland','Geneva, Switzerland',
  'Stockholm, Sweden','Copenhagen, Denmark','Oslo, Norway','Helsinki, Finland',
  'Madrid, Spain','Barcelona, Spain','Lisbon, Portugal',
  'Milan, Italy','Rome, Italy',
  'Warsaw, Poland','Prague, Czech Republic','Vienna, Austria','Budapest, Hungary',
  // Asia Pacific
  'Singapore','Tokyo, Japan','Osaka, Japan','Seoul, South Korea',
  'Sydney, Australia','Melbourne, Australia','Brisbane, Australia','Perth, Australia',
  'Auckland, New Zealand',
  'Hong Kong','Shanghai, China','Beijing, China','Shenzhen, China',
  'Mumbai, India','Bangalore, India','Delhi, India','Hyderabad, India','Pune, India',
  // Middle East & Africa
  'Dubai, UAE','Abu Dhabi, UAE','Riyadh, Saudi Arabia','Tel Aviv, Israel',
  'Cape Town, South Africa','Johannesburg, South Africa','Nairobi, Kenya',
  // Latin America
  'São Paulo, Brazil','Rio de Janeiro, Brazil','Mexico City, Mexico',
  'Buenos Aires, Argentina','Bogotá, Colombia','Santiago, Chile','Lima, Peru',
];

function setupAutocompleteTagInput(el, wrapId, inputId, dropdownId, suggestions) {
  const wrap     = el.querySelector('#' + wrapId);
  const input    = el.querySelector('#' + inputId);
  const dropdown = el.querySelector('#' + dropdownId);
  if (!wrap || !input || !dropdown) return;

  let activeIdx = -1;

  const addTag = val => {
    val = val.trim();
    if (!val) return;
    const existing = getTagValues(wrap);
    if (existing.includes(val)) return;
    const pill = document.createElement('span');
    pill.className = 'tag-pill chip-blue';
    pill.innerHTML = `${esc(val)}<button type="button">&times;</button>`;
    pill.dataset.value = val;
    pill.querySelector('button').onclick = () => pill.remove();
    wrap.insertBefore(pill, input);
    input.value = '';
    hideDropdown();
  };

  const showDropdown = filtered => {
    if (!filtered.length) { hideDropdown(); return; }
    activeIdx = -1;
    dropdown.innerHTML = filtered.map((s, i) =>
      `<div class="ac-item" data-idx="${i}" data-val="${esc(s)}" style="padding:8px 12px;font-size:12.5px;color:var(--text);cursor:pointer;border-bottom:1px solid var(--line)">${esc(s)}</div>`
    ).join('');
    dropdown.style.display = '';
    dropdown.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('mousedown', e => { e.preventDefault(); addTag(item.dataset.val); });
      item.addEventListener('mouseenter', () => {
        dropdown.querySelectorAll('.ac-item').forEach(i => i.style.background = '');
        item.style.background = 'var(--bg3)';
        activeIdx = parseInt(item.dataset.idx);
      });
    });
  };

  const hideDropdown = () => { dropdown.style.display = 'none'; activeIdx = -1; };

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) { hideDropdown(); return; }
    const filtered = suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 10);
    showDropdown(filtered);
  });

  input.addEventListener('keydown', e => {
    const items = [...dropdown.querySelectorAll('.ac-item')];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      items.forEach((i, idx) => i.style.background = idx === activeIdx ? 'var(--bg3)' : '');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      items.forEach((i, idx) => i.style.background = idx === activeIdx ? 'var(--bg3)' : '');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && items[activeIdx]) {
        addTag(items[activeIdx].dataset.val);
      } else {
        addTag(input.value);
      }
    } else if (e.key === 'Escape') {
      hideDropdown();
    } else if (e.key === 'Backspace' && !input.value) {
      wrap.querySelector('.tag-pill:last-of-type')?.remove();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (input.value.trim()) addTag(input.value);
      hideDropdown();
    }, 150);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) {
      const filtered = suggestions.filter(s => s.toLowerCase().includes(input.value.toLowerCase())).slice(0, 10);
      showDropdown(filtered);
    }
  });

  wrap.addEventListener('click', () => input.focus());
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
