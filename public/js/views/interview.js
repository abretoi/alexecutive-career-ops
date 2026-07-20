import { api } from '../api.js';
import { toast } from '../app.js';

function esc(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const TABS = [
  { key: 'star',    label: 'STAR Answers'   },
  { key: 'brief',   label: 'Company Brief'  },
  { key: 'tech',    label: 'Tech Q&A'       },
  { key: 'mock',    label: 'Mock Interview'  },
];

function diffBadge(level) {
  if (level === 'easy')   return `<span class="chip" style="background:rgba(48,209,88,.15);color:var(--green);font-size:11px">Easy</span>`;
  if (level === 'hard')   return `<span class="chip" style="background:rgba(255,69,58,.15);color:var(--rose);font-size:11px">Hard</span>`;
  return `<span class="chip" style="background:rgba(255,159,10,.15);color:var(--amber);font-size:11px">Medium</span>`;
}

function typeBadge(type) {
  return `<span class="chip" style="background:var(--bg3);color:var(--text3);font-size:11px">${type || 'General'}</span>`;
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

export async function renderInterview(el, state) {
  let activeTab = 'star';
  let apps = [];
  let techQs = [];

  apps = await api.tracker.list().catch(() => state.applications || []);

  function jobSelectorHTML() {
    return `
    <div class="section" style="margin-bottom:0;padding-bottom:16px">
      <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Job</label>
          <select class="input" id="iv-job-sel" style="width:100%">
            <option value="">— Select a saved job —</option>
            ${apps.map(a => `<option value="${a.id}">${a.company} — ${a.role}</option>`).join('')}
          </select>
        </div>
        <div>
          <button class="btn btn-ghost btn-sm" id="iv-paste-toggle">Paste JD</button>
        </div>
      </div>
      <textarea class="input" id="iv-jd-paste" placeholder="Paste the job description here…" style="display:none;width:100%;height:90px;margin-top:8px;resize:vertical"></textarea>
    </div>`;
  }

  function renderSTARTab() {
    return `
    <div class="section">
      <div class="section-hdr"><span class="section-title">STAR Answer Generator</span></div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Interview Questions <span style="color:var(--text4)">(one per line)</span></label>
        <textarea class="input" id="star-questions" placeholder="Tell me about a time you led a project…&#10;Describe a conflict you resolved…" style="width:100%;height:100px;resize:vertical"></textarea>
      </div>
      <button class="btn btn-primary" id="star-gen-btn">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
        Generate STAR Answers
      </button>
      <div id="star-results" style="margin-top:20px"></div>
    </div>`;
  }

  function renderBriefTab() {
    return `
    <div class="section">
      <div class="section-hdr"><span class="section-title">Company Brief</span></div>
      <button class="btn btn-primary" id="brief-gen-btn">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
        Generate Company Brief
      </button>
      <div id="brief-results" style="margin-top:20px"></div>
    </div>`;
  }

  function renderTechTab() {
    return `
    <div class="section">
      <div class="section-hdr"><span class="section-title">Practice Questions</span></div>
      <button class="btn btn-primary" id="tech-gen-btn">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
        Generate Practice Questions
      </button>
      <div id="tech-results" style="margin-top:20px"></div>
    </div>`;
  }

  function renderMockTab() {
    return `
    <div class="section">
      <div class="section-hdr"><span class="section-title">Mock Interview</span></div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Question</label>
        <textarea class="input" id="mock-question" style="width:100%;height:70px;resize:vertical" placeholder="Tell me about your most impactful project…">${techQs[0]?.question || ''}</textarea>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Your Answer</label>
        <textarea class="input" id="mock-answer" style="width:100%;height:140px;resize:vertical" placeholder="Type your response here…"></textarea>
      </div>
      <button class="btn btn-primary" id="mock-submit-btn">Submit Answer for Feedback</button>
      <div id="mock-results" style="margin-top:20px"></div>
    </div>`;
  }

  function getJobContext() {
    const sel = el.querySelector('#iv-job-sel');
    const paste = el.querySelector('#iv-jd-paste');
    const jobId = sel?.style.display !== 'none' ? sel?.value : '';
    const jd = paste?.style.display !== 'none' ? paste?.value.trim() : '';
    if (jobId) return apps.find(a => a.id === jobId) || null;
    if (jd) return { role: 'this role', company: 'this company', description: jd };
    return null;
  }

  function wireTabContent() {
    // Paste JD toggle
    el.querySelector('#iv-paste-toggle')?.addEventListener('click', () => {
      const jd = el.querySelector('#iv-jd-paste');
      const sel = el.querySelector('#iv-job-sel');
      if (jd.style.display === 'none') {
        jd.style.display = 'block'; sel.style.display = 'none';
        el.querySelector('#iv-paste-toggle').textContent = 'Use saved job';
      } else {
        jd.style.display = 'none'; sel.style.display = 'block';
        el.querySelector('#iv-paste-toggle').textContent = 'Paste JD';
      }
    });

    if (activeTab === 'star') {
      el.querySelector('#star-gen-btn')?.addEventListener('click', async () => {
        const job = getJobContext();
        if (!job) { toast('Select a job first', 'error'); return; }
        const rawQs = el.querySelector('#star-questions')?.value.trim();
        const questions = rawQs ? rawQs.split('\n').map(q => q.trim()).filter(Boolean) : [];
        if (!questions.length) { toast('Enter at least one question', 'error'); return; }
        const btn = el.querySelector('#star-gen-btn');
        btn.disabled = true; btn.textContent = 'Generating…';
        const results = el.querySelector('#star-results');
        results.innerHTML = spinnerHTML('Crafting STAR answers…');
        try {
          const data = await api.interview.starAnswers(job, questions);
          results.innerHTML = (data?.answers || []).map((item, i) => `
            <div class="card" style="margin-bottom:12px">
              <div style="font-weight:600;margin-bottom:12px;color:var(--text)">${item.question || questions[i]}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                ${['Situation','Task','Action','Result'].map((k, ki) => {
                  const colors = ['var(--blue)','var(--teal)','var(--amber)','var(--green)'];
                  return `<div style="background:var(--bg3);border-radius:8px;padding:10px 12px">
                    <div style="font-size:11px;font-weight:700;color:${colors[ki]};text-transform:uppercase;margin-bottom:4px">${k}</div>
                    <div style="font-size:13px;color:var(--text2)">${item[k.toLowerCase()] || '—'}</div>
                  </div>`;
                }).join('')}
              </div>
              <details>
                <summary style="cursor:pointer;font-size:13px;color:var(--blue);list-style:none">▸ Full Answer</summary>
                <div style="margin-top:8px;font-size:13px;line-height:1.6;color:var(--text2);border-left:2px solid var(--line);padding-left:12px">${item.fullAnswer || ''}</div>
              </details>
              <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="navigator.clipboard.writeText(${JSON.stringify(item.fullAnswer||'')});window._toast&&window._toast('Copied','success')">Copy</button>
            </div>`).join('');
        } catch(e) {
          results.innerHTML = `<div style="color:var(--rose);font-size:13px">${e.message}</div>`;
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg> Generate STAR Answers`;
        }
      });
    }

    if (activeTab === 'brief') {
      el.querySelector('#brief-gen-btn')?.addEventListener('click', async () => {
        const job = getJobContext();
        if (!job) { toast('Select a job first', 'error'); return; }
        const btn = el.querySelector('#brief-gen-btn');
        btn.disabled = true; btn.textContent = 'Generating…';
        const results = el.querySelector('#brief-results');
        results.innerHTML = spinnerHTML('Researching the company…');
        try {
          const d = await api.interview.companyBrief(job);
          results.innerHTML = `
            <div class="card" style="display:flex;flex-direction:column;gap:16px">
              <div>
                <span class="chip" style="background:rgba(10,132,255,.15);color:var(--blue);margin-bottom:8px;display:inline-block">Overview</span>
                <p style="font-size:13px;line-height:1.6;color:var(--text2);margin:0">${esc(d.overview)}</p>
              </div>
              ${d.cultureSignals?.length ? `<div>
                <div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Culture Signals</div>
                <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
                  ${d.cultureSignals.map(s => `<li style="font-size:13px;color:var(--text2)">${esc(s)}</li>`).join('')}
                </ul>
              </div>` : ''}
              ${(d.hiringPurpose || d.whyHiring) ? `<div style="background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.2);border-radius:8px;padding:12px 14px">
                <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin-bottom:4px">Why They're Hiring</div>
                <p style="font-size:13px;color:var(--text2);margin:0">${esc(d.hiringPurpose || d.whyHiring)}</p>
              </div>` : ''}
              ${d.smartQuestions?.length ? `<div>
                <div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;margin-bottom:8px">3 Smart Questions to Ask</div>
                <div style="display:flex;flex-direction:column;gap:8px">
                  ${d.smartQuestions.slice(0,3).map((q, i) => `
                    <div style="display:flex;align-items:flex-start;gap:10px">
                      <span style="width:20px;height:20px;border-radius:50%;background:var(--bg3);color:var(--text3);font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
                      <div style="flex:1">
                        <span style="font-size:13px;color:var(--text2)">${esc(q)}</span>
                      </div>
                      <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(esc(q))})">Copy</button>
                    </div>`).join('')}
                </div>
              </div>` : ''}
              ${d.redFlags?.length ? `<div style="background:rgba(255,69,58,.07);border:1px solid rgba(255,69,58,.2);border-radius:8px;padding:12px 14px">
                <div style="font-size:11px;font-weight:700;color:var(--rose);text-transform:uppercase;margin-bottom:6px">Red Flags</div>
                <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
                  ${d.redFlags.map(f => `<li style="font-size:13px;color:var(--rose)">${esc(f)}</li>`).join('')}
                </ul>
              </div>` : ''}
              ${(d.recommendedAngle || d.angle) ? `<div style="background:linear-gradient(120deg,rgba(10,132,255,.08),rgba(48,209,88,.08));border:1px solid rgba(10,132,255,.2);border-radius:8px;padding:14px 16px">
                <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Recommended Interview Angle</div>
                <p style="font-size:13px;color:var(--text);margin:0;font-weight:500">${esc(d.recommendedAngle || d.angle)}</p>
              </div>` : ''}
            </div>`;
        } catch(e) {
          results.innerHTML = `<div style="color:var(--rose);font-size:13px">${e.message}</div>`;
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg> Generate Company Brief`;
        }
      });
    }

    if (activeTab === 'tech') {
      el.querySelector('#tech-gen-btn')?.addEventListener('click', async () => {
        const job = getJobContext();
        if (!job) { toast('Select a job first', 'error'); return; }
        const btn = el.querySelector('#tech-gen-btn');
        btn.disabled = true; btn.textContent = 'Generating…';
        const results = el.querySelector('#tech-results');
        results.innerHTML = spinnerHTML('Generating practice questions…');
        try {
          const qs = await api.interview.techQA(job);
          techQs = qs?.questions || [];
          results.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">` +
            techQs.map((q, i) => `
              <div class="card" style="cursor:pointer" id="techq-${i}">
                <div style="display:flex;align-items:flex-start;gap:10px">
                  <div style="flex:1">
                    <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:6px">${q.q || q.question || ''}</div>
                    <div style="display:flex;gap:6px">${diffBadge(q.difficulty)}${typeBadge(q.type)}</div>
                  </div>
                  <svg class="expand-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-linecap="round"><path d="M3.5 5.5L7 9l3.5-3.5"/></svg>
                </div>
                <div class="techq-answer" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;line-height:1.6;color:var(--text2)">${q.modelAnswer || q.answer || ''}</div>
              </div>`).join('') + `</div>`;

          results.querySelectorAll('[id^=techq-]').forEach((card, i) => {
            card.addEventListener('click', () => {
              const ans = card.querySelector('.techq-answer');
              const icon = card.querySelector('.expand-icon');
              const open = ans.style.display !== 'none';
              ans.style.display = open ? 'none' : 'block';
              icon.style.transform = open ? '' : 'rotate(180deg)';
            });
          });
        } catch(e) {
          results.innerHTML = `<div style="color:var(--rose);font-size:13px">${e.message}</div>`;
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg> Generate Practice Questions`;
        }
      });
    }

    if (activeTab === 'mock') {
      el.querySelector('#mock-submit-btn')?.addEventListener('click', async () => {
        const job = getJobContext();
        if (!job) { toast('Select a job first', 'error'); return; }
        const question = el.querySelector('#mock-question')?.value.trim();
        const answer = el.querySelector('#mock-answer')?.value.trim();
        if (!question) { toast('Enter a question', 'error'); return; }
        if (!answer) { toast('Type your answer first', 'error'); return; }
        const btn = el.querySelector('#mock-submit-btn');
        btn.disabled = true; btn.textContent = 'Evaluating…';
        const results = el.querySelector('#mock-results');
        results.innerHTML = spinnerHTML('Analyzing your response…');
        try {
          const fb = await api.interview.mockFeedback(job, question, answer);
          const grade = fb.grade || '—';
          const gradeColor = { A: 'var(--green)', B: 'var(--teal)', C: 'var(--amber)', D: 'var(--rose)' }[grade] || 'var(--text3)';
          results.innerHTML = `
            <div class="card" style="display:flex;flex-direction:column;gap:16px">
              <div style="display:flex;align-items:center;gap:16px">
                <div style="text-align:center;min-width:60px">
                  <div style="font-size:36px;font-weight:700;color:${gradeColor}">${grade}</div>
                  <div style="font-size:11px;color:var(--text3)">Grade</div>
                </div>
                <div style="flex:1">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                    <span style="font-size:12px;color:var(--text3)">Score</span>
                    <span style="font-size:13px;font-weight:600;color:var(--text)">${fb.score || 0}/10</span>
                  </div>
                  <div style="background:var(--bg3);border-radius:4px;height:6px;overflow:hidden">
                    <div style="height:100%;width:${(fb.score||0)*10}%;background:var(--grad);border-radius:4px;transition:width .5s"></div>
                  </div>
                </div>
              </div>
              ${fb.strengths?.length ? `<div>
                <div style="font-size:12px;font-weight:600;color:var(--green);text-transform:uppercase;margin-bottom:8px">Strengths</div>
                <ul style="margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:6px">
                  ${fb.strengths.map(s => `<li style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--text2)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0;margin-top:1px"><path d="M2.5 7l3 3L11.5 4"/></svg>${s}
                  </li>`).join('')}
                </ul>
              </div>` : ''}
              ${fb.improvements?.length ? `<div>
                <div style="font-size:12px;font-weight:600;color:var(--amber);text-transform:uppercase;margin-bottom:8px">Areas to Improve</div>
                <ul style="margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:6px">
                  ${fb.improvements.map(s => `<li style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--text2)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--amber)" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0;margin-top:1px"><path d="M7 4v4M7 10v.5"/></svg>${s}
                  </li>`).join('')}
                </ul>
              </div>` : ''}
              ${fb.rewrittenAnswer ? `<div>
                <div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Stronger Version</div>
                <div style="background:var(--bg3);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.6;color:var(--text2)">${fb.rewrittenAnswer}</div>
                <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="navigator.clipboard.writeText(${JSON.stringify(fb.rewrittenAnswer)});window._toast&&window._toast('Copied','success')">Copy Rewrite</button>
              </div>` : ''}
            </div>`;
        } catch(e) {
          results.innerHTML = `<div style="color:var(--rose);font-size:13px">${e.message}</div>`;
        } finally {
          btn.disabled = false;
          btn.textContent = 'Submit Answer for Feedback';
        }
      });
    }
  }

  function renderActiveTab() {
    const tabContents = {
      star:  renderSTARTab(),
      brief: renderBriefTab(),
      tech:  renderTechTab(),
      mock:  renderMockTab(),
    };

    el.innerHTML = `
    <div class="page-hdr">
      <h1>Interview Prep</h1>
      <p>STAR answers, company briefs, practice questions, and live mock feedback.</p>
    </div>

    ${jobSelectorHTML()}

    <div style="display:flex;gap:8px;margin:16px 0" id="iv-tab-row">
      ${TABS.map(t => `<button class="btn btn-sm iv-tab-btn ${t.key === activeTab ? 'btn-secondary' : 'btn-ghost'}" data-tab="${t.key}">${t.label}</button>`).join('')}
    </div>

    <div id="iv-tab-content">${tabContents[activeTab]}</div>`;

    el.querySelectorAll('.iv-tab-btn').forEach(b => {
      b.addEventListener('click', () => {
        activeTab = b.dataset.tab;
        renderActiveTab();
      });
    });

    wireTabContent();
  }

  renderActiveTab();
}
