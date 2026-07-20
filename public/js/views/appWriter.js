import { api } from '../api.js';
import { toast } from '../app.js';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STYLES = [
  { value: 'professional',   label: 'Professional',   hint: 'Polished, universally appropriate' },
  { value: 'formal',         label: 'Formal',         hint: 'Law, finance, government' },
  { value: 'technical',      label: 'Technical',      hint: 'Engineering, data, IT' },
  { value: 'executive',      label: 'Executive',      hint: 'Director, VP, C-suite' },
  { value: 'conversational', label: 'Conversational', hint: 'Startups, mission-driven' },
  { value: 'creative',       label: 'Creative',       hint: 'Marketing, design, media' },
  { value: 'concise',        label: 'Concise',        hint: 'Tight, direct, no filler' },
  { value: 'academic',       label: 'Academic',       hint: 'Research, R&D, policy' },
];

export async function renderAppWriter(el) {
  let savedStyle = 'professional';
  try {
    const ws = await api.resume.getWritingStyle();
    if (ws?.style) savedStyle = ws.style;
  } catch {}

  el.innerHTML = `
  <div class="page-hdr">
    <h1>Job Application Assistance</h1>
    <p>Paste questions from any job application — Workday essays, custom cover letter prompts, open-ended fields — and get AI-tailored answers based on your profile, resume, and writing style.</p>
  </div>

  <div class="grid-2" style="align-items:start;gap:20px">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="section-title" style="margin-bottom:12px">Job Context</div>
        <div class="field" style="margin-bottom:10px">
          <label>Company Name</label>
          <input class="input" id="aw-company" placeholder="e.g. Stripe, Google, Acme Corp">
        </div>
        <div class="field" style="margin-bottom:10px">
          <label>Job Title</label>
          <input class="input" id="aw-job-title" placeholder="e.g. Senior Product Manager">
        </div>
        <div class="field">
          <label>Job Description <span style="font-size:11px;color:var(--text3)">(optional — paste for more targeted answers)</span></label>
          <textarea class="input" id="aw-job-description" rows="4" style="font-size:12.5px" placeholder="Paste the job description or key responsibilities here…"></textarea>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="section-title" style="margin-bottom:12px">Writing Style</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px" id="aw-style-pills">
          ${STYLES.map(s => `<button class="aw-style-pill" data-style="${s.value}" title="${esc(s.hint)}" style="padding:6px 14px;border-radius:20px;border:1.5px solid ${s.value===savedStyle?'var(--acc)':'var(--border)'};background:${s.value===savedStyle?'rgba(10,132,255,.12)':'var(--bg2)'};color:${s.value===savedStyle?'var(--acc)':'var(--text2)'};font-size:12.5px;cursor:pointer;font-weight:${s.value===savedStyle?'600':'400'};transition:all .15s">${esc(s.label)}</button>`).join('')}
        </div>
        <div class="field">
          <label>Style note <span style="font-size:11px;color:var(--text3)">(optional — e.g. "keep under 250 words", "use first-person throughout")</span></label>
          <input class="input" id="aw-custom-note" placeholder="Any specific constraints or preferences…">
        </div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-bottom:8px">Questions to Answer</div>
        <p style="font-size:12.5px;color:var(--text3);margin-bottom:12px">Paste one or multiple questions — separate them with a blank line. AI answers each one individually.</p>
        <textarea class="input" id="aw-questions" rows="11" style="font-size:13px" placeholder="Why are you interested in this role?

Describe a time you led a complex project under tight deadlines and what the outcome was.

What is your desired compensation range?

Tell us about yourself in 2-3 sentences."></textarea>
        <button class="btn btn-primary" id="aw-generate-btn" style="margin-top:12px;width:100%;gap:8px">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 1l1.5 4.5H13L9.5 8l1.5 4.5L7 10l-4 2.5L4.5 8 1 5.5h4.5z"/></svg>
          Generate Answers
        </button>
      </div>
    </div>

    <div id="aw-results">
      <div class="card" style="text-align:center;padding:48px 32px">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" style="opacity:.25;margin-bottom:16px"><path d="M8 10h28M8 17h28M8 24h20M8 31h14"/></svg>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">Ready to write your answers</div>
        <p style="font-size:12.5px;color:var(--text2);max-width:260px;margin:0 auto">Paste your questions on the left — AI tailors every answer to your resume, profile, and writing voice.</p>
      </div>
    </div>
  </div>`;

  let selectedStyle = savedStyle;

  el.querySelectorAll('.aw-style-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStyle = btn.dataset.style;
      el.querySelectorAll('.aw-style-pill').forEach(p => {
        const on = p.dataset.style === selectedStyle;
        p.style.borderColor = on ? 'var(--acc)' : 'var(--border)';
        p.style.background  = on ? 'rgba(10,132,255,.12)' : 'var(--bg2)';
        p.style.color       = on ? 'var(--acc)' : 'var(--text2)';
        p.style.fontWeight  = on ? '600' : '400';
      });
      api.resume.saveWritingStyle({ style: selectedStyle }).catch(() => {});
    });
  });

  el.querySelector('#aw-generate-btn').addEventListener('click', async () => {
    const questions = el.querySelector('#aw-questions').value.trim();
    if (!questions) return toast('Paste at least one question first', 'error');

    const btn = el.querySelector('#aw-generate-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;display:inline-block;margin-right:8px;vertical-align:middle"></div> Writing answers…';

    const resultsEl = el.querySelector('#aw-results');
    resultsEl.innerHTML = `
      <div class="card" style="text-align:center;padding:48px 32px">
        <div class="spinner" style="margin:0 auto 16px"></div>
        <div style="font-size:13px;color:var(--text2)">Generating tailored answers in your voice…</div>
      </div>`;

    try {
      const customNote = el.querySelector('#aw-custom-note').value.trim();
      const jobContext = {
        company:        el.querySelector('#aw-company').value.trim() || null,
        jobTitle:       el.querySelector('#aw-job-title').value.trim() || null,
        jobDescription: el.querySelector('#aw-job-description').value.trim() || null,
      };
      const r = await api.appWriter.answer({
        questions,
        writingStyle: selectedStyle,
        customNote: customNote || null,
        jobContext,
      });
      const answers = r.answers || [];
      if (!answers.length) {
        resultsEl.innerHTML = '<div class="card"><p style="color:var(--text2)">No answers generated — try rephrasing your questions.</p></div>';
        return;
      }
      resultsEl.innerHTML = answers.map((a, i) => `
        <div class="card" style="margin-bottom:12px" data-answer-idx="${i}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">
            <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3)">Question ${i + 1}</div>
            <button class="btn btn-secondary btn-sm aw-copy-btn" data-idx="${i}" style="flex-shrink:0;white-space:nowrap">Copy</button>
          </div>
          <div style="font-size:12.5px;color:var(--text3);margin-bottom:10px;border-left:2px solid var(--border);padding-left:10px;font-style:italic">${esc(a.question)}</div>
          <div class="aw-answer-text" style="font-size:13.5px;line-height:1.68;white-space:pre-wrap;color:var(--text1)">${esc(a.answer)}</div>
          ${a.wordCount ? `<div style="font-size:11px;color:var(--text4);margin-top:10px">${a.wordCount} words</div>` : ''}
        </div>`).join('');

      resultsEl.querySelectorAll('.aw-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const card = btn.closest('[data-answer-idx]');
          const text = card?.querySelector('.aw-answer-text')?.textContent?.trim() || '';
          navigator.clipboard.writeText(text).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
          }).catch(() => toast('Copy failed — try selecting text manually', 'error'));
        });
      });

      toast(`${answers.length} answer${answers.length > 1 ? 's' : ''} generated`, 'success');
    } catch (e) {
      resultsEl.innerHTML = `<div class="card"><p style="color:var(--rose)">${esc(e.message)}</p></div>`;
      toast(e.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="margin-right:6px"><path d="M7 1l1.5 4.5H13L9.5 8l1.5 4.5L7 10l-4 2.5L4.5 8 1 5.5h4.5z"/></svg>Generate Answers`;
  });
}
