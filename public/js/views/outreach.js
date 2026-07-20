import { api } from '../api.js';
import { toast, openModal } from '../app.js';

const OUTREACH_TYPES = [
  { key: 'linkedinRequest', label: 'LinkedIn Request', hasSubject: false },
  { key: 'coldEmail',       label: 'Cold Email',       hasSubject: true  },
  { key: 'referralAsk',     label: 'Referral Ask',     hasSubject: true  },
  { key: 'followup',        label: '7-Day Follow-Up',  hasSubject: true  },
];

const FOLLOW_UP_PILL = 'followup';
const REFERRAL_PILL  = 'referralAsk';

function followupPill(status) {
  if (status === 'done')    return `<span class="chip" style="background:rgba(48,209,88,.15);color:var(--green)">Done</span>`;
  if (status === 'pending') return `<span class="chip" style="background:rgba(255,159,10,.15);color:var(--amber)">Pending</span>`;
  return `<span class="chip" style="background:var(--bg3);color:var(--text3)">None</span>`;
}

export async function renderOutreach(el, state) {
  let activeTab = 'generate';
  let activeType = 'linkedinRequest';
  let contacts = [];
  let apps = [];

  async function loadContacts() {
    contacts = await api.contacts.list().catch(() => []);
  }

  async function loadApps() {
    apps = await api.tracker.list().catch(() => state.applications || []);
  }

  await Promise.all([loadApps(), loadContacts()]);

  function appOptions() {
    return `<option value="">— Select a saved job —</option>` +
      apps.map(a => `<option value="${a.id}">${a.company} — ${a.role}</option>`).join('');
  }

  function renderGenerateTab() {
    return `
    <div id="generate-pane">
      <div class="section">
        <div class="section-hdr"><span class="section-title">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6.5h9M6.5 2l4.5 4.5L6.5 11"/></svg>
          Generate Outreach
        </span></div>

        <div style="display:flex;flex-direction:column;gap:16px;padding:0 0 4px">

          <div>
            <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Job</label>
            <select class="input" id="job-sel" style="width:100%;max-width:480px">${appOptions()}</select>
            <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
              <button class="btn btn-ghost btn-sm" id="paste-jd-toggle">Paste JD instead</button>
            </div>
            <textarea class="input" id="jd-paste" placeholder="Paste the job description here…" style="display:none;width:100%;max-width:480px;height:100px;margin-top:8px;resize:vertical"></textarea>
          </div>

          <div>
            <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Outreach Type</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap" id="type-pills">
              ${OUTREACH_TYPES.map(t => `
                <button class="btn btn-ghost btn-sm filter-pill type-pill ${t.key === activeType ? 'active' : ''}"
                  data-type="${t.key}"
                  style="${t.key === activeType ? 'background:rgba(10,132,255,.15);color:var(--blue);' : ''}"
                >${t.label}</button>
              `).join('')}
            </div>
          </div>

          <div id="dynamic-fields" style="display:flex;flex-direction:column;gap:10px;max-width:480px">
            <!-- injected by renderDynamicFields() -->
          </div>

          <div>
            <button class="btn btn-primary" id="gen-btn" style="min-width:140px">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
              Generate
            </button>
          </div>

          <div id="result-box" style="display:none;flex-direction:column;gap:10px">
            <div id="subject-wrap" style="display:none">
              <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Subject Line</label>
              <div style="display:flex;gap:8px">
                <input class="input" id="subject-out" readonly style="flex:1;font-size:13px">
                <button class="btn btn-ghost btn-sm" id="copy-subject">Copy</button>
              </div>
            </div>
            <div>
              <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Message</label>
              <textarea class="input" id="body-out" readonly style="width:100%;height:180px;font-size:13px;resize:vertical"></textarea>
            </div>
            <div>
              <button class="btn btn-secondary btn-sm" id="copy-all">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><path d="M2 9H1.5A.5.5 0 011 8.5v-7A.5.5 0 011.5 1h7a.5.5 0 01.5.5V2"/></svg>
                Copy All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderCRMTab() {
    const rows = contacts.length ? contacts.map(c => `
      <tr data-id="${c.id}">
        <td class="primary">${c.name}</td>
        <td style="color:var(--text2)">${c.role || '—'}</td>
        <td>${c.company || '—'}</td>
        <td><span class="chip" style="font-size:11px;background:var(--bg3);color:var(--text3)">${c.relationship || '—'}</span></td>
        <td>${followupPill(c.followUp)}</td>
        <td>
          <div style="display:flex;gap:5px">
            <button class="btn btn-ghost btn-sm crm-outreach-btn" data-id="${c.id}" title="Generate outreach for this contact">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6.5h8M6.5 3l3.5 3.5L6.5 10"/></svg>
            </button>
            <select class="input crm-status-sel" data-id="${c.id}" style="padding:3px 6px;font-size:11px;width:auto">
              <option value="">Status</option>
              <option value="none"  ${c.followUp==='none'  ?'selected':''}>None</option>
              <option value="pending" ${c.followUp==='pending'?'selected':''}>Pending</option>
              <option value="done"  ${c.followUp==='done'  ?'selected':''}>Done</option>
            </select>
            <button class="btn btn-danger btn-sm crm-del-btn" data-id="${c.id}" title="Delete">✕</button>
          </div>
        </td>
      </tr>`).join('') :
      `<tr><td colspan="6"><div class="empty" style="padding:32px 0;text-align:center;color:var(--text3)">No contacts yet. Add your first contact above.</div></td></tr>`;

    return `
    <div id="crm-pane">
      <div class="section">
        <div class="section-hdr">
          <span class="section-title">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="5.5" cy="4" r="2.5"/><path d="M1 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><path d="M10 1l2 2-2 2"/><path d="M12 3H9"/></svg>
            Network CRM
          </span>
          <button class="btn btn-primary btn-sm" id="add-contact-btn">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 1v10M1 6h10"/></svg>
            Add Contact
          </button>
        </div>

        <div id="add-contact-form" style="display:none;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Name *</label><input class="input" id="nc-name" placeholder="Jane Smith"></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Role</label><input class="input" id="nc-role" placeholder="Hiring Manager"></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Company</label><input class="input" id="nc-company" placeholder="Acme Corp"></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">LinkedIn URL</label><input class="input" id="nc-linkedin" placeholder="https://linkedin.com/in/…"></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Relationship</label><input class="input" id="nc-rel" placeholder="Met at conference"></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Notes</label><input class="input" id="nc-notes" placeholder="Optional notes"></div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" id="save-contact-btn">Save Contact</button>
            <button class="btn btn-ghost btn-sm" id="cancel-contact-btn">Cancel</button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Relationship</th><th>Follow-Up</th><th>Actions</th></tr></thead>
            <tbody id="crm-body">${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  el.innerHTML = `
  <div class="page-hdr">
    <h1>Outreach</h1>
    <p>Generate tailored outreach messages and manage your network contacts.</p>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:20px" id="tab-row">
    <button class="btn btn-sm tab-btn ${activeTab==='generate'?'btn-secondary':'btn-ghost'}" data-tab="generate">Generate Outreach</button>
    <button class="btn btn-sm tab-btn ${activeTab==='crm'?'btn-secondary':'btn-ghost'}" data-tab="crm">Network CRM</button>
  </div>

  <div id="tab-content"></div>`;

  function renderDynamicFields() {
    const df = el.querySelector('#dynamic-fields');
    if (!df) return;
    let html = `<div>
      <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Contact Name <span style="color:var(--text4)">(optional)</span></label>
      <input class="input" id="contact-name" placeholder="Hiring Manager name (optional)" style="width:100%">
    </div>`;
    if (activeType === 'coldEmail') {
      html += `<div>
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Contact Role <span style="color:var(--text4)">(optional)</span></label>
        <input class="input" id="contact-role" placeholder="e.g. Senior Recruiter" style="width:100%">
      </div>`;
    }
    if (activeType === REFERRAL_PILL) {
      html += `<div>
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Relationship</label>
        <input class="input" id="relationship" placeholder="How do you know them?" style="width:100%">
      </div>`;
    }
    if (activeType === FOLLOW_UP_PILL) {
      html += `<div>
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Application Date</label>
        <input class="input" id="app-date" type="date" style="width:200px">
      </div>`;
    }
    df.innerHTML = html;
  }

  function renderActiveTab() {
    const tc = el.querySelector('#tab-content');
    tc.innerHTML = activeTab === 'generate' ? renderGenerateTab() : renderCRMTab();
    el.querySelectorAll('.tab-btn').forEach(b => {
      const isActive = b.dataset.tab === activeTab;
      b.className = `btn btn-sm tab-btn ${isActive ? 'btn-secondary' : 'btn-ghost'}`;
    });
    if (activeTab === 'generate') {
      renderDynamicFields();
      wireGenerate();
    } else {
      wireCRM();
    }
  }

  function wireGenerate() {
    el.querySelector('#paste-jd-toggle')?.addEventListener('click', () => {
      const jd = el.querySelector('#jd-paste');
      const sel = el.querySelector('#job-sel');
      if (jd.style.display === 'none') {
        jd.style.display = 'block';
        sel.style.display = 'none';
        el.querySelector('#paste-jd-toggle').textContent = 'Use saved job instead';
      } else {
        jd.style.display = 'none';
        sel.style.display = 'block';
        el.querySelector('#paste-jd-toggle').textContent = 'Paste JD instead';
      }
    });

    el.querySelectorAll('.type-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeType = pill.dataset.type;
        el.querySelectorAll('.type-pill').forEach(p => {
          p.classList.remove('active');
          p.style.cssText = '';
        });
        pill.classList.add('active');
        pill.style.background = 'rgba(10,132,255,.15)';
        pill.style.color = 'var(--blue)';
        renderDynamicFields();
      });
    });

    el.querySelector('#gen-btn')?.addEventListener('click', async () => {
      const jobSel = el.querySelector('#job-sel');
      const jdPaste = el.querySelector('#jd-paste');
      const contactName = el.querySelector('#contact-name')?.value.trim() || '';
      const btn = el.querySelector('#gen-btn');

      const jobId = jobSel?.style.display !== 'none' ? jobSel?.value : '';
      const jd = jdPaste?.style.display !== 'none' ? jdPaste?.value.trim() : '';

      if (!jobId && !jd) { toast('Select a job or paste a job description', 'error'); return; }

      const job = jobId ? apps.find(a => a.id === jobId) : { role: 'this role', company: 'this company', description: jd };

      btn.disabled = true;
      btn.textContent = 'Generating…';
      try {
        let result;
        if (activeType === 'linkedinRequest') {
          result = await api.outreach.linkedinRequest(job, contactName);
        } else if (activeType === 'coldEmail') {
          const contactRole = el.querySelector('#contact-role')?.value.trim() || '';
          result = await api.outreach.coldEmail(job, contactName, contactRole);
        } else if (activeType === REFERRAL_PILL) {
          const relationship = el.querySelector('#relationship')?.value.trim() || '';
          result = await api.outreach.referralAsk(job, contactName, relationship);
        } else {
          const appDate = el.querySelector('#app-date')?.value || '';
          result = await api.outreach.followup(job, appDate);
        }

        const box = el.querySelector('#result-box');
        const subjectWrap = el.querySelector('#subject-wrap');
        const subjectOut = el.querySelector('#subject-out');
        const bodyOut = el.querySelector('#body-out');
        const typeInfo = OUTREACH_TYPES.find(t => t.key === activeType);

        box.style.display = 'flex';
        if (typeInfo.hasSubject && result.subject) {
          subjectWrap.style.display = 'block';
          subjectOut.value = result.subject;
        } else {
          subjectWrap.style.display = 'none';
        }
        bodyOut.value = result.body || result.message || result;

        el.querySelector('#copy-subject')?.addEventListener('click', () => {
          navigator.clipboard.writeText(subjectOut.value);
          toast('Subject copied', 'success');
        });
        el.querySelector('#copy-all')?.addEventListener('click', () => {
          const text = subjectOut.value ? `Subject: ${subjectOut.value}\n\n${bodyOut.value}` : bodyOut.value;
          navigator.clipboard.writeText(text);
          toast('Copied to clipboard', 'success');
        });
      } catch(e) {
        toast(e.message || 'Generation failed', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg> Generate`;
      }
    });
  }

  function wireCRM() {
    el.querySelector('#add-contact-btn')?.addEventListener('click', () => {
      const form = el.querySelector('#add-contact-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    el.querySelector('#cancel-contact-btn')?.addEventListener('click', () => {
      el.querySelector('#add-contact-form').style.display = 'none';
    });
    el.querySelector('#save-contact-btn')?.addEventListener('click', async () => {
      const name = el.querySelector('#nc-name')?.value.trim();
      if (!name) { toast('Name is required', 'error'); return; }
      const data = {
        name,
        role:         el.querySelector('#nc-role')?.value.trim(),
        company:      el.querySelector('#nc-company')?.value.trim(),
        linkedin:     el.querySelector('#nc-linkedin')?.value.trim(),
        relationship: el.querySelector('#nc-rel')?.value.trim(),
        notes:        el.querySelector('#nc-notes')?.value.trim(),
        followUp:     'none',
      };
      try {
        const saved = await api.contacts.add(data);
        contacts.push(saved);
        toast('Contact added', 'success');
        renderActiveTab();
      } catch(e) { toast(e.message, 'error'); }
    });

    el.querySelectorAll('.crm-status-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          await api.contacts.update(sel.dataset.id, { followUp: sel.value });
          const idx = contacts.findIndex(c => c.id === sel.dataset.id);
          if (idx >= 0) contacts[idx].followUp = sel.value;
          toast('Status updated', 'success');
          renderActiveTab();
        } catch(e) { toast(e.message, 'error'); }
      });
    });

    el.querySelectorAll('.crm-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this contact?')) return;
        try {
          await api.contacts.remove(btn.dataset.id);
          contacts = contacts.filter(c => c.id !== btn.dataset.id);
          toast('Contact removed', 'info');
          renderActiveTab();
        } catch(e) { toast(e.message, 'error'); }
      });
    });

    el.querySelectorAll('.crm-outreach-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const contact = contacts.find(c => c.id === btn.dataset.id);
        if (!contact) return;
        activeTab = 'generate';
        renderActiveTab();
        // pre-fill contact name after tab switch
        setTimeout(() => {
          const nameInput = el.querySelector('#contact-name');
          if (nameInput) nameInput.value = contact.name;
        }, 50);
      });
    });
  }

  el.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => {
      activeTab = b.dataset.tab;
      renderActiveTab();
    });
  });

  renderActiveTab();
}
