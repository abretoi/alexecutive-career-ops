import { api } from '../api.js';
import { toast } from '../app.js';

function esc(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export async function renderLinkedIn(el) {
  // Pre-load stored profile so we can pre-fill fields
  let storedProfile = null;
  try { storedProfile = await api.profile.get(); } catch {}

  el.innerHTML = `
  <div class="page-hdr">
    <h1>LinkedIn Optimizer</h1>
    <p>Load your LinkedIn profile and get AI-rewritten content to get discovered by more recruiters.</p>
  </div>

  <div class="grid-2" style="align-items:start;gap:20px">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="section-title" style="margin-bottom:10px">Load Profile</div>
        <div class="field" style="margin-bottom:10px">
          <label>LinkedIn Profile URL <span style="font-size:11px;color:var(--text3)">(optional — fetches public profile text)</span></label>
          <div style="display:flex;gap:8px">
            <input class="input" id="li-url" placeholder="https://linkedin.com/in/yourname" style="flex:1">
            <button class="btn btn-secondary btn-sm" id="li-load-btn" style="white-space:nowrap">Load Profile</button>
          </div>
          <div id="li-load-status" style="font-size:11.5px;color:var(--text3);margin-top:4px"></div>
        </div>
        <div id="li-session-bar" style="margin-bottom:12px;padding:10px 12px;background:var(--bg3);border-radius:var(--r-sm);font-size:11.5px;color:var(--text3)">
          <div id="li-session-status">Checking LinkedIn connection…</div>
          <div style="margin-top:8px;margin-bottom:8px">
            <label style="font-size:10.5px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Your LinkedIn Profile URL</label>
            <div style="display:flex;gap:6px">
              <input class="input" id="li-profile-url" placeholder="https://www.linkedin.com/in/your-username/" style="font-size:12px;flex:1;padding:6px 10px">
              <button class="btn btn-primary btn-sm" id="li-sync-profile-btn" style="white-space:nowrap">Sync Profile</button>
            </div>
            <div style="font-size:10.5px;color:var(--text4);margin-top:3px">Requires a connected LinkedIn account (Settings → Platform Accounts)</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="li-open-browser-btn">Open LinkedIn in Browser</button>
        </div>
        <div class="section-title" style="margin-bottom:10px">Current LinkedIn Content</div>
        <div class="field"><label>Headline (current)</label><input class="input" id="li-headline" placeholder="e.g. Operations Manager | Supply Chain Expert"></div>
        <div class="field"><label>About Section</label><textarea class="input" id="li-about" rows="5" placeholder="Paste your current About section…"></textarea></div>
        <div class="field"><label>Full Profile Text — Experience, Projects, Anything Public</label><textarea class="input" id="li-bullets" rows="7" placeholder="Paste everything from your profile: all roles, titles, dates, descriptions, projects, volunteering. Many people (e.g. at Apple) keep bullets private — that's fine, paste whatever text your profile does show and the AI will work with it."></textarea></div>
        <div class="field"><label>All Skills (comma separated)</label><input class="input" id="li-skills" placeholder="e.g. Supply Chain, SAP, Lean Six Sigma, Excel"></div>
        <button class="btn btn-primary" id="optimize-btn">✨ Optimize with AI</button>
      </div>
    </div>

    <div id="li-results">
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:32px;margin-bottom:12px">💼</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">Ready to optimize your LinkedIn</div>
        <p style="font-size:12.5px;color:var(--text2)">Paste your current content on the left and AI will rewrite it using proven recruiter-discovery strategies and your target role keywords.</p>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="section-title" style="margin-bottom:4px">LinkedIn Optimization Checklist</div>
    <div style="font-size:11.5px;color:var(--text3);margin-bottom:12px">Run <strong>Optimize with AI</strong> above and your profile is graded item-by-item against this checklist — pass/partial/fail with a 0–10 score and specific feedback for each.</div>
    <div class="grid-3" style="gap:8px">
      ${[
        ['📸','Professional photo','Not a selfie or group shot'],
        ['🖼','Custom banner','Don\'t leave the LinkedIn default'],
        ['📝','Headline optimized','2–3 keywords, no "seeking opportunities"'],
        ['💬','About section 500+ words','Story-driven, keyword-rich, CTA at end'],
        ['📋','All experience has bullets','3–5 per role with metrics'],
        ['🏅','50 skills listed','Led by target-role keywords'],
        ['⭐','3+ recommendations','From managers or colleagues'],
        ['🔗','Custom LinkedIn URL','linkedin.com/in/yourname'],
        ['🟢','Open to Work set','Right job titles and locations'],
      ].map(([icon, title, desc]) => `
        <div class="card card-sm" style="padding:12px">
          <div style="font-size:18px;margin-bottom:5px">${icon}</div>
          <div style="font-size:12.5px;font-weight:600;margin-bottom:2px">${title}</div>
          <div style="font-size:11.5px;color:var(--text3)">${desc}</div>
        </div>`).join('')}
    </div>
  </div>`;

  // Pre-fill from stored profile (populated by Platform Accounts sync or manual profile save)
  if (storedProfile) {
    if (storedProfile.headline && !el.querySelector('#li-headline').value) {
      el.querySelector('#li-headline').value = storedProfile.headline;
    }
    if (storedProfile.about && !el.querySelector('#li-about').value) {
      el.querySelector('#li-about').value = storedProfile.about;
    }
    if (storedProfile.skills?.length && !el.querySelector('#li-skills').value) {
      const skills = Array.isArray(storedProfile.skills)
        ? storedProfile.skills.join(', ')
        : storedProfile.skills;
      el.querySelector('#li-skills').value = skills;
    }
  }

  el.querySelector('#optimize-btn').addEventListener('click', async () => {
    const content = {
      headline:    el.querySelector('#li-headline').value.trim(),
      about:       el.querySelector('#li-about').value.trim(),
      profileText: el.querySelector('#li-bullets').value.trim(),
      bullets:     el.querySelector('#li-bullets').value.trim(), // back-compat
      skills:      el.querySelector('#li-skills').value.split(',').map(s=>s.trim()).filter(Boolean),
    };

    if (!content.headline && !content.about && !content.profileText) return toast('Paste your headline, About section, or full profile text — or sync your profile by URL above', 'error');

    const btn = el.querySelector('#optimize-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Optimizing…';

    try {
      const r = await api.linkedin.optimize(content);
      el.querySelector('#li-results').innerHTML = renderResults(r);
    } catch(e) {
      el.querySelector('#li-results').innerHTML = `<div class="card"><span style="color:#f87171">${e.message}</span></div>`;
      toast(e.message, 'error');
    }

    btn.disabled = false; btn.innerHTML = '✨ Optimize with AI';
  });

  // Check LinkedIn session status and update the session bar
  async function checkLinkedInSession() {
    const statusEl  = el.querySelector('#li-session-status');
    const syncBtn   = el.querySelector('#li-sync-profile-btn');
    const browserBtn = el.querySelector('#li-open-browser-btn');
    try {
      const r = await api.platforms.status();
      const li = (r.platforms || []).find(p => p.platform === 'linkedin');
      if (li?.connected) {
        statusEl.innerHTML = `<span style="color:var(--green);font-weight:600">● LinkedIn connected</span> <span style="color:var(--text4)">· Connected ${li.connectedAt ? new Date(li.connectedAt).toLocaleDateString() : ''}</span>`;
        syncBtn.disabled = false;
      } else {
        statusEl.innerHTML = `LinkedIn not connected — <a href="#" style="color:var(--acc)" id="li-goto-settings">Settings → Platform Accounts</a> to connect, or paste your profile URL above and sync anyway.`;
        el.querySelector('#li-goto-settings')?.addEventListener('click', e => {
          e.preventDefault();
          document.querySelector('[data-view="profile"]')?.click();
        });
      }
    } catch {
      statusEl.textContent = 'Could not check LinkedIn connection status.';
    }
  }

  checkLinkedInSession();

  // Sync profile via connected LinkedIn session
  el.querySelector('#li-sync-profile-btn').addEventListener('click', async () => {
    const btn = el.querySelector('#li-sync-profile-btn');
    const profileUrl = el.querySelector('#li-profile-url')?.value?.trim() || null;
    btn.disabled = true; btn.textContent = 'Syncing…';
    const status = el.querySelector('#li-load-status');
    status.textContent = profileUrl
      ? `Navigating to ${profileUrl} and extracting profile…`
      : 'Navigating to your LinkedIn profile…';
    try {
      const r = await api.platforms.sync('linkedin', profileUrl);
      fillFromSyncData(r);
      const fieldsFound = [r.structured?.headline, r.structured?.about, r.structured?.skills?.length, r.structured?.experience?.length, r.structured?.education?.length, r.structured?.certifications?.length, r.structured?.projects?.length, r.structured?.volunteer?.length, r.structured?.publications?.length, r.structured?.awards?.length, r.structured?.languages?.length, r.structured?.organizations?.length, r.structured?.courses?.length].filter(Boolean).length;
      status.textContent = fieldsFound > 0
        ? `Profile synced — ${fieldsFound} field(s) filled. Review and edit, then click Optimize.`
        : 'Sync complete but fields could not be extracted automatically. Please paste your content into the fields below.';
      toast(fieldsFound > 0 ? 'LinkedIn profile synced' : 'Synced — paste your content manually', fieldsFound > 0 ? 'success' : 'info');
    } catch (e) {
      if (e.message.includes('expired') || e.message.includes('reconnect')) {
        status.textContent = 'LinkedIn session expired — go to Settings → Platform Accounts and reconnect.';
        toast('Session expired — please reconnect LinkedIn', 'error');
        await checkLinkedInSession();
      } else if (e.message.includes('No session') || e.message.includes('Connect first')) {
        status.textContent = 'No LinkedIn session — connect in Settings → Platform Accounts first.';
        toast('Connect LinkedIn in Settings first', 'error');
      } else {
        status.textContent = `Sync failed: ${e.message}`;
        toast('Sync failed: ' + e.message, 'error');
      }
    } finally {
      btn.disabled = false; btn.textContent = 'Sync Profile';
    }
  });

  function fillFromSyncData(r) {
    const s = r.structured || {};
    if (s.headline)       el.querySelector('#li-headline').value = s.headline;
    if (s.about)          el.querySelector('#li-about').value    = s.about;
    if (s.skills?.length) el.querySelector('#li-skills').value   = s.skills.join(', ');

    // Build the Full Profile Text field from experience + education + certifications
    const parts = [];

    // Experience
    if (s.experience?.length) {
      parts.push('=== EXPERIENCE ===');
      s.experience.forEach(e => {
        const header = [e.title, e.company, e.dates].filter(Boolean).join(' · ');
        if (header) parts.push(header);
        const body = Array.isArray(e.bullets) ? e.bullets.join('\n') : (e.bullets || e.description || '');
        if (body) parts.push(body);
        parts.push('');
      });
    }

    // Education
    if (s.education?.length) {
      parts.push('=== EDUCATION ===');
      s.education.forEach(ed => {
        const line = [ed.degree, ed.field, ed.institution, ed.dates].filter(Boolean).join(' · ');
        if (line) parts.push(line);
      });
      parts.push('');
    }

    // Certifications / Licenses
    if (s.certifications?.length) {
      parts.push('=== CERTIFICATIONS & LICENSES ===');
      s.certifications.forEach(c => {
        const line = [c.name, c.issuer, c.issued].filter(Boolean).join(' · ');
        if (line) parts.push(line);
      });
    }

    // Projects
    if (s.projects?.length) {
      parts.push('=== PROJECTS ===');
      s.projects.forEach(p => {
        const header = [p.name, p.dates].filter(Boolean).join(' · ');
        if (header) parts.push(header);
        if (p.description) parts.push(p.description);
        parts.push('');
      });
    }

    // Volunteer experience
    if (s.volunteer?.length) {
      parts.push('=== VOLUNTEER EXPERIENCE ===');
      s.volunteer.forEach(v => {
        const header = [v.role, v.organization, v.dates].filter(Boolean).join(' · ');
        if (header) parts.push(header);
        if (v.description) parts.push(v.description);
        parts.push('');
      });
    }

    // Publications
    if (s.publications?.length) {
      parts.push('=== PUBLICATIONS ===');
      s.publications.forEach(p => {
        const line = [p.title, p.publisher, p.date].filter(Boolean).join(' · ');
        if (line) parts.push(line);
        if (p.description) parts.push(p.description);
      });
      parts.push('');
    }

    // Awards & Honors
    if (s.awards?.length) {
      parts.push('=== AWARDS & HONORS ===');
      s.awards.forEach(a => {
        const line = [a.title, a.issuer, a.date].filter(Boolean).join(' · ');
        if (line) parts.push(line);
      });
      parts.push('');
    }

    // Languages
    if (s.languages?.length) {
      parts.push('=== LANGUAGES ===');
      s.languages.forEach(l => {
        const line = [l.language, l.proficiency].filter(Boolean).join(': ');
        if (line) parts.push(line);
      });
      parts.push('');
    }

    // Organizations
    if (s.organizations?.length) {
      parts.push('=== ORGANIZATIONS ===');
      s.organizations.forEach(o => {
        const line = [o.name, o.role, o.dates].filter(Boolean).join(' · ');
        if (line) parts.push(line);
      });
      parts.push('');
    }

    // Courses
    if (s.courses?.length) {
      parts.push('=== COURSES ===');
      s.courses.forEach(c => {
        const line = [c.name, c.provider].filter(Boolean).join(' · ');
        if (line) parts.push(line);
      });
      parts.push('');
    }

    // Fall back to any raw profile text the extractor captured
    const fullText = parts.join('\n').trim() || (s.profileText || s.rawText || r.rawText || '').trim();
    if (fullText) el.querySelector('#li-bullets').value = fullText;
  }

  // Open LinkedIn in a Playwright browser — user signs in and can return to sync
  el.querySelector('#li-open-browser-btn').addEventListener('click', async () => {
    const btn = el.querySelector('#li-open-browser-btn');
    btn.disabled = true; btn.textContent = 'Opening…';
    try {
      await fetch('/api/profile/open-browser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://www.linkedin.com/in/me/' }) });
      toast('Browser opened at your LinkedIn profile — copy the text you want and paste it into the fields, or connect via Settings → Platform Accounts for automatic sync', 'success');
    } catch (e) {
      toast('Could not open browser: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Open LinkedIn in Browser';
    }
  });

  // URL loader — falls back to scraping for public profiles
  el.querySelector('#li-load-btn').addEventListener('click', async () => {
    const url = el.querySelector('#li-url').value.trim();
    if (!url) return toast('Enter your LinkedIn profile URL first', 'error');
    const status  = el.querySelector('#li-load-status');
    const loadBtn = el.querySelector('#li-load-btn');
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading…';
    status.textContent = 'Fetching profile…';

    // If LinkedIn session is connected, try syncing via session first
    try {
      const sr = await api.platforms.status();
      const li = (sr.platforms || []).find(p => p.platform === 'linkedin');
      if (li?.connected) {
        const r = await api.platforms.sync('linkedin');
        fillFromSyncData(r);
        status.textContent = `Profile loaded via connected LinkedIn account. Review and edit, then click Optimize.`;
        toast('LinkedIn profile loaded via saved session', 'success');
        loadBtn.disabled = false; loadBtn.textContent = 'Load Profile';
        return;
      }
    } catch { /* fall through to URL scrape */ }

    try {
      const r = await api.profile.scrapeUrl(url);
      const rawText = r.text || r.content || '';
      if (!rawText.trim()) {
        status.innerHTML = `LinkedIn requires sign-in to view profiles. <strong>Connect your account</strong> in Settings → Platform Accounts for automatic loading, or paste your profile text manually below.`;
        return;
      }
      // rawText from a scraped page is entire page content — don't blindly dump it into About.
      // Paste the full text into a hidden field and let the user know to paste manually instead.
      status.innerHTML = `Profile text retrieved but couldn't be parsed into structured fields. <strong>Paste your About section text directly into the About field below.</strong>`;
      toast('Paste your About, Headline, and Skills into the fields below', 'info');
      toast('Profile text loaded — review and edit before optimizing', 'success');
    } catch (e) {
      status.textContent = `Could not load profile: ${e.message}. Connect your account in Settings or paste manually.`;
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = 'Load Profile';
    }
  });
}

function renderResults(r) {
  if (r._error) {
    return `<div class="card"><div style="color:var(--rose);font-size:13px;line-height:1.6">${r._error}</div></div>`;
  }
  return `
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <div class="stat-value blue" style="font-size:36px">${r.profileScore||'—'}</div>
      <div>
        <div style="font-weight:600">Profile Optimization Score</div>
        <div style="font-size:12px;color:var(--text2)">Out of 100 — higher = more recruiter visibility</div>
      </div>
    </div>

    ${r.topImprovements?.length ? `
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:6px">Top Actions</div>
      ${r.topImprovements.map(i=>`<div style="font-size:12.5px;margin-bottom:4px;display:flex;gap:6px"><span>→</span>${i}</div>`).join('')}
    </div>` : ''}
  </div>

  ${r.headline ? `
  <div class="card" style="margin-bottom:12px">
    <div class="eval-block-title" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Headline Rewrite</div>
    <div style="margin-bottom:6px"><span class="chip chip-red">Before</span></div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:10px;padding:8px;background:var(--bg2);border-radius:6px">${r.headline.current||'—'}</div>
    <div style="margin-bottom:6px"><span class="chip chip-green">After</span></div>
    <div style="font-size:13.5px;font-weight:600;padding:8px;background:rgba(16,185,129,.08);border-radius:6px;border:1px solid rgba(16,185,129,.2)">${r.headline.optimized}</div>
    ${r.headline.explanation?`<div style="font-size:12px;color:var(--text3);margin-top:6px">${r.headline.explanation}</div>`:''}
  </div>` : ''}

  ${r.about ? `
  <div class="card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">About Section Rewrite</div>
    <div style="margin-bottom:6px"><span class="chip chip-green">Hook (first 2 lines)</span></div>
    <div style="font-size:13.5px;font-weight:600;padding:8px;background:rgba(16,185,129,.08);border-radius:6px;border:1px solid rgba(16,185,129,.2);margin-bottom:10px">${r.about.hook||''}</div>
    <details><summary style="font-size:12px;color:var(--text2);cursor:pointer;margin-bottom:8px">View full About section</summary>
    <pre style="font-size:12px;color:var(--text2);white-space:pre-wrap;font-family:var(--font);line-height:1.6;padding:10px;background:var(--bg2);border-radius:6px">${r.about.optimized||''}</pre></details>
    <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(r.about.optimized||'')}).then(()=>alert('Copied!'))">📋 Copy</button>
  </div>` : ''}

  ${r.experienceBullets?.length ? `
  <div class="card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Experience Bullet Rewrites — Ready to Paste</div>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">Grounded in your resume experience. Copy each rewritten bullet directly into the matching role on your profile.</p>
    ${(() => {
      const byRole = {};
      r.experienceBullets.forEach(b => { (byRole[b.role || 'Experience'] ||= []).push(b); });
      return Object.entries(byRole).map(([role, bullets]) => `
        <div style="margin-bottom:14px;padding:10px 12px;background:var(--bg2);border-radius:8px;border:1px solid var(--line)">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:8px">${esc(role)}</div>
          ${bullets.map(b => `
            <div style="margin-bottom:10px">
              ${b.original && !/\(none/i.test(b.original) ? `<div style="font-size:11.5px;color:var(--text3);margin-bottom:3px"><span class="chip chip-red" style="font-size:9px;margin-right:5px">Before</span>${esc(b.original)}</div>` : ''}
              <div style="display:flex;align-items:flex-start;gap:6px">
                <span class="chip chip-green" style="font-size:9px;flex-shrink:0;margin-top:2px">After</span>
                <span style="font-size:12.5px;color:var(--text);line-height:1.5;flex:1">${esc(b.optimized || '')}</span>
                <button class="btn btn-ghost btn-sm" style="flex-shrink:0;font-size:10px" onclick="navigator.clipboard.writeText(${JSON.stringify(b.optimized||'')}).then(()=>alert('Copied!'))">Copy</button>
              </div>
            </div>`).join('')}
        </div>`).join('');
    })()}
  </div>` : ''}

  ${r.checklistAudit?.length ? `
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3)">Optimization Checklist — Graded Against Your Profile</div>
      <span class="chip chip-blue" style="font-size:11px">${r.checklistAudit.filter(c=>c.status==='pass').length}/${r.checklistAudit.filter(c=>c.status!=='unknown').length} passing</span>
    </div>
    ${r.checklistAudit.map(c => {
      const meta = { pass:['#34d399','✓'], partial:['var(--amber)','◐'], fail:['var(--rose)','✗'], unknown:['var(--text4)','?'] }[c.status] || ['var(--text4)','?'];
      return `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;margin-bottom:6px;background:var(--bg2);border-radius:8px;border-left:3px solid ${meta[0]}">
        <span style="color:${meta[0]};font-weight:700;flex-shrink:0;width:14px">${meta[1]}</span>
        <div style="flex:1">
          <div style="font-size:12.5px;font-weight:600;display:flex;justify-content:space-between;gap:8px">
            <span>${esc(c.label || c.item || '')}</span>
            ${c.status !== 'unknown' && c.score != null ? `<span style="color:${meta[0]};font-size:11px">${esc(String(c.score))}/10</span>` : ''}
          </div>
          ${c.feedback ? `<div style="font-size:11.5px;color:var(--text3);margin-top:2px;line-height:1.45">${esc(c.feedback)}</div>` : ''}
        </div>
      </div>`;
    }).join('')}
    <div style="font-size:10.5px;color:var(--text4);margin-top:6px">Items marked "?" (photo, banner, recommendations, custom URL) can't be assessed from text — check those manually on your profile.</div>
  </div>` : ''}

  ${r.topSkills?.length ? `
  <div class="card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Top Skills to Add / Prioritize</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">${r.topSkills.slice(0,20).map(s=>`<span class="chip chip-blue">${s}</span>`).join('')}</div>
  </div>` : ''}

  ${r.openToWorkTitles?.length ? `
  <div class="card">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Open to Work — Recommended Titles</div>
    <p style="font-size:12px;color:var(--text2);margin-bottom:6px">Add these exact titles to your "Open to Work" settings for maximum recruiter visibility:</p>
    <div style="display:flex;flex-wrap:wrap;gap:5px">${r.openToWorkTitles.map(t=>`<span class="chip chip-green">${t}</span>`).join('')}</div>
  </div>` : ''}`;
}
