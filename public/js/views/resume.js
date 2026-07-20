import { api } from '../api.js';
import { toast } from '../app.js';

const WRITING_STYLES = [
  { id: 'professional', label: 'Professional',   desc: 'Polished and business-standard. The go-to for most corporate roles.' },
  { id: 'formal',       label: 'Formal',         desc: 'Structured and traditional. Ideal for law, finance, banking, and government.' },
  { id: 'technical',    label: 'Technical',      desc: 'Precise and jargon-comfortable. Best for engineering, data, and IT roles.' },
  { id: 'executive',    label: 'Executive',      desc: 'Strategic and high-level. For Director, VP, and C-suite applications.' },
  { id: 'conversational', label: 'Conversational', desc: 'Warm and approachable. Works well at startups and mission-driven orgs.' },
  { id: 'creative',     label: 'Creative',       desc: 'Narrative-driven and distinctive. For marketing, design, and media roles.' },
  { id: 'concise',      label: 'Concise',        desc: 'Direct and efficiency-focused. Tight sentences — every word earns its place.' },
  { id: 'academic',     label: 'Academic',       desc: 'Research-forward and methodical. For higher education, R&D, and science.' },
];

export async function renderResume(el) {
  let resume = null;
  let coverLetter = null;
  let writingStyleData = { style: 'professional', customNote: '' };
  try { resume = await api.resume.get(); } catch {}
  try { coverLetter = await api.resume.getCoverLetter(); } catch {}
  try { writingStyleData = await api.resume.getWritingStyle(); } catch {}

  const activeStyle = writingStyleData?.style || 'professional';
  const hasCL = coverLetter?.text?.trim();

  el.innerHTML = `
  <div class="page-hdr">
    <h1>Resume &amp; CV</h1>
    <p>Upload, parse, ATS-check, tailor, and export your professional documents.</p>
  </div>

  <!-- Writing Style + Cover Letter row -->
  <div class="grid-2" style="align-items:start;margin-bottom:18px">
    <div class="card">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:10px">
        Application Writing Style
      </div>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        Applied to resume tailoring, cover letters, pitches, and Q&amp;A answers.
      </div>
      <div class="style-pill-grid" id="style-grid">
        ${WRITING_STYLES.map(s => `
          <button class="style-pill${s.id === activeStyle ? ' active' : ''}" data-style="${s.id}" title="${esc(s.desc)}">
            ${esc(s.label)}
          </button>`).join('')}
      </div>
      <div id="style-desc" style="font-size:12px;color:var(--text3);margin-top:10px;min-height:16px">
        ${esc(WRITING_STYLES.find(s => s.id === activeStyle)?.desc || '')}
      </div>
    </div>

    <div class="card">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:10px">
        Cover Letter Writing Sample
        <span style="font-size:10px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--text4);margin-left:6px">Optional — dramatically improves voice matching</span>
      </div>
      <div id="cl-status" style="margin-bottom:10px">
        ${hasCL
          ? `<div class="cl-loaded-bar">
               <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg>
               <span>Sample loaded — <span style="color:var(--text2)">${hasCL.slice(0,50).replace(/\n/g,' ')}…</span></span>
               <div style="display:flex;gap:5px;margin-left:auto">
                 <button class="btn btn-ghost btn-sm" id="cl-edit-btn">Edit</button>
                 <button class="btn btn-ghost btn-sm" id="cl-export-pdf-btn">PDF</button>
                 <button class="btn btn-ghost btn-sm" id="cl-export-docx-btn">DOCX</button>
                 <button class="btn btn-ghost btn-sm" id="cl-remove-btn" style="color:var(--rose)">Remove</button>
               </div>
             </div>
             <div id="cl-edit-area" style="display:none;margin-top:10px">
               <textarea class="input" id="cl-edit-text" style="min-height:160px;font-size:12.5px">${esc(hasCL)}</textarea>
               <div style="display:flex;gap:6px;margin-top:6px">
                 <button class="btn btn-primary btn-sm" id="cl-save-edit-btn">Save Changes</button>
                 <button class="btn btn-ghost btn-sm" id="cl-cancel-edit-btn">Cancel</button>
               </div>
             </div>`
          : `<div style="font-size:12.5px;color:var(--text3)">No sample uploaded. Upload a cover letter you've previously written and your generated applications will mirror your authentic voice.</div>`
        }
      </div>
      <div class="upload-zone upload-zone-sm" id="cl-upload-zone">
        <input type="file" accept=".pdf,.doc,.docx,.txt" id="cl-file-input" style="display:none">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9 3v10M5 7l4-4 4 4"/><path d="M2 15h14"/></svg>
        <span style="font-size:12px;color:var(--text3)">Drop PDF/DOCX/TXT or <button class="btn-inline" onclick="document.getElementById('cl-file-input').click()">choose file</button></span>
      </div>
      <div style="margin-top:10px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:5px">Or paste your cover letter text</div>
        <textarea class="input" id="cl-paste-text" placeholder="Paste a cover letter you've written before…" style="min-height:80px;font-size:12.5px"></textarea>
        <button class="btn btn-secondary btn-sm" id="cl-paste-btn" style="margin-top:6px">Save Sample</button>
      </div>
    </div>
  </div>

  <div class="grid-2" style="align-items:start">
    <div>
      <div class="section-hdr" style="margin-bottom:10px">
        <span class="section-title">Upload Resume</span>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="upload-zone" id="upload-zone">
          <input type="file" accept=".pdf,.doc,.docx,.txt" id="file-input" style="display:none">
          ${resume ? `
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 0">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round"><circle cx="14" cy="14" r="12"/><path d="M9 14l4 4 6-7"/></svg>
            <div style="font-size:13px;font-weight:600;color:var(--green)">Resume uploaded</div>
            <div style="font-size:11.5px;color:var(--text3)">${esc(resume.name || 'Parsed successfully')} · <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="document.getElementById('file-input').click()">Replace</button></div>
          </div>` : `
          <div class="upload-icon" style="color:var(--blue2);margin-bottom:10px">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M16 4v18M8 12l8-8 8 8"/><path d="M4 26h24"/></svg>
          </div>
          <div class="upload-title">Drop your resume here</div>
          <div class="upload-sub">PDF, DOCX, or TXT · or paste text below<br>Also accepts: LinkedIn, GitHub, portfolio links</div>
          <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="document.getElementById('file-input').click()">Choose File</button>`}
        </div>

        <div style="margin-top:14px">
          <div class="link-drop-area" id="link-drop-area">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:6px">Drop URLs or paste links</div>
            <input class="input" id="url-input" placeholder="LinkedIn, GitHub, portfolio URL — press Enter to add" style="font-size:13px">
            <div id="url-tags" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px"></div>
          </div>
        </div>

        <div style="margin-top:14px">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:6px">Or paste resume text</div>
          <textarea class="input" id="paste-text" placeholder="Paste your resume text here…" style="min-height:120px;font-size:13px"></textarea>
          <button class="btn btn-primary btn-sm" id="paste-btn" style="margin-top:8px">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="2" width="8" height="8" rx="1"/><path d="M3.5 1v2M7.5 1v2"/></svg>
            Parse Text
          </button>
        </div>

        <div id="upload-progress" style="display:none;margin-top:12px">
          <div class="ats-meter"><div class="ats-fill" id="upload-fill" style="background:var(--grad-blue);width:0%"></div></div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px" id="upload-msg">Uploading…</div>
        </div>
      </div>

      <div id="ats-section" style="${resume ? '' : 'display:none'}">
        <div class="section-hdr" style="margin-bottom:10px">
          <span class="section-title">ATS Score</span>
          <button class="btn btn-primary btn-sm" id="ats-check-btn">Run Check</button>
        </div>
        <div class="card" id="ats-card">
          <div style="color:var(--text3);font-size:13px">Click "Run Check" to analyze against 12 ATS criteria.</div>
        </div>
      </div>
    </div>

    <div>
      <div id="resume-preview" style="${resume ? '' : 'display:none'}">
        <div class="section-hdr" style="margin-bottom:10px">
          <span class="section-title">Parsed Resume</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" id="edit-resume-btn">Edit</button>
            <button class="btn btn-ghost btn-sm" id="export-resume-pdf-btn">PDF</button>
            <button class="btn btn-ghost btn-sm" id="export-resume-docx-btn">DOCX</button>
            <button class="btn btn-danger btn-sm" id="clear-resume-btn" title="Clear and start over" style="color:var(--rose)">Clear</button>
          </div>
        </div>
        <div class="card" id="resume-card">
          ${resume ? renderResumePreview(resume) : ''}
        </div>
      </div>

    </div>
  </div>

  <!-- Tailor for a Role — full width -->
  <div id="tailor-section" style="${resume ? '' : 'display:none'}">
    <div class="section-hdr" style="margin-top:18px;margin-bottom:10px">
      <span class="section-title">Tailor for a Role</span>
    </div>
    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="field" style="margin:0">
          <label>Job Title</label>
          <input class="input" id="tailor-title" placeholder="e.g. Senior Product Manager" style="font-size:13px">
        </div>
        <div></div>
      </div>
      <div class="field">
        <label>Job Description</label>
        <textarea class="input" id="tailor-jd" placeholder="Paste job description here…" style="min-height:160px;font-size:13px"></textarea>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px">
        <button class="btn btn-primary" id="tailor-btn">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 1L7.5 4.5 11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"/></svg>
          Tailor Resume (ATS-Optimized)
        </button>
        <button class="btn btn-secondary" id="tailor-cl-btn">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 1h8a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1z"/><path d="M3.5 4h5M3.5 6h5M3.5 8h3"/></svg>
          Tailor Cover Letter
        </button>
        <span style="font-size:11px;color:var(--text4)">Rewrites your resume for this specific role and generates a matching cover letter.</span>
      </div>
      <div id="tailor-result" style="display:none;margin-top:14px"></div>
      <div id="cover-letter-result" style="display:none;margin-top:14px"></div>
    </div>
  </div>

  <!-- 4-Persona AI Resume Chain -->
  <div id="chain-section" style="${resume ? '' : 'display:none'}">
    <div class="section-hdr" style="margin-top:28px;margin-bottom:6px">
      <span class="section-title">AI Resume Chain</span>
      <span style="font-size:11px;color:var(--text3);margin-left:8px">4-step deep analysis: Diagnoser → Recruiter → Rewriter → Hiring Manager</span>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:12.5px;color:var(--text2);line-height:1.55;margin-bottom:14px">
        Run your resume through four AI personas that act as an ATS filter, a senior recruiter, an elite resume rewriter (Google XYZ formula), and your actual hiring manager — in sequence. Paste the job description once and get a complete package: ATS audit, match score with 10 phone screen questions, rewritten bullets, and 12 interview questions from the hiring manager.
      </div>
      <div class="field">
        <label>Job Description <span style="color:var(--text4);font-weight:400;font-size:11px">— paste the full JD you're targeting</span></label>
        <textarea class="input" id="chain-jd" placeholder="Paste the job description here…" style="min-height:160px;font-size:13px"></textarea>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        <button class="btn btn-primary" id="chain-run-all-btn">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 1L7.5 4.5 11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"/></svg>
          Run Full Chain
        </button>
        <button class="btn btn-secondary" id="chain-step1-btn" data-tip="Persona 1: ATS Diagnoser">1. Diagnoser</button>
        <button class="btn btn-secondary" id="chain-step2-btn" data-tip="Persona 2: Senior Recruiter">2. Recruiter</button>
        <button class="btn btn-secondary" id="chain-step3-btn" data-tip="Persona 3: XYZ Rewriter">3. Rewriter</button>
        <button class="btn btn-secondary" id="chain-step4-btn" data-tip="Persona 4: Hiring Manager">4. Hiring Manager</button>
      </div>
    </div>
    <div id="chain-results"></div>
  </div>`;

  function onResumeLoaded(r) {
    resume = r;
    el.querySelector('#resume-card').innerHTML = renderResumePreview(r);
    el.querySelector('#resume-preview').style.display = '';
    el.querySelector('#tailor-section').style.display = '';
    el.querySelector('#ats-section').style.display = '';
    el.querySelector('#chain-section').style.display = '';
    // Show a success state in the upload zone so user knows it worked
    const zone = el.querySelector('#upload-zone');
    if (zone) {
      zone.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 0">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round"><circle cx="14" cy="14" r="12"/><path d="M9 14l4 4 6-7"/></svg>
        <div style="font-size:13px;font-weight:600;color:var(--green)">Resume uploaded</div>
        <div style="font-size:11.5px;color:var(--text3)">${esc(r.name || 'Parsed successfully')} · <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="document.getElementById('file-input').click()">Replace</button></div>
      </div>`;
    }
    if (r.warning) {
      // AI parsing failed but file was read — show warning banner, not error
      const warn = document.createElement('div');
      warn.style.cssText = 'margin:0 0 14px;padding:10px 14px;background:color-mix(in oklab,var(--amber) 10%,var(--bg2));border:1px solid var(--amber);border-radius:var(--r-md);font-size:12.5px;color:var(--text2);line-height:1.5';
      warn.innerHTML = `<strong style="color:var(--amber)">Partial upload:</strong> ${esc(r.warning)}`;
      el.querySelector('#resume-preview').prepend(warn);
      toast('File read — configure AI provider for full extraction', 'warning');
    } else {
      toast('Resume parsed successfully', 'success');
    }
  }

  setupUpload(el, onResumeLoaded);

  el.querySelector('#paste-btn').addEventListener('click', async () => {
    const text = el.querySelector('#paste-text').value.trim();
    if (!text) { toast('Paste your resume text first', 'error'); return; }
    const btn = el.querySelector('#paste-btn');
    btn.disabled = true;
    try {
      const r = await api.resume.upload(text);
      onResumeLoaded(r);
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false;
  });

  el.querySelector('#ats-check-btn')?.addEventListener('click', async () => {
    const card = el.querySelector('#ats-card');
    card.innerHTML = `<div class="loading-row"><div class="spinner"></div> Running ATS check…</div>`;
    try {
      const r = await api.resume.atsCheck();
      card.innerHTML = renderAtsResult(r);
    } catch (e) { card.innerHTML = `<div style="color:var(--rose);font-size:13px">${esc(e.message)}</div>`; }
  });

  el.querySelector('#tailor-btn').addEventListener('click', async () => {
    const title = el.querySelector('#tailor-title').value.trim();
    const jd    = el.querySelector('#tailor-jd').value.trim();
    if (!jd) { toast('Paste a job description to tailor against', 'error'); return; }
    const res = el.querySelector('#tailor-result');
    const btn = el.querySelector('#tailor-btn');
    btn.disabled = true;
    res.style.display = ''; res.innerHTML = `<div class="loading-row"><div class="spinner"></div> Tailoring resume…</div>`;
    try {
      const r = await api.resume.tailor({ title, description: jd, writingStyle: el.querySelector('.style-pill.active')?.dataset.style || activeStyle });
      res.innerHTML = renderTailoredResume(r, 'tailor');
      res.querySelector('#copy-tailor')?.addEventListener('click', () => {
        const plain = buildPlainText(r);
        navigator.clipboard.writeText(plain).then(() => toast('Copied', 'success'));
      });
      res.querySelector('#dl-tailor-pdf')?.addEventListener('click', () => window.open('/api/resume/export/pdf?tailored=1', '_blank'));
      res.querySelector('#dl-tailor-docx')?.addEventListener('click', () => window.open('/api/resume/export/docx?tailored=1', '_blank'));
      res.querySelector('#dismiss-tailor')?.addEventListener('click', () => { res.style.display = 'none'; });
      // Cache tailored data for export
      window._tailoredResume = r;

      // Auto ATS-score the TAILORED resume so every application-ready version
      // ships with its own score — not just the base resume.
      const scoreSlot = document.createElement('div');
      scoreSlot.id = 'tailored-ats-score';
      scoreSlot.style.cssText = 'margin-top:10px';
      scoreSlot.innerHTML = `<div class="loading-row" style="font-size:12px"><div class="spinner"></div> ATS-scoring the tailored version…</div>`;
      res.prepend(scoreSlot);
      api.resume.atsCheck(r).then(ats => {
        const c = (ats.score ?? 0) >= 80 ? '#34d399' : (ats.score ?? 0) >= 60 ? 'var(--blue)' : 'var(--amber)';
        scoreSlot.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:color-mix(in oklab,${c} 8%,transparent);border:1px solid color-mix(in oklab,${c} 30%,transparent);border-radius:8px">
            <span style="font-size:16px;font-weight:800;color:${c}">${ats.score ?? '—'}/100</span>
            <span style="font-size:11px;font-weight:700;color:${c}">ATS ${esc(ats.grade || '')}</span>
            <span style="font-size:11.5px;color:var(--text2);flex:1">${esc((ats.recommendation || '').slice(0, 160))}</span>
          </div>`;
      }).catch(() => { scoreSlot.remove(); });
    } catch (e) { res.innerHTML = `<div style="color:var(--rose);font-size:13px">${esc(e.message)}</div>`; }
    finally { btn.disabled = false; }
  });

  el.querySelector('#tailor-cl-btn').addEventListener('click', async () => {
    const jd  = el.querySelector('#tailor-jd').value.trim();
    if (!jd) { toast('Paste a job description first', 'error'); return; }
    const title = el.querySelector('#tailor-title').value.trim();
    const clRes = el.querySelector('#cover-letter-result');
    const btn   = el.querySelector('#tailor-cl-btn');
    btn.disabled = true;
    clRes.style.display = '';
    clRes.innerHTML = `<div class="loading-row"><div class="spinner"></div> Writing cover letter…</div>`;
    try {
      const { coverLetter } = await api.resume.generateCoverLetter({ title, description: jd });
      clRes.innerHTML = `
        <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:10px">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3)">Generated Cover Letter</div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" id="copy-cl-btn">Copy</button>
              <button class="btn btn-ghost btn-sm" id="dismiss-cl-btn">Dismiss</button>
            </div>
          </div>
          <div style="font-size:13.5px;line-height:1.75;white-space:pre-wrap;color:var(--text1);background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 20px" id="cl-generated-text">${esc(coverLetter)}</div>
        </div>`;
      clRes.querySelector('#copy-cl-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(coverLetter).then(() => toast('Cover letter copied', 'success'));
      });
      clRes.querySelector('#dismiss-cl-btn').addEventListener('click', () => { clRes.style.display = 'none'; });
      toast('Cover letter generated', 'success');
    } catch (e) {
      clRes.innerHTML = `<div style="color:var(--rose);font-size:13px">${esc(e.message)}</div>`;
      toast(e.message, 'error');
    }
    finally { btn.disabled = false; }
  });

  el.querySelector('#export-resume-pdf-btn')?.addEventListener('click', () => api.resume.exportPdf());
  el.querySelector('#export-resume-docx-btn')?.addEventListener('click', () => api.resume.exportDocx());

  el.querySelector('#clear-resume-btn')?.addEventListener('click', async () => {
    if (!confirm('Clear your resume and start over? This cannot be undone.')) return;
    try {
      await api.resume.clear();
      resume = null;
      el.querySelector('#resume-preview').style.display = 'none';
      el.querySelector('#tailor-section').style.display = 'none';
      el.querySelector('#ats-section').style.display = 'none';
      el.querySelector('#chain-section').style.display = 'none';
      toast('Resume cleared', 'info');
    } catch (e) { toast(e.message, 'error'); }
  });

  el.querySelector('#edit-resume-btn')?.addEventListener('click', () => {
    const card = el.querySelector('#resume-card');
    const r = resume;
    if (!r) return;
    card.innerHTML = renderResumeEditForm(r);
    el.querySelector('#edit-resume-btn').textContent = 'Cancel';
    el.querySelector('#edit-resume-btn').onclick = () => {
      card.innerHTML = renderResumePreview(resume);
      el.querySelector('#edit-resume-btn').textContent = 'Edit';
      el.querySelector('#edit-resume-btn').onclick = null;
      el.querySelector('#edit-resume-btn').addEventListener('click', arguments.callee);
    };
    // Save button
    card.querySelector('#resume-edit-save')?.addEventListener('click', async () => {
      const updated = readResumeEditForm(card, resume);
      try {
        const saved = await api.resume.update(updated);
        resume = { ...resume, ...updated };
        card.innerHTML = renderResumePreview(resume);
        el.querySelector('#edit-resume-btn').textContent = 'Edit';
        el.querySelector('#edit-resume-btn').onclick = null;
        toast('Resume saved', 'success');
      } catch (e) { toast('Save failed: ' + e.message, 'error'); }
    });
    card.querySelector('#resume-edit-cancel')?.addEventListener('click', () => {
      card.innerHTML = renderResumePreview(resume);
      el.querySelector('#edit-resume-btn').textContent = 'Edit';
      el.querySelector('#edit-resume-btn').onclick = null;
    });
  });

  setupUrlInput(el);
  setupWritingStyle(el);
  setupCoverLetterSample(el);
  // setupChain wires buttons — call now if resume exists, else defer to first show of chain-section
  let chainWired = false;
  const wireChain = () => { if (!chainWired) { chainWired = true; setupChain(el); } };
  if (resume) wireChain();
  // Also wire when upload/paste makes the section visible
  const origUploadCb = () => wireChain();
  el.querySelector('#chain-section')?.addEventListener('click', wireChain, { once: true });
}

// ── 4-Persona Chain ──────────────────────────────────────────
function setupChain(el) {
  const getJD   = () => el.querySelector('#chain-jd')?.value?.trim() || '';
  const results = el.querySelector('#chain-results');

  function setLoading(step, label) {
    results.innerHTML += `<div id="chain-loading-${step}" class="card" style="margin-bottom:12px">
      <div class="loading-row"><div class="spinner"></div> <span style="color:var(--text3)">${esc(label)}</span></div>
    </div>`;
  }

  function replaceLoading(step, html) {
    const el2 = document.getElementById(`chain-loading-${step}`);
    if (el2) el2.outerHTML = html;
    else results.innerHTML += html;
  }

  function severityColor(s) {
    return s === 'high' ? 'var(--rose)' : s === 'medium' ? 'var(--amber)' : 'var(--text3)';
  }

  function renderDiagnoser(r) {
    const riskColor = r.overallRisk === 'high' ? 'var(--rose)' : r.overallRisk === 'medium' ? 'var(--amber)' : 'var(--green)';
    const issues = [...(r.formattingIssues || []), ...(r.contentIssues || [])];
    return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:8px;height:8px;border-radius:50%;background:${riskColor}"></div>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3)">Persona 1 — ATS Diagnoser</span>
        <span class="chip" style="background:color-mix(in oklab,${riskColor} 15%,transparent);color:${riskColor};border:1px solid ${riskColor};font-size:10px">${esc(r.overallRisk?.toUpperCase() || '')} RISK</span>
      </div>
      ${r.summary ? `<div style="font-size:13px;color:var(--text2);line-height:1.55;margin-bottom:12px">${esc(r.summary)}</div>` : ''}
      ${issues.length ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Issues to Fix</div>
        ${issues.map(i => `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;padding:8px 10px;background:var(--bg3);border-radius:var(--r-md);border-left:3px solid ${severityColor(i.severity)}">
          <div style="flex:1">
            <div style="font-size:12.5px;color:var(--text)">${esc(i.issue)}</div>
            <div style="font-size:11.5px;color:var(--text3);margin-top:3px">Fix: ${esc(i.fix)}</div>
          </div>
        </div>`).join('')}` : ''}
      ${(r.vagueLanguage || []).length ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-top:12px;margin-bottom:8px">Vague Language</div>
        ${r.vagueLanguage.map(v => `<div style="display:flex;gap:8px;font-size:12px;margin-bottom:6px">
          <span style="color:var(--rose);text-decoration:line-through">${esc(v.original)}</span>
          <span style="color:var(--text4)">→</span>
          <span style="color:var(--green)">${esc(v.suggestedReplacement)}</span>
        </div>`).join('')}` : ''}
      ${(r.missingRequirements || []).length ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-top:12px;margin-bottom:8px">Missing JD Requirements</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${r.missingRequirements.map(m => {
          const label = typeof m === 'string' ? m : (m.requirement || m.text || m.skill || JSON.stringify(m));
          return `<span class="chip" style="background:color-mix(in oklab,var(--rose) 10%,transparent);color:var(--rose);border:1px solid var(--rose);font-size:11px">${esc(label)}</span>`;
        }).join('')}</div>` : ''}
      ${(r.passedChecks || []).length ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-top:12px;margin-bottom:6px">Passing Checks</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${r.passedChecks.map(p => {
          const label = typeof p === 'string' ? p : (p.check || p.text || JSON.stringify(p));
          return `<span class="chip chip-green" style="font-size:11px">${esc(label)}</span>`;
        }).join('')}</div>` : ''}
    </div>`;
  }

  function renderRecruiter(r) {
    const gradeColor = { A: 'var(--green)', B: 'var(--teal)', C: 'var(--amber)', D: 'var(--amber)', F: 'var(--rose)' }[r.matchGrade] || 'var(--text3)';
    const recColor   = r.recommendation === 'strong-apply' ? 'var(--green)' : r.recommendation === 'apply' ? 'var(--teal)' : r.recommendation === 'revise-first' ? 'var(--amber)' : 'var(--rose)';
    return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3)">Persona 2 — Senior Recruiter</span>
        <span class="chip" style="background:color-mix(in oklab,${gradeColor} 15%,transparent);color:${gradeColor};border:1px solid ${gradeColor};font-size:12px;font-weight:700">${r.matchScore}/100 · ${r.matchGrade}</span>
        <span class="chip" style="background:color-mix(in oklab,${recColor} 12%,transparent);color:${recColor};font-size:10px">${esc(r.recommendation?.replace(/-/g,' ').toUpperCase() || '')}</span>
      </div>
      ${r.scoreSummary ? `<div style="font-size:13px;color:var(--text2);margin-bottom:10px;line-height:1.6">${esc(r.scoreSummary)}</div>` : ''}
      ${r.experienceGapAnalysis ? `<div style="font-size:12.5px;color:var(--text2);margin-bottom:8px;padding:8px 12px;background:var(--bg3);border-radius:var(--r-md);border-left:3px solid var(--blue)"><span style="font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;display:block;margin-bottom:3px">Experience Gap</span>${esc(r.experienceGapAnalysis)}</div>` : ''}
      ${r.skillGapAnalysis ? `<div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;padding:8px 12px;background:var(--bg3);border-radius:var(--r-md);border-left:3px solid var(--amber)"><span style="font-size:10px;font-weight:700;color:var(--amber);text-transform:uppercase;display:block;margin-bottom:3px">Skill Gap</span>${esc(r.skillGapAnalysis)}</div>` : ''}
      ${(r.topMissingKeywords || []).length ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Top Missing Keywords</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">${r.topMissingKeywords.map(k => {
          const kw = typeof k === 'string' ? k : k.keyword;
          const pr = typeof k === 'object' ? k.priority : '';
          const c  = pr === 'must-have' ? 'var(--rose)' : 'var(--amber)';
          return `<span class="chip" style="background:color-mix(in oklab,${c} 10%,transparent);color:${c};border:1px solid ${c};font-size:11px">${esc(kw)}${pr === 'must-have' ? ' ★' : ''}</span>`;
        }).join('')}</div>` : ''}
      ${(r.recruiterRedFlags || []).length ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Recruiter Red Flags</div>
        ${r.recruiterRedFlags.map(f => {
          const flag = typeof f === 'string' ? f : f.flag;
          const impact = typeof f === 'object' ? f.impact : '';
          const ic = impact === 'eliminates' ? 'var(--rose)' : impact === 'hurts' ? 'var(--amber)' : 'var(--text3)';
          return `<div style="font-size:12.5px;color:var(--text);padding:6px 10px;background:var(--bg3);border-radius:var(--r-md);margin-bottom:6px;border-left:3px solid ${ic}">${esc(flag)}${impact ? ` <span style="font-size:10px;color:${ic}">(${impact})</span>` : ''}</div>`;
        }).join('')}` : ''}
      ${r.competitiveAdvantage ? `<div style="margin-top:10px;font-size:12.5px;color:var(--text3);line-height:1.5;padding:8px 10px;background:var(--bg3);border-radius:var(--r-md);border-left:3px solid var(--teal)">${esc(r.competitiveAdvantage)}</div>` : ''}
      ${(r.phoneScreenQuestions || []).length ? `<div style="margin-top:16px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Phone Screen Questions (${r.phoneScreenQuestions.length})</div>
        ${r.phoneScreenQuestions.map((q, i) => `
          <details style="margin-bottom:6px;padding:8px 12px;background:var(--bg3);border-radius:var(--r-md);border:1px solid var(--line)">
            <summary style="cursor:pointer;list-style:none;display:flex;align-items:flex-start;gap:8px">
              <span style="font-size:11px;color:var(--text4);min-width:16px">${i+1}.</span>
              <span style="font-size:12.5px;color:var(--text);flex:1">${esc(q.question)}</span>
            </summary>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">
              ${q.purpose ? `<div style="font-size:11px;color:var(--text3);margin-bottom:4px"><b>Testing:</b> ${esc(q.purpose)}</div>` : ''}
              ${q.idealAnswer ? `<div style="font-size:11px;color:var(--green)"><b>Ideal answer:</b> ${esc(q.idealAnswer)}</div>` : ''}
            </div>
          </details>`).join('')}
      </div>` : ''}
    </div>`;
  }

  function renderRewriter(r) {
    const exps = r.rewrittenExperience || [];
    return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3)">Persona 3 — XYZ Rewriter</span>
        <span class="chip chip-blue" style="font-size:10px">Google XYZ Formula</span>
      </div>
      ${r.summary ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:6px">Rewritten Summary</div>
        <div style="font-size:12.5px;color:var(--text2);line-height:1.55;padding:10px;background:var(--bg3);border-radius:var(--r-md);margin-bottom:14px">${esc(r.summary)}
          <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="navigator.clipboard.writeText(${JSON.stringify(r.summary)}).then(()=>window.alexToast?.('Copied','success'))">Copy</button>
        </div>` : ''}
      ${exps.map(exp => `
        <div style="margin-bottom:14px;padding:12px;background:var(--bg3);border-radius:var(--r-md)">
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">${esc(exp.title || '')} <span style="color:var(--text3);font-weight:400">@ ${esc(exp.company || '')}</span></div>
          <div style="font-size:11px;color:var(--text4);margin-bottom:8px">${esc(fmtDates(exp.dates))}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--rose);margin-bottom:5px">Before</div>
              ${(exp.originalBullets || []).map(b => `<div style="font-size:12px;color:var(--text3);padding:3px 0;border-bottom:1px solid var(--line)">• ${esc(b)}</div>`).join('')}
            </div>
            <div>
              <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--green);margin-bottom:5px">After (XYZ)</div>
              ${(exp.rewrittenBullets || []).map(b => `<div style="font-size:12px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--line)">• ${esc(b)}</div>`).join('')}
            </div>
          </div>
          ${(exp.keywordsIntegrated || []).length ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">${exp.keywordsIntegrated.map(k => `<span class="chip chip-teal" style="font-size:10px">${esc(k)}</span>`).join('')}</div>` : ''}
        </div>`).join('')}
      <button class="btn btn-secondary btn-sm" id="copy-rewriter-btn">Copy All Rewritten Bullets</button>
    </div>`;
  }

  function renderHiringManager(r) {
    return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3)">Persona 4 — Hiring Manager</span>
        <span class="chip chip-amber" style="font-size:10px">20 Interview Questions</span>
      </div>
      ${r.interviewerTone ? `<div style="font-size:12.5px;color:var(--text3);font-style:italic;margin-bottom:14px;padding:8px 12px;background:var(--bg3);border-radius:var(--r-md)">"${esc(r.interviewerTone)}"</div>` : ''}
      ${!(r.questions || []).length ? `<div style="font-size:12.5px;color:var(--rose);padding:10px 12px;background:color-mix(in oklab,var(--rose) 8%,transparent);border-radius:var(--r-md)">${esc(r._error || 'No interview questions were returned. Re-run this step.')}</div>` : ''}
      ${(r.questions || []).map(q => `
        <div style="margin-bottom:12px;padding:12px 14px;background:var(--bg3);border-radius:var(--r-md);border:1px solid var(--line)">
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
            <span class="chip" style="font-size:11px;min-width:22px;text-align:center;background:var(--bg4);flex-shrink:0">${q.number}</span>
            <span style="font-size:13px;color:var(--text);font-weight:500;flex:1">${esc(q.question)}</span>
            <span class="chip" style="font-size:10px;background:color-mix(in oklab,var(--rose) 10%,transparent);color:var(--rose);flex-shrink:0">${esc(q.difficulty)}</span>
            <span class="chip chip-blue" style="font-size:10px;flex-shrink:0">${esc(q.type)}</span>
          </div>
          <div style="padding-top:10px;border-top:1px solid var(--line)">
            <div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:4px">What they're testing</div>
            <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px">${esc(q.whatTheyAreTesting || '')}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <div style="font-size:10px;font-weight:600;color:var(--green);margin-bottom:4px">✓ STRONG ANSWER</div>
                <div style="font-size:12px;color:var(--text2);line-height:1.5">${esc(q.strongAnswer || '')}</div>
              </div>
              <div>
                <div style="font-size:10px;font-weight:600;color:var(--rose);margin-bottom:4px">✗ WEAK ANSWER</div>
                <div style="font-size:12px;color:var(--text3);line-height:1.5">${esc(q.weakAnswer || '')}</div>
              </div>
            </div>
            ${q.followUp ? `<div style="margin-top:8px;font-size:12px;color:var(--amber)">↳ Follow-up: ${esc(q.followUp)}</div>` : ''}
          </div>
        </div>`).join('')}
      ${r.eliminationCriteria ? `<div style="margin-top:8px;padding:10px 12px;background:color-mix(in oklab,var(--rose) 8%,transparent);border-radius:var(--r-md);border:1px solid var(--rose)">
        <div style="font-size:10px;font-weight:600;color:var(--rose);margin-bottom:4px">INSTANT DISQUALIFIERS</div>
        <div style="font-size:12.5px;color:var(--text2)">${esc(r.eliminationCriteria)}</div>
      </div>` : ''}
    </div>`;
  }

  async function runStep(step, label, apiFn, renderFn) {
    const jd = getJD();
    results.innerHTML = '';
    setLoading(step, `Running ${label}…`);
    try {
      const r = await apiFn(jd);
      replaceLoading(step, renderFn(r));
      // wire up copy button if present
      const copyBtn = document.getElementById('copy-rewriter-btn');
      if (copyBtn) {
        copyBtn.onclick = () => {
          const text = (r.rewrittenExperience || []).flatMap(e => e.rewrittenBullets || []).join('\n');
          navigator.clipboard.writeText(text).then(() => toast('Copied', 'success'));
        };
      }
      return r;
    } catch (e) {
      replaceLoading(step, `<div class="card" style="margin-bottom:12px;color:var(--rose);font-size:13px">${label} failed: ${esc(e.message)}</div>`);
      return null;
    }
  }

  el.querySelector('#chain-step1-btn').addEventListener('click', () =>
    runStep(1, 'ATS Diagnoser', jd => api.resume.chainDiagnoser(jd), renderDiagnoser));

  el.querySelector('#chain-step2-btn').addEventListener('click', () =>
    runStep(2, 'Senior Recruiter', jd => api.resume.chainRecruiter(jd), renderRecruiter));

  el.querySelector('#chain-step3-btn').addEventListener('click', () =>
    runStep(3, 'XYZ Rewriter', jd => api.resume.chainRewriter(jd, []), renderRewriter));

  el.querySelector('#chain-step4-btn').addEventListener('click', () =>
    runStep(4, 'Hiring Manager', jd => api.resume.chainHiringManager(jd), renderHiringManager));

  el.querySelector('#chain-run-all-btn').addEventListener('click', async () => {
    const jd = getJD();
    if (!jd) { toast('Paste a job description first', 'error'); return; }
    // Warn if no resume is loaded
    try {
      const rv = await api.resume.get();
      if (!rv || (!rv.experience?.length && !rv.summary && !rv.skills?.length)) {
        toast('Upload your resume first — chain requires resume content to analyze', 'error');
        return;
      }
    } catch { /* proceed anyway — server will reject if needed */ }
    results.innerHTML = '';
    const allBtns = el.querySelectorAll('#chain-run-all-btn,#chain-step1-btn,#chain-step2-btn,#chain-step3-btn,#chain-step4-btn');
    allBtns.forEach(b => { b.disabled = true; });

    try {
      // Step 1: Diagnoser
      setLoading(1, 'Persona 1: ATS Diagnoser scanning your resume…');
      let d = {};
      try {
        d = await api.resume.chainDiagnoser(jd) || {};
      } catch (e) {
        console.error('Diagnoser failed:', e);
        d = { overallRisk: 'unknown', summary: 'Diagnoser failed — check console or try again.' };
      }
      replaceLoading(1, renderDiagnoser(d));

      // Step 2: Recruiter
      setLoading(2, 'Persona 2: Senior Recruiter analyzing keyword gaps…');
      let rec = {};
      try {
        rec = await api.resume.chainRecruiter(jd) || {};
      } catch (e) {
        console.error('Recruiter failed:', e);
        rec = { matchScore: 0, matchGrade: '?', recommendation: 'unknown', scoreSummary: 'Recruiter analysis failed — check console or try again.' };
      }
      replaceLoading(2, renderRecruiter(rec));

      // Step 3: Rewriter — pass missing keywords from recruiter
      const missingKws = (rec?.topMissingKeywords || []);
      setLoading(3, 'Persona 3: XYZ Rewriter rewriting bullets with missing keywords…');
      let rw = {};
      try {
        rw = await api.resume.chainRewriter(jd, missingKws) || {};
      } catch (e) {
        console.error('Rewriter failed:', e);
        rw = { rewrittenExperience: [], summary: '' };
      }
      replaceLoading(3, renderRewriter(rw));
      const copyBtn = document.getElementById('copy-rewriter-btn');
      if (copyBtn) {
        copyBtn.onclick = () => {
          const text = (rw.rewrittenExperience || []).flatMap(e => e.rewrittenBullets || []).join('\n');
          navigator.clipboard.writeText(text).then(() => toast('Copied', 'success'));
        };
      }

      // Step 4: Hiring Manager
      setLoading(4, 'Persona 4: Hiring Manager preparing your interview questions…');
      let hm = {};
      try {
        hm = await api.resume.chainHiringManager(jd) || {};
      } catch (e) {
        console.error('Hiring Manager failed:', e);
        hm = { questions: [], interviewerTone: 'Hiring Manager analysis failed — check console or try again.' };
      }
      replaceLoading(4, renderHiringManager(hm));

      // "Apply to Resume" action card — lets user selectively apply rewriter output
      const applyCard = document.createElement('div');
      applyCard.className = 'card';
      applyCard.style.cssText = 'margin-bottom:12px;border:1px solid rgba(99,102,241,.35);background:rgba(99,102,241,.06)';
      applyCard.innerHTML = `
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">Apply Rewritten Bullets to Your Resume?</div>
        <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px">
          The XYZ Rewriter produced improved bullets. Select which experience entries you'd like to update in your saved resume, then click Apply.
        </div>
        ${(rw.rewrittenExperience || []).map((exp, i) => `
          <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;cursor:pointer">
            <input type="checkbox" data-rw-idx="${i}" style="margin-top:3px" checked>
            <div>
              <div style="font-size:12.5px;font-weight:600">${esc(exp.title || '')} @ ${esc(exp.company || '')}</div>
              <div style="font-size:11.5px;color:var(--text3)">${(exp.rewrittenBullets || []).length} bullets rewritten</div>
            </div>
          </label>`).join('')}
        ${rw.summary ? `<label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;cursor:pointer">
            <input type="checkbox" id="rw-apply-summary" style="margin-top:3px" checked>
            <div><div style="font-size:12.5px;font-weight:600">Professional Summary</div><div style="font-size:11.5px;color:var(--text3)">${esc(rw.summary.slice(0,80))}…</div></div>
          </label>` : ''}
        <button class="btn btn-primary btn-sm" id="chain-apply-btn">Apply Selected to Resume</button>
        <button class="btn btn-ghost btn-sm" style="margin-left:8px" id="chain-dismiss-btn">Dismiss</button>`;
      results.appendChild(applyCard);

      applyCard.querySelector('#chain-dismiss-btn')?.addEventListener('click', () => applyCard.remove());
      applyCard.querySelector('#chain-apply-btn')?.addEventListener('click', async () => {
        try {
          const current = await api.resume.get();
          const checked = [...applyCard.querySelectorAll('input[data-rw-idx]:checked')].map(c => parseInt(c.dataset.rwIdx));
          const newExp = (current.experience || []).map(orig => {
            const rwEntry = (rw.rewrittenExperience || []).find((r, i) =>
              checked.includes(i) && r.company === orig.company && r.title === orig.title
            );
            return rwEntry ? { ...orig, bullets: rwEntry.rewrittenBullets } : orig;
          });
          const patch = { experience: newExp };
          if (rw.summary && applyCard.querySelector('#rw-apply-summary')?.checked) patch.summary = rw.summary;
          const updated = await api.resume.update(patch);
          toast('Resume updated with rewritten bullets', 'success');

          // Reflect the change immediately in the resume panel, and offer downloads.
          const freshResume = updated?.resume || updated || { ...(await api.resume.get()) };
          const card = document.getElementById('resume-card');
          const preview = document.getElementById('resume-preview');
          if (card) card.innerHTML = renderResumePreview(freshResume);
          if (preview) preview.style.display = '';

          applyCard.innerHTML = `
            <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--green)">✓ Resume updated</div>
            <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px">Your saved resume now reflects the rewritten bullets. Download the updated document:</div>
            <button class="btn btn-primary btn-sm" id="chain-dl-pdf">Download PDF</button>
            <button class="btn btn-primary btn-sm" id="chain-dl-docx" style="margin-left:8px">Download DOCX</button>
            <button class="btn btn-ghost btn-sm" id="chain-apply-done" style="margin-left:8px">Done</button>`;
          applyCard.querySelector('#chain-dl-pdf')?.addEventListener('click', () => api.resume.exportPdf());
          applyCard.querySelector('#chain-dl-docx')?.addEventListener('click', () => api.resume.exportDocx());
          applyCard.querySelector('#chain-apply-done')?.addEventListener('click', () => applyCard.remove());
          card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) { toast('Failed to apply: ' + e.message, 'error'); }
      });

      toast('AI Resume Chain complete', 'success');
    } finally {
      allBtns.forEach(b => { b.disabled = false; });
    }
  });
}

function setupUpload(el, onSuccess) {
  const zone  = el.querySelector('#upload-zone');
  const input = el.querySelector('#file-input');
  const prog  = el.querySelector('#upload-progress');
  const fill  = el.querySelector('#upload-fill');
  const msg   = el.querySelector('#upload-msg');

  const doUpload = async file => {
    prog.style.display = ''; fill.style.width = '5%'; msg.textContent = 'Uploading…';
    try {
      const r = await api.resume.upload(file, p => { fill.style.width = (p * 80 + 10) + '%'; });
      fill.style.width = '100%'; msg.textContent = 'Done!';
      setTimeout(() => { prog.style.display = 'none'; }, 1200);
      onSuccess(r);
    } catch (e) { msg.textContent = 'Error: ' + e.message; }
  };

  input.addEventListener('change', e => { if (e.target.files[0]) doUpload(e.target.files[0]); });
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop',      e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    const url  = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (file) doUpload(file);
    else if (url) addUrlTag(el, url.trim());
  });
}

function setupUrlInput(el) {
  const input = el.querySelector('#url-input');
  const area  = el.querySelector('#link-drop-area');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addUrlTag(el, input.value.trim()); input.value = ''; }
  });
  area.addEventListener('dragover',  e => { e.preventDefault(); area.classList.add('active'); });
  area.addEventListener('dragleave', () => area.classList.remove('active'));
  area.addEventListener('drop',      e => {
    e.preventDefault(); area.classList.remove('active');
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url) addUrlTag(el, url.trim());
  });
}

function addUrlTag(el, url) {
  if (!url || !url.startsWith('http')) return;
  const tags = el.querySelector('#url-tags');
  const tag  = document.createElement('span');
  tag.className = 'chip chip-teal';
  const display = url.replace(/^https?:\/\//, '').slice(0, 40);
  tag.innerHTML = `${esc(display)}<button type="button" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:4px">&times;</button>`;
  tag.querySelector('button').onclick = () => tag.remove();
  tags.appendChild(tag);
  api.profile.scrapeUrl(url)
    .then(() => { import('../app.js').then(m => m.toast('Profile enriched from URL', 'success')); })
    .catch(() => {});
}

function renderResumePreview(r) {
  if (!r || !r.name) return '<div style="color:var(--text3);font-size:13px">No resume data yet.</div>';
  const contact = [r.phone, r.email, r.location, r.linkedin].map(txt).filter(Boolean).map(esc).join(' · ');
  return `
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:2px">${esc(txt(r.name))}</div>
    ${contact ? `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">${contact}</div>` : ''}
    ${r.summary ? `<div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.55">${esc(txt(r.summary))}</div>` : ''}
    ${txtList(r.skills).length ? `
    <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:6px">Skills</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
      ${txtList(r.skills).map(s => `<span class="chip chip-blue">${esc(s)}</span>`).join('')}
    </div>` : ''}
    ${Array.isArray(r.experience) && r.experience.length ? `
    <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Experience</div>
    ${r.experience.map(e => `
      <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(txt(e.title))} <span style="color:var(--text3);font-weight:400">at</span> ${esc(txt(e.company))}</div>
        <div style="font-size:11.5px;color:var(--text3);margin-bottom:4px">${esc(fmtDates(e.dates))}${e.location ? ' · ' + esc(txt(e.location)) : ''}</div>
        ${txtList(e.bullets).length ? `<ul style="margin:0;padding-left:16px;display:flex;flex-direction:column;gap:2px">
          ${txtList(e.bullets).map(b => `<li style="font-size:12px;color:var(--text2);line-height:1.45">${esc(b)}</li>`).join('')}
        </ul>` : ''}
      </div>`).join('')}` : ''}
    ${Array.isArray(r.education) && r.education.length ? `
    <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin:12px 0 6px">Education</div>
    ${r.education.map(e => `
      <div style="margin-bottom:6px">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(e.degree || e.institution || '')}</div>
        <div style="font-size:11.5px;color:var(--text3)">${esc(e.institution || '')} ${e.year ? '· ' + esc(e.year) : ''}</div>
        ${e.honors ? `<div style="font-size:11.5px;color:var(--text3)">${esc(e.honors)}</div>` : ''}
      </div>`).join('')}` : ''}
    ${r.certifications?.length ? `
    <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin:12px 0 6px">Certifications</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">
      ${r.certifications.map(c => `<span class="chip chip-green">${esc(typeof c === 'string' ? c : c.name || '')}</span>`).join('')}
    </div>` : ''}
    ${r.honors?.length ? `
    <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin:12px 0 6px">Honors &amp; Awards</div>
    <ul style="margin:0;padding-left:16px">
      ${r.honors.map(h => `<li style="font-size:12px;color:var(--text2)">${esc(typeof h === 'string' ? h : h.title || '')}</li>`).join('')}
    </ul>` : ''}
    ${r.community?.length || r.activities?.length ? `
    <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin:12px 0 6px">Community &amp; Activities</div>
    <ul style="margin:0;padding-left:16px">
      ${(r.community || r.activities || []).map(a => `<li style="font-size:12px;color:var(--text2)">${esc(typeof a === 'string' ? a : a.title || '')}</li>`).join('')}
    </ul>` : ''}`;
}

function renderTailoredResume(r, type) {
  const label = type === 'cv' ? 'Generated CV' : 'Tailored Resume';
  const hasChanges = r.changesCount || r.keywordsAdded?.length;
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3)">${label}</div>
        ${hasChanges ? `<div style="font-size:12px;color:var(--text3);margin-top:2px">${r.changesCount || 0} changes · ${r.keywordsAdded?.length || 0} keywords added</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" id="copy-tailor">Copy Text</button>
        <button class="btn btn-primary btn-sm" id="dl-tailor-pdf">Download PDF</button>
        <button class="btn btn-primary btn-sm" id="dl-tailor-docx">Download DOCX</button>
        <button class="btn btn-ghost btn-sm" id="dismiss-tailor">Dismiss</button>
      </div>
    </div>
    ${r.changesSummary ? `<div style="font-size:12.5px;color:var(--text2);padding:10px 12px;background:rgba(10,132,255,.06);border:1px solid rgba(10,132,255,.15);border-radius:8px;margin-bottom:12px">${esc(txt(r.changesSummary))}</div>` : ''}
    ${txtList(r.keywordsAdded).length ? `
    <div style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:5px">Keywords Added</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">${txtList(r.keywordsAdded).map(k => `<span class="chip chip-green">${esc(k)}</span>`).join('')}</div>
    </div>` : ''}
    <div style="background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-md);padding:20px 24px;font-family:Georgia,'Times New Roman',serif;color:var(--text)">
      ${r.name ? `<div style="font-size:18px;font-weight:700;text-align:center;margin-bottom:4px">${esc(txt(r.name))}</div>` : ''}
      ${r.contact ? `<div style="font-size:11px;text-align:center;color:var(--text3);margin-bottom:14px">${esc(txt(r.contact))}</div>` : ''}
      ${r.summary ? `
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;border-bottom:1.5px solid var(--line);padding-bottom:3px;margin-bottom:8px">Summary</div>
      <p style="font-size:12.5px;line-height:1.6;margin:0 0 14px">${esc(txt(r.summary))}</p>` : ''}
      ${txtList(r.skills).length ? `
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;border-bottom:1.5px solid var(--line);padding-bottom:3px;margin-bottom:8px">Skills</div>
      <p style="font-size:12px;line-height:1.6;margin:0 0 14px">${txtList(r.skills).map(esc).join(' · ')}</p>` : ''}
      ${Array.isArray(r.experience) && r.experience.length ? `
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;border-bottom:1.5px solid var(--line);padding-bottom:3px;margin-bottom:10px">Experience</div>
      ${r.experience.map(e => `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px">
            <span style="font-size:13px;font-weight:700">${esc(txt(e.title))}</span>
            <span style="font-size:11px;color:var(--text3)">${esc(fmtDates(e.dates))}</span>
          </div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:5px">${esc(txt(e.company))}${e.location ? ' · ' + esc(txt(e.location)) : ''}</div>
          ${txtList(e.bullets).length ? `<ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:2px">
            ${txtList(e.bullets).map(b => `<li style="font-size:12px;line-height:1.5">${esc(b)}</li>`).join('')}
          </ul>` : ''}
        </div>`).join('')}` : ''}
      ${Array.isArray(r.education) && r.education.length ? `
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;border-bottom:1.5px solid var(--line);padding-bottom:3px;margin-bottom:10px;margin-top:4px">Education</div>
      ${r.education.map(e => `
        <div style="margin-bottom:8px">
          <div style="font-size:13px;font-weight:700">${esc(txt(e.degree || e.institution || ''))}</div>
          <div style="font-size:12px;color:var(--text3)">${esc(txt(e.institution || ''))} ${e.year ? '· ' + esc(txt(e.year)) : ''}</div>
        </div>`).join('')}` : ''}
    </div>`;
}

function buildPlainText(r) {
  const lines = [];
  if (r.name) lines.push(txt(r.name), '');
  if (r.summary) lines.push('SUMMARY', txt(r.summary), '');
  if (txtList(r.skills).length) lines.push('SKILLS', txtList(r.skills).join(', '), '');
  if (Array.isArray(r.experience) && r.experience.length) {
    lines.push('EXPERIENCE');
    r.experience.forEach(e => {
      lines.push(`${txt(e.title)} at ${txt(e.company)}${e.dates ? ' | ' + fmtDates(e.dates) : ''}`);
      txtList(e.bullets).forEach(b => lines.push('• ' + b));
      lines.push('');
    });
  }
  if (Array.isArray(r.education) && r.education.length) {
    lines.push('EDUCATION');
    r.education.forEach(e => lines.push(`${txt(e.degree) || ''} — ${txt(e.institution) || ''} ${txt(e.year) || ''}`));
  }
  return lines.join('\n');
}

function renderAtsResult(r) {
  const score = r.score || 0;
  const grade = r.grade || '';
  const color = score >= 80 ? 'var(--grad-green)' : score >= 60 ? 'var(--grad-blue)' : 'var(--grad-amber)';
  const severityColor = s => s === 'high' ? 'var(--rose)' : s === 'medium' ? 'var(--amber)' : 'var(--text3)';

  const issuesHtml = (r.issues || []).map(issue => `
    <div style="display:flex;gap:8px;margin-bottom:8px;font-size:12.5px;align-items:flex-start;padding:8px 10px;background:var(--bg3);border-radius:var(--r-md);border-left:3px solid ${severityColor(issue.severity)}">
      <span style="color:${severityColor(issue.severity)};flex-shrink:0;margin-top:2px;font-size:10px;font-weight:700;text-transform:uppercase">${issue.severity || 'info'}</span>
      <div>
        <div style="color:var(--text);font-weight:500">${esc(issue.issue || issue.label || '')}</div>
        ${issue.fix ? `<div style="color:var(--text3);font-size:11.5px;margin-top:2px">Fix: ${esc(issue.fix)}</div>` : ''}
      </div>
    </div>`).join('');

  const strengthsHtml = (r.strengths || []).map(s => `
    <div style="display:flex;gap:8px;margin-bottom:5px;font-size:12.5px;align-items:flex-start">
      <span style="color:var(--green);flex-shrink:0;margin-top:1px">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg>
      </span>
      <span style="color:var(--text2)">${esc(s)}</span>
    </div>`).join('');

  return `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div style="font-size:42px;font-weight:700;background:${color};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1">${score}</div>
      <div>
        <div style="font-size:14px;font-weight:700">Grade ${grade}</div>
        <div style="font-size:12px;color:var(--text3)">ATS Compatibility Score</div>
        <div class="ats-meter" style="width:160px;margin-top:5px"><div class="ats-fill" style="background:${color};width:${score}%"></div></div>
      </div>
    </div>
    ${issuesHtml ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Issues to Fix</div>${issuesHtml}` : ''}
    ${strengthsHtml ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin:12px 0 8px">Strengths</div>${strengthsHtml}` : ''}
    ${r.recommendation ? `<div style="font-size:12.5px;color:var(--text2);margin-top:12px;padding:10px;background:var(--bg2);border-radius:var(--r-md)">${esc(r.recommendation)}</div>` : ''}`;
}

function setupWritingStyle(el) {
  const grid = el.querySelector('#style-grid');
  const desc = el.querySelector('#style-desc');
  if (!grid) return;

  grid.addEventListener('click', async e => {
    const btn = e.target.closest('.style-pill');
    if (!btn) return;
    const style = btn.dataset.style;
    grid.querySelectorAll('.style-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const meta = WRITING_STYLES.find(s => s.id === style);
    if (desc && meta) desc.textContent = meta.desc;
    try {
      await api.resume.saveWritingStyle({ style });
      toast(`Writing style set to ${meta?.label || style}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  });
}

function setupCoverLetterSample(el) {
  const zone    = el.querySelector('#cl-upload-zone');
  const input   = el.querySelector('#cl-file-input');
  const pasteEl = el.querySelector('#cl-paste-text');
  const pasteBtn = el.querySelector('#cl-paste-btn');

  const refresh = (sample) => {
    const status = el.querySelector('#cl-status');
    if (!status) return;
    const hasCL = sample?.text?.trim();
    status.innerHTML = hasCL
      ? `<div class="cl-loaded-bar">
           <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg>
           <span>Sample loaded — <span style="color:var(--text2)">${esc(hasCL.slice(0,50).replace(/\n/g,' '))}…</span></span>
           <div style="display:flex;gap:5px;margin-left:auto">
             <button class="btn btn-ghost btn-sm" id="cl-edit-btn">Edit</button>
             <button class="btn btn-ghost btn-sm" id="cl-export-pdf-btn">PDF</button>
             <button class="btn btn-ghost btn-sm" id="cl-export-docx-btn">DOCX</button>
             <button class="btn btn-ghost btn-sm" id="cl-remove-btn" style="color:var(--rose)">Remove</button>
           </div>
         </div>
         <div id="cl-edit-area" style="display:none;margin-top:10px">
           <textarea class="input" id="cl-edit-text" style="min-height:160px;font-size:12.5px">${esc(hasCL)}</textarea>
           <div style="display:flex;gap:6px;margin-top:6px">
             <button class="btn btn-primary btn-sm" id="cl-save-edit-btn">Save Changes</button>
             <button class="btn btn-ghost btn-sm" id="cl-cancel-edit-btn">Cancel</button>
           </div>
         </div>`
      : `<div style="font-size:12.5px;color:var(--text3)">No sample uploaded. Upload a cover letter you've previously written and your generated applications will mirror your authentic voice.</div>`;

    status.querySelector('#cl-remove-btn')?.addEventListener('click', async () => {
      try { await api.resume.deleteCoverLetter(); refresh(null); toast('Cover letter sample removed', 'info'); }
      catch (e) { toast(e.message, 'error'); }
    });
    status.querySelector('#cl-edit-btn')?.addEventListener('click', () => {
      const area = status.querySelector('#cl-edit-area');
      if (area) area.style.display = area.style.display === 'none' ? '' : 'none';
    });
    status.querySelector('#cl-export-pdf-btn')?.addEventListener('click', () => api.resume.exportCoverLetterPdf());
    status.querySelector('#cl-export-docx-btn')?.addEventListener('click', () => api.resume.exportCoverLetterDocx());
    status.querySelector('#cl-save-edit-btn')?.addEventListener('click', async () => {
      const text = status.querySelector('#cl-edit-text')?.value?.trim();
      if (!text) { toast('Cover letter text cannot be empty', 'error'); return; }
      try {
        const r = await api.resume.pasteCoverLetter(text);
        refresh(r); toast('Cover letter saved', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    status.querySelector('#cl-cancel-edit-btn')?.addEventListener('click', () => {
      const area = status.querySelector('#cl-edit-area');
      if (area) area.style.display = 'none';
    });
  };

  const doUpload = async (file) => {
    try {
      const r = await api.resume.uploadCoverLetter(file);
      refresh(r); toast('Cover letter sample saved', 'success');
    } catch (e) { toast('Upload failed: ' + e.message, 'error'); }
  };

  input?.addEventListener('change', e => { if (e.target.files[0]) doUpload(e.target.files[0]); });

  zone?.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone?.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) doUpload(file);
  });

  pasteBtn?.addEventListener('click', async () => {
    const text = pasteEl?.value.trim();
    if (!text) { toast('Paste your cover letter text first', 'error'); return; }
    try {
      const r = await api.resume.pasteCoverLetter(text);
      pasteEl.value = '';
      refresh(r); toast('Cover letter sample saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
  });

  // Wire initial buttons if cover letter was pre-loaded at render time
  el.querySelector('#cl-remove-btn')?.addEventListener('click', async () => {
    try { await api.resume.deleteCoverLetter(); refresh(null); toast('Cover letter sample removed', 'info'); }
    catch (e) { toast(e.message, 'error'); }
  });
  el.querySelector('#cl-edit-btn')?.addEventListener('click', () => {
    const area = el.querySelector('#cl-edit-area');
    if (area) area.style.display = area.style.display === 'none' ? '' : 'none';
  });
  el.querySelector('#cl-export-pdf-btn')?.addEventListener('click', () => api.resume.exportCoverLetterPdf());
  el.querySelector('#cl-export-docx-btn')?.addEventListener('click', () => api.resume.exportCoverLetterDocx());
  el.querySelector('#cl-save-edit-btn')?.addEventListener('click', async () => {
    const text = el.querySelector('#cl-edit-text')?.value?.trim();
    if (!text) { toast('Cover letter text cannot be empty', 'error'); return; }
    try {
      const r = await api.resume.pasteCoverLetter(text);
      refresh(r); toast('Cover letter saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
  });
  el.querySelector('#cl-cancel-edit-btn')?.addEventListener('click', () => {
    const area = el.querySelector('#cl-edit-area');
    if (area) area.style.display = 'none';
  });
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Coerce a dates value (string OR {startDate,endDate} object) into a clean display string.
function fmtDates(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.trim();
  if (typeof d === 'object') {
    const s = (d.startDate || d.start || d.from || '').toString().trim();
    const e = (d.endDate || d.end || d.to || '').toString().trim();
    // A single field may already contain a full range (e.g. "April 2021-Present")
    if (s && e) return `${s} – ${e}`;
    return s || e || '';
  }
  return String(d);
}

// Coerce any value that should be plain text (string, or object the AI wrapped it in) into a string.
// Also strips leftover prompt placeholder tokens like "<b>", "<s>", "<k>" that a failed AI call may echo.
function txt(v) {
  if (v == null) return '';
  if (typeof v === 'string') return stripPlaceholder(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    // Common shapes the model returns when it should have returned a string
    return stripPlaceholder((v.text || v.value || v.requirement || v.skill || v.name || v.label || v.description || '').toString());
  }
  return String(v);
}

// Drop pure placeholder tokens (e.g. "<b>", "<kw>", "<rewritten>") the model echoed instead of filling.
function stripPlaceholder(s) {
  const t = String(s).trim();
  if (/^<[^<>]{1,20}>$/.test(t)) return '';
  return s;
}

// Filter an array of strings/objects to clean, non-placeholder text values.
function txtList(arr) {
  return (Array.isArray(arr) ? arr : []).map(txt).map(s => s.trim()).filter(Boolean);
}

// ── Inline Resume Editor ──────────────────────────────────────

function renderResumeEditForm(r) {
  const skillsVal = (r.skills || []).join(', ');
  const expHtml = (r.experience || []).map((ex, i) => `
    <div class="resume-exp-entry" data-idx="${i}" style="padding:10px 12px;background:var(--bg3);border-radius:var(--r-md);margin-bottom:10px;border:1px solid var(--line)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Title</label>
          <input class="input exp-title" value="${esc(ex.title||'')}" style="margin-top:3px;font-size:12.5px">
        </div>
        <div>
          <label style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Company</label>
          <input class="input exp-company" value="${esc(ex.company||'')}" style="margin-top:3px;font-size:12.5px">
        </div>
      </div>
      <div style="margin-bottom:8px">
        <label style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Dates</label>
        <input class="input exp-dates" value="${esc(fmtDates(ex.dates))}" style="margin-top:3px;font-size:12.5px">
      </div>
      <div>
        <label style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Bullets (one per line)</label>
        <textarea class="input exp-bullets" style="margin-top:3px;font-size:12px;min-height:80px">${esc((ex.bullets||[]).join('\n'))}</textarea>
      </div>
    </div>`).join('');

  return `
    <div style="font-size:11px;color:var(--text3);margin-bottom:14px;padding:8px 10px;background:color-mix(in oklab,var(--blue2) 8%,transparent);border-radius:var(--r-md)">
      Edit your resume fields directly, then click Save Changes.
    </div>
    <div class="field"><label>Full Name</label><input class="input" id="edit-name" value="${esc(r.name||'')}" style="font-size:13px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field"><label>Email</label><input class="input" id="edit-email" value="${esc(r.email||'')}" style="font-size:12.5px"></div>
      <div class="field"><label>Phone</label><input class="input" id="edit-phone" value="${esc(r.phone||'')}" style="font-size:12.5px"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field"><label>Location</label><input class="input" id="edit-location" value="${esc(r.location||'')}" style="font-size:12.5px"></div>
      <div class="field"><label>LinkedIn URL</label><input class="input" id="edit-linkedin" value="${esc(r.linkedin||'')}" style="font-size:12.5px"></div>
    </div>
    <div class="field">
      <label>Summary</label>
      <textarea class="input" id="edit-summary" style="min-height:100px;font-size:12.5px">${esc(r.summary||'')}</textarea>
    </div>
    <div class="field">
      <label>Skills <span style="font-size:10px;color:var(--text4);font-weight:400">— comma-separated</span></label>
      <textarea class="input" id="edit-skills" style="min-height:60px;font-size:12.5px">${esc(skillsVal)}</textarea>
    </div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin:14px 0 8px">Experience</div>
    <div id="edit-experience">${expHtml}</div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-primary btn-sm" id="resume-edit-save">Save Changes</button>
      <button class="btn btn-ghost btn-sm" id="resume-edit-cancel">Cancel</button>
    </div>`;
}

function readResumeEditForm(card, existing) {
  const skills = (card.querySelector('#edit-skills')?.value || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const experience = [...card.querySelectorAll('.resume-exp-entry')].map(entry => ({
    title:   entry.querySelector('.exp-title')?.value?.trim() || '',
    company: entry.querySelector('.exp-company')?.value?.trim() || '',
    dates:   entry.querySelector('.exp-dates')?.value?.trim() || '',
    bullets: (entry.querySelector('.exp-bullets')?.value || '')
      .split('\n').map(s => s.trim()).filter(Boolean),
  }));

  return {
    ...existing,
    name:       card.querySelector('#edit-name')?.value?.trim()     || existing.name,
    email:      card.querySelector('#edit-email')?.value?.trim()    || existing.email,
    phone:      card.querySelector('#edit-phone')?.value?.trim()    || existing.phone,
    location:   card.querySelector('#edit-location')?.value?.trim() || existing.location,
    linkedin:   card.querySelector('#edit-linkedin')?.value?.trim() || existing.linkedin,
    summary:    card.querySelector('#edit-summary')?.value?.trim()  || existing.summary,
    skills,
    experience,
  };
}
