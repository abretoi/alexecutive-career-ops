import { api } from '../api.js';
import { toast, scoreBadge, statusBadge, openBatchApplyModal, state } from '../app.js';

const STATUSES = ['Queued','Evaluated','Resume Ready','Applied','Responded','Interview','Offer','Accepted','Rejected','Withdrawn','Skipped'];

export async function renderTracker(el, state) {
  let apps = await api.tracker.list().catch(() => state.applications || []);
  let filterStatus = 'All';
  let search = '';

  function filtered() {
    return apps.filter(a => {
      const matchStatus = filterStatus === 'All' || a.status === filterStatus;
      const matchSearch = !search || [a.company, a.role, a.archetype, a.notes].join(' ').toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }

  function render() {
    const list = filtered();
    const tableBody = el.querySelector('#tracker-body');
    if (!tableBody) return;

    if (!list.length) {
      tableBody.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="empty-icon">📭</div><p>No applications yet. Search for jobs and save them to start tracking.</p></div></td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map(a => `
      <tr data-id="${a.id}">
        <td class="primary">${a.company}</td>
        <td>${a.role}</td>
        <td>${a.archetype ? `<span class="chip chip-purple" style="font-size:11px">${a.archetype}</span>` : '—'}</td>
        <td>${scoreBadge(a.score)}</td>
        <td>
          <select class="status-sel input" style="padding:4px 8px;font-size:11.5px;width:auto" data-id="${a.id}">
            ${STATUSES.map(s => `<option value="${s}" ${a.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td style="color:var(--text3)">${a.dateApplied || a.dateAdded || '—'}</td>
        <td style="max-width:160px"><span class="notes-cell" data-id="${a.id}" title="Click to edit notes" style="cursor:pointer;color:var(--text3);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.notes || '—'}</span></td>
        <td>
          <div style="display:flex;gap:5px">
            ${a.url ? `<a href="${a.url}" target="_blank" class="btn btn-ghost btn-sm">↗</a>` : ''}
            <button class="btn btn-danger btn-sm del-btn" data-id="${a.id}" title="Remove">✕</button>
          </div>
        </td>
      </tr>`).join('');

    // Wire status changes
    tableBody.querySelectorAll('.status-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          await api.tracker.update(sel.dataset.id, { status: sel.value, dateApplied: sel.value === 'Applied' ? new Date().toISOString().slice(0,10) : undefined });
          const idx = apps.findIndex(a => a.id === sel.dataset.id);
          if (idx >= 0) apps[idx].status = sel.value;
          toast('Status updated', 'success');
          updateStats();
        } catch(e) { toast(e.message, 'error'); }
      });
    });

    // Wire notes inline edit
    tableBody.querySelectorAll('.notes-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const id = cell.dataset.id;
        const current = apps.find(a => a.id === id)?.notes || '';
        const input = document.createElement('input');
        input.className = 'input';
        input.value = current;
        input.style.cssText = 'width:100%;font-size:11.5px;padding:2px 6px';
        cell.replaceWith(input);
        input.focus();
        const save = async () => {
          const val = input.value.trim();
          try {
            await api.tracker.update(id, { notes: val });
            const idx = apps.findIndex(a => a.id === id);
            if (idx >= 0) apps[idx].notes = val;
            toast('Notes saved', 'success');
          } catch(e) { toast(e.message, 'error'); }
          render();
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { render(); } });
      });
    });

    // Wire delete buttons
    tableBody.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this application?')) return;
        try {
          await api.tracker.remove(btn.dataset.id);
          apps = apps.filter(a => a.id !== btn.dataset.id);
          render();
          updateStats();
          toast('Removed', 'info');
        } catch(e) { toast(e.message, 'error'); }
      });
    });
  }

  function updateStats() {
    const counts = { queued: 0, applied: 0, interviews: 0, offers: 0 };
    apps.forEach(a => {
      if (a.status === 'Queued') counts.queued++;
      if (['Applied','Responded','Interview','Offer','Accepted'].includes(a.status)) counts.applied++;
      if (['Interview','Offer','Accepted'].includes(a.status)) counts.interviews++;
      if (['Offer','Accepted'].includes(a.status)) counts.offers++;
    });
    el.querySelector('#stat-total').textContent   = apps.length;
    el.querySelector('#stat-queued').textContent  = counts.queued;
    el.querySelector('#stat-applied').textContent = counts.applied;
    el.querySelector('#stat-int').textContent     = counts.interviews;
    el.querySelector('#stat-offer').textContent   = counts.offers;
    el.querySelector('#filter-count').textContent  = filtered().length;
    document.getElementById('app-count').textContent = apps.length;

    const queueBar = el.querySelector('#tracker-queue-bar');
    const queueCount = el.querySelector('#tracker-queue-count');
    if (queueBar && queueCount) {
      queueCount.textContent = counts.queued;
      queueBar.style.display = counts.queued > 0 ? 'flex' : 'none';
    }
  }

  el.innerHTML = `
  <div class="page-hdr">
    <h1>Applications Tracker</h1>
    <p>Track every application, interview, and offer in one place.</p>
  </div>

  <div class="stats-row">
    <div class="stat blue"><div class="stat-label">Total</div><div class="stat-value blue" id="stat-total">0</div></div>
    <div class="stat teal"><div class="stat-label">Queued</div><div class="stat-value teal" id="stat-queued">0</div></div>
    <div class="stat pink"><div class="stat-label">Applied</div><div class="stat-value pink" id="stat-applied">0</div></div>
    <div class="stat amber"><div class="stat-label">Interviews</div><div class="stat-value amber" id="stat-int">0</div></div>
    <div class="stat green"><div class="stat-label">Offers</div><div class="stat-value green" id="stat-offer">0</div></div>
  </div>

  <div class="tracker-queue-bar" id="tracker-queue-bar" style="display:none">
    <div style="display:flex;align-items:center;gap:10px">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 7l3.5 3.5L12 3"/></svg>
      <span><strong id="tracker-queue-count">0</strong> jobs ready to apply</span>
    </div>
    <button class="btn btn-primary btn-sm" id="process-queue-tracker-btn" style="font-size:12px">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg>
      Process Apply Queue
    </button>
  </div>

  <div class="section">
    <div class="section-hdr">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <input class="input" id="tracker-search" placeholder="Search company, role…" style="width:220px">
        ${['All',...STATUSES].map(s => `<button class="btn btn-ghost btn-sm filter-pill ${s==='All'?'active':''}" data-status="${s}" style="${s==='All'?'background:rgba(139,92,246,.15);color:#a78bfa;':''}">${s}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:12px;color:var(--text3)"><span id="filter-count">0</span> shown</span>
        <button class="btn btn-ghost btn-sm" onclick="window.location.href='/api/export/csv'">CSV</button>
        <button class="btn btn-ghost btn-sm" id="tracker-export-pdf-btn">PDF</button>
        <button class="btn btn-ghost btn-sm" id="tracker-export-docx-btn">DOCX</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Company</th><th>Role</th><th>Industry</th><th>Score</th>
            <th>Status</th><th>Date</th><th>Notes</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="tracker-body"></tbody>
      </table>
    </div>
  </div>`;

  // Process queue button
  el.querySelector('#process-queue-tracker-btn')?.addEventListener('click', () => openBatchApplyModal());

  // Export buttons
  el.querySelector('#tracker-export-pdf-btn')?.addEventListener('click', () => api.tracker.exportPdf());
  el.querySelector('#tracker-export-docx-btn')?.addEventListener('click', () => api.tracker.exportDocx());

  // Filter pills
  el.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      el.querySelectorAll('.filter-pill').forEach(p => { p.classList.remove('active'); p.style.cssText=''; });
      pill.classList.add('active');
      pill.style.background = 'rgba(139,92,246,.15)';
      pill.style.color = '#a78bfa';
      filterStatus = pill.dataset.status;
      render();
    });
  });

  // Search
  el.querySelector('#tracker-search').addEventListener('input', e => { search = e.target.value; render(); });

  updateStats();
  render();
}
