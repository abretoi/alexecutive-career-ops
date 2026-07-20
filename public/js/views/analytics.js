import { api } from '../api.js';
import { toast } from '../app.js';

const TABS = [
  { key: 'pipeline',  label: 'Pipeline'       },
  { key: 'skills',    label: 'Skills Gap'      },
  { key: 'blindspot', label: 'Blind Spots'     },
];

const FUNNEL_STAGES = ['Evaluated','Resume Ready','Applied','Responded','Interview','Offer','Accepted'];

const HEATMAP = {
  Mon: { AM: 0.5, PM: 0.3 },
  Tue: { AM: 1.0, PM: 0.7 },
  Wed: { AM: 0.9, PM: 0.6 },
  Thu: { AM: 0.85, PM: 0.55 },
  Fri: { AM: 0.4, PM: 0.2 },
  Sat: { AM: 0.15, PM: 0.1 },
  Sun: { AM: 0.1,  PM: 0.08 },
};

function heatColor(v) {
  if (v >= 0.8) return 'rgba(48,209,88,.7)';
  if (v >= 0.6) return 'rgba(48,209,88,.4)';
  if (v >= 0.4) return 'rgba(255,159,10,.5)';
  if (v >= 0.2) return 'rgba(255,159,10,.25)';
  return 'rgba(255,255,255,.07)';
}

function spinnerHTML(msg) {
  return `<div style="display:flex;align-items:center;gap:10px;color:var(--text3);padding:24px 0">
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round">
      <path d="M9 2a7 7 0 110 14A7 7 0 019 2z" opacity=".25"/>
      <path d="M9 2a7 7 0 017 7"><animateTransform attributeName="transform" type="rotate" from="0 9 9" to="360 9 9" dur="0.8s" repeatCount="indefinite"/></path>
    </svg>
    <span>${msg}</span>
  </div>`;
}

function cssBar(pct, color, height = '8px') {
  return `<div style="background:var(--bg3);border-radius:4px;height:${height};overflow:hidden;flex:1">
    <div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:4px;transition:width .6s"></div>
  </div>`;
}

function responseRateColor(rate) {
  if (rate >= 30) return 'var(--green)';
  if (rate >= 15) return 'var(--amber)';
  return 'var(--rose)';
}

function urgencyChip(u) {
  if (u === 'high')   return `<span class="chip" style="background:rgba(255,69,58,.15);color:var(--rose);font-size:11px">High</span>`;
  if (u === 'medium') return `<span class="chip" style="background:rgba(255,159,10,.15);color:var(--amber);font-size:11px">Medium</span>`;
  return `<span class="chip" style="background:rgba(6,182,212,.15);color:var(--teal);font-size:11px">Low</span>`;
}

function severityStyle(s) {
  if (s === 'high')   return 'background:rgba(255,69,58,.06);border:1px solid rgba(255,69,58,.2)';
  if (s === 'medium') return 'background:rgba(255,159,10,.06);border:1px solid rgba(255,159,10,.2)';
  return 'background:rgba(6,182,212,.06);border:1px solid rgba(6,182,212,.2)';
}

function severityBadge(s) {
  if (s === 'high')   return `<span class="chip" style="background:rgba(255,69,58,.15);color:var(--rose);font-size:11px">High</span>`;
  if (s === 'medium') return `<span class="chip" style="background:rgba(255,159,10,.15);color:var(--amber);font-size:11px">Medium</span>`;
  return `<span class="chip" style="background:rgba(6,182,212,.15);color:var(--teal);font-size:11px">Low</span>`;
}

export async function renderAnalytics(el, state) {
  let activeTab = 'pipeline';
  let pipelineData = null;
  let skillsData = null;
  let blindSpotData = null;

  const apps = await api.tracker.list().catch(() => state.applications || []);

  function renderFunnel(data) {
    const stages = FUNNEL_STAGES.map((s, i) => {
      const count = data.funnel?.[s] ?? 0;
      const prev = i === 0 ? count : (data.funnel?.[FUNNEL_STAGES[i-1]] ?? 1);
      const pct = prev > 0 ? Math.round((count / prev) * 100) : 0;
      const barPct = data.funnel?.[FUNNEL_STAGES[0]] > 0
        ? Math.round((count / data.funnel[FUNNEL_STAGES[0]]) * 100)
        : 0;
      return { s, count, pct, barPct };
    });

    return `
    <div class="section">
      <div class="section-hdr"><span class="section-title">Application Funnel</span></div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${stages.map(({ s, count, pct, barPct }, i) => {
          const grad = `linear-gradient(90deg,rgba(10,132,255,1) 0%,rgba(6,182,212,1) 50%,rgba(48,209,88,1) 100%)`;
          return `
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:110px;font-size:12px;color:var(--text3);text-align:right;flex-shrink:0">${s}</div>
            <div style="flex:1;display:flex;align-items:center;gap:8px">
              <div style="flex:1;background:var(--bg3);border-radius:4px;height:10px;overflow:hidden">
                <div style="height:100%;width:${barPct}%;background:${grad};border-radius:4px;transition:width .6s;animation-delay:${i*0.08}s"></div>
              </div>
              <div style="width:36px;text-align:right;font-size:13px;font-weight:600;color:var(--text)">${count}</div>
              ${i > 0 ? `<div style="width:42px;text-align:right;font-size:11px;color:${pct>=50?'var(--green)':pct>=25?'var(--amber)':'var(--rose)'}">${pct}%</div>` : '<div style="width:42px"></div>'}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="section">
      <div class="section-hdr"><span class="section-title">Source Performance</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Source</th><th>Applications</th><th>Responses</th><th>Response Rate</th></tr></thead>
          <tbody>
            ${(data.sources || []).map(src => {
              const rate = src.applications > 0 ? Math.round((src.responses / src.applications) * 100) : 0;
              return `<tr>
                <td class="primary">${src.source}</td>
                <td>${src.applications}</td>
                <td>${src.responses}</td>
                <td style="color:${responseRateColor(rate)};font-weight:600">${rate}%</td>
              </tr>`;
            }).join('') || `<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:20px">No source data yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-hdr"><span class="section-title">Score Distribution</span></div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
        ${[['1–2','1-2'],['2–3','2-3'],['3–3.5','3-3.5'],['3.5–4','3.5-4'],['4–4.5','4-4.5'],['4.5–5','4.5-5']].map(([label, key]) => {
          const count = data.scoreDistribution?.[key] ?? 0;
          const max = Math.max(...Object.values(data.scoreDistribution || {1:1}), 1);
          const pct = Math.round((count / max) * 100);
          const color = key.startsWith('4') || key === '3.5-4' ? 'var(--green)' : key.startsWith('1') || key === '2-3' ? 'var(--rose)' : 'var(--amber)';
          return `<div style="display:flex;align-items:center;gap:10px">
            <div style="width:50px;font-size:12px;color:var(--text3);text-align:right;flex-shrink:0">${label}</div>
            <div style="flex:1;background:var(--bg3);border-radius:4px;height:8px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .5s"></div>
            </div>
            <div style="width:28px;font-size:12px;color:var(--text3)">${count}</div>
          </div>`;
        }).join('')}
      </div>
      ${data.scoreInsight ? `<div style="font-size:13px;color:var(--text2);background:var(--bg3);border-radius:8px;padding:10px 12px">${data.scoreInsight}</div>` : ''}
    </div>

    <div class="section">
      <div class="section-hdr"><span class="section-title">Best Times to Apply</span></div>
      <div style="margin-bottom:10px">
        <div style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:12px">
          <strong style="color:var(--text)">Apply Tuesday–Thursday mornings.</strong> Applications submitted in the first 3 days of a posting receive 5–8× higher interview rates.
        </div>
        <div style="display:grid;grid-template-columns:40px repeat(7,1fr);gap:4px;font-size:11px">
          <div></div>
          ${Object.keys(HEATMAP).map(d => `<div style="text-align:center;color:var(--text3);padding-bottom:4px">${d}</div>`).join('')}
          ${['AM','PM'].map(period => `
            <div style="color:var(--text3);display:flex;align-items:center;font-size:11px">${period}</div>
            ${Object.keys(HEATMAP).map(day => `
              <div style="height:28px;border-radius:4px;background:${heatColor(HEATMAP[day][period])};display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,.6)">
                ${HEATMAP[day][period] >= 0.8 ? '●' : ''}
              </div>`).join('')}
          `).join('')}
        </div>
        <div style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:var(--text3)">
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(48,209,88,.7);display:inline-block"></span> Best</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(255,159,10,.5);display:inline-block"></span> Moderate</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(255,255,255,.07);display:inline-block"></span> Avoid</span>
        </div>
      </div>
    </div>`;
  }

  function renderSkillsTab(data) {
    if (!data) return `
    <div class="section">
      <div class="section-hdr"><span class="section-title">Skills Gap Roadmap</span></div>
      <p style="font-size:13px;color:var(--text3);margin-bottom:16px">Analyzes your last 20 evaluated jobs to identify recurring skill gaps and learning resources.</p>
      <button class="btn btn-primary" id="skills-gen-btn">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
        Analyze Skills Gap
      </button>
      <div id="skills-results"></div>
    </div>`;

    return `
    <div class="section">
      <div class="section-hdr">
        <span class="section-title">Skills Gap Roadmap</span>
        <button class="btn btn-ghost btn-sm" id="skills-gen-btn">Re-Analyze</button>
      </div>
      <div style="margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;color:var(--text2)">Overall Readiness</span>
          <span style="font-size:22px;font-weight:700;color:var(--text)">${data.readinessScore ?? 0}%</span>
        </div>
        ${cssBar(data.readinessScore ?? 0, 'var(--grad)', '10px')}
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
        ${(data.gaps || []).slice(0,5).map(gap => `
          <div class="card" style="padding:14px 16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:14px;font-weight:600;color:var(--text);flex:1">${gap.skill}</span>
              ${urgencyChip(gap.urgency)}
              <span style="font-size:12px;color:var(--text3)">${gap.frequency}% of roles</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${(gap.resources || []).map(r => `<span class="chip" style="background:rgba(10,132,255,.12);color:var(--blue);font-size:11px">${r}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>
      ${data.summary ? `<div style="font-size:13px;color:var(--text2);line-height:1.6;background:var(--bg2);border-radius:8px;padding:12px 14px;border:1px solid var(--line)">${data.summary}</div>` : ''}
      <div id="skills-results"></div>
    </div>`;
  }

  function renderBlindSpotsTab(data) {
    if (!data) return `
    <div class="section">
      <div class="section-hdr"><span class="section-title">Blind Spot Detector</span></div>
      <p style="font-size:13px;color:var(--text3);margin-bottom:16px">Scans your application patterns for hidden issues hurting your response rates.</p>
      <button class="btn btn-primary" id="bs-gen-btn">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
        Detect Blind Spots
      </button>
      <div id="bs-results"></div>
    </div>`;

    return `
    <div class="section">
      <div class="section-hdr">
        <span class="section-title">Blind Spot Detector</span>
        <button class="btn btn-ghost btn-sm" id="bs-gen-btn">Re-Scan</button>
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:16px">
        <div style="text-align:center;min-width:70px">
          <div style="font-size:40px;font-weight:700;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${data.healthScore ?? 0}</div>
          <div style="font-size:11px;color:var(--text3)">Health Score</div>
        </div>
        ${data.topRecommendation ? `<div style="flex:1;border-left:1px solid var(--line);padding-left:16px">
          <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin-bottom:4px">Top Recommendation</div>
          <div style="font-size:13px;color:var(--text);line-height:1.5">${data.topRecommendation}</div>
        </div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${(data.insights || []).map(ins => `
          <div style="${severityStyle(ins.severity)};border-radius:10px;padding:14px 16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:13px;font-weight:600;color:var(--text);flex:1">${ins.pattern}</span>
              ${severityBadge(ins.severity)}
            </div>
            <p style="font-size:13px;color:var(--text2);margin:0 0 6px">${ins.finding}</p>
            <div style="font-size:12px;color:var(--text3)">
              <strong style="color:var(--text)">Fix:</strong> ${ins.recommendation}
            </div>
          </div>`).join('')}
      </div>
      <div id="bs-results"></div>
    </div>`;
  }

  async function loadPipelineAndRender() {
    const pane = el.querySelector('#analytics-pane');
    if (!pane) return;
    pane.innerHTML = spinnerHTML('Loading pipeline data…');
    try {
      pipelineData = await api.analytics.pipeline();
      pane.innerHTML = renderFunnel(pipelineData);
    } catch(e) {
      pane.innerHTML = `<div style="color:var(--rose);font-size:13px">${e.message}</div>`;
    }
  }

  function wireSkillsBtn() {
    el.querySelector('#skills-gen-btn')?.addEventListener('click', async () => {
      const btn = el.querySelector('#skills-gen-btn');
      const results = el.querySelector('#skills-results');
      btn.disabled = true; btn.textContent = 'Analyzing…';
      if (results) results.innerHTML = spinnerHTML('Analyzing skill patterns…');
      try {
        const evalJobs = apps.filter(a => a.status !== 'Queued').slice(0, 20);
        skillsData = await api.analytics.skillsGap(evalJobs);
        renderActiveTab();
      } catch(e) {
        if (results) results.innerHTML = `<div style="color:var(--rose);font-size:13px">${e.message}</div>`;
        if (btn) { btn.disabled = false; btn.textContent = 'Analyze Skills Gap'; }
      }
    });
  }

  function wireBlindSpotsBtn() {
    el.querySelector('#bs-gen-btn')?.addEventListener('click', async () => {
      const btn = el.querySelector('#bs-gen-btn');
      const results = el.querySelector('#bs-results');
      btn.disabled = true; btn.textContent = 'Scanning…';
      if (results) results.innerHTML = spinnerHTML('Detecting patterns…');
      try {
        blindSpotData = await api.analytics.blindSpots();
        renderActiveTab();
      } catch(e) {
        if (results) results.innerHTML = `<div style="color:var(--rose);font-size:13px">${e.message}</div>`;
        if (btn) { btn.disabled = false; btn.textContent = 'Detect Blind Spots'; }
      }
    });
  }

  function renderActiveTab() {
    el.innerHTML = `
    <div class="page-hdr">
      <h1>Analytics</h1>
      <p>Pipeline metrics, skills gaps, and blind spot detection.</p>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px" id="an-tab-row">
      ${TABS.map(t => `<button class="btn btn-sm an-tab-btn ${t.key === activeTab ? 'btn-secondary' : 'btn-ghost'}" data-tab="${t.key}">${t.label}</button>`).join('')}
    </div>

    <div id="analytics-pane">
      ${activeTab === 'pipeline'  ? (pipelineData ? renderFunnel(pipelineData) : '') : ''}
      ${activeTab === 'skills'    ? renderSkillsTab(skillsData) : ''}
      ${activeTab === 'blindspot' ? renderBlindSpotsTab(blindSpotData) : ''}
    </div>`;

    el.querySelectorAll('.an-tab-btn').forEach(b => {
      b.addEventListener('click', () => {
        activeTab = b.dataset.tab;
        renderActiveTab();
        if (activeTab === 'pipeline' && !pipelineData) loadPipelineAndRender();
      });
    });

    if (activeTab === 'pipeline' && !pipelineData) {
      loadPipelineAndRender();
    } else if (activeTab === 'skills') {
      wireSkillsBtn();
    } else if (activeTab === 'blindspot') {
      wireBlindSpotsBtn();
    }
  }

  renderActiveTab();
}
