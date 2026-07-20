/**
 * sessionsPanel.js — Session management UI
 *
 * Renders a full sessions modal: list of saved sessions,
 * save / load / new session controls.
 */
import { api }   from '../api.js';
import { toast } from '../app.js';

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function relativeTime(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function appBadge(count) {
  return `<span style="font-size:10px;color:var(--text3)">${count ?? 0} application${count === 1 ? '' : 's'}</span>`;
}

export async function openSessionsModal(onClose) {
  // Remove any existing instance
  document.getElementById('sessions-modal-bg')?.remove();

  const bg = document.createElement('div');
  bg.id = 'sessions-modal-bg';
  bg.className = 'modal-bg';
  bg.style.cssText = 'z-index:200';

  bg.innerHTML = `
    <div class="modal" style="max-width:560px;width:100%">
      <button class="modal-close" id="sm-close">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
      </button>
      <div class="modal-title">Sessions</div>
      <div class="modal-sub">Save your current progress, start fresh, or restore a previous session.</div>

      <!-- Save current session -->
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <input class="input" id="sm-save-name" placeholder="Session name (e.g. Aug 2026 Search)" style="flex:1">
        <button class="btn btn-primary btn-sm" id="sm-save-btn">Save Session</button>
      </div>

      <!-- New session options -->
      <div style="padding:12px 14px;background:var(--bg3);border-radius:var(--r-md);margin-bottom:20px;border:1px solid var(--line)">
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px">Start a Clean Session</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
          Clears your applications tracker to start a fresh job search.
          Your profile and AI settings are always kept. Your current data is auto-saved first.
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <input class="input" id="sm-new-name" placeholder="New session name" style="flex:1;min-width:160px">
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text2);cursor:pointer">
            <input type="checkbox" id="sm-keep-resume" checked style="accent-color:var(--blue)">
            Keep resume
          </label>
          <button class="btn btn-secondary btn-sm" id="sm-new-btn" style="white-space:nowrap">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5.5 1v9M1 5.5h9"/></svg>
            New Session
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
          <div style="flex:1;font-size:11.5px;color:var(--text3)">
            <strong style="color:var(--rose)">Start from the very beginning</strong> — wipes applications, resume, profile, and cover letter. AI keys are kept. Current data is auto-saved first so nothing is lost.
          </div>
          <button class="btn btn-sm" id="sm-full-reset-btn" style="white-space:nowrap;background:color-mix(in oklab,var(--rose) 14%,transparent);color:var(--rose);border:1px solid color-mix(in oklab,var(--rose) 35%,transparent)">
            Full Reset
          </button>
        </div>
      </div>

      <!-- Session list -->
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Saved Sessions</div>
      <div id="sm-session-list" style="max-height:300px;overflow-y:auto">
        <div style="color:var(--text3);font-size:12.5px;padding:12px 0">Loading…</div>
      </div>
    </div>`;

  document.body.appendChild(bg);

  const close = () => { bg.remove(); onClose?.(); };
  bg.querySelector('#sm-close').onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };

  async function loadList() {
    const listEl  = bg.querySelector('#sm-session-list');
    const active  = await api.sessions.active().catch(() => null);
    const sessions = await api.sessions.list().catch(() => []);

    if (!sessions.length) {
      listEl.innerHTML = `<div style="color:var(--text3);font-size:12.5px;padding:12px 0">No saved sessions yet. Save one above to get started.</div>`;
      return;
    }

    listEl.innerHTML = sessions.map(s => {
      const isActive = s.id === active?.id;
      return `
        <div data-sid="${esc(s.id)}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-md);background:var(--bg3);margin-bottom:6px;border:1px solid ${isActive ? 'var(--blue)' : 'var(--line)'}">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</span>
              ${isActive ? `<span class="chip chip-blue" style="font-size:9px">ACTIVE</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
              ${appBadge(s.applicationCount)}
              <span style="font-size:10px;color:var(--text4)">·</span>
              <span style="font-size:10px;color:var(--text3)">Saved ${relativeTime(s.updatedAt)}</span>
              ${s.note ? `<span style="font-size:10px;color:var(--text4);font-style:italic">· ${esc(s.note)}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${!isActive ? `<button class="btn btn-secondary btn-sm sm-load-btn" data-sid="${esc(s.id)}" style="font-size:11px">Restore</button>` : ''}
            <button class="btn btn-ghost btn-sm sm-del-btn" data-sid="${esc(s.id)}" style="font-size:11px;color:var(--rose)">Delete</button>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.sm-load-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm(`Restore "${sessions.find(s => s.id === btn.dataset.sid)?.name}"? Your current unsaved work will be replaced.`)) return;
        btn.disabled = true; btn.textContent = 'Loading…';
        try {
          await api.sessions.load(btn.dataset.sid);
          toast('Session restored — reloading…', 'success');
          setTimeout(() => window.location.reload(), 800);
        } catch (e) {
          toast('Restore failed: ' + e.message, 'error');
          btn.disabled = false; btn.textContent = 'Restore';
        }
      };
    });

    listEl.querySelectorAll('.sm-del-btn').forEach(btn => {
      btn.onclick = async () => {
        const name = sessions.find(s => s.id === btn.dataset.sid)?.name;
        if (!confirm(`Delete "${name}" permanently?`)) return;
        await api.sessions.remove(btn.dataset.sid).catch(() => {});
        toast(`Deleted "${name}"`, 'info');
        loadList();
      };
    });
  }

  // Save button
  bg.querySelector('#sm-save-btn').onclick = async () => {
    const name = bg.querySelector('#sm-save-name').value.trim() || `Session ${new Date().toLocaleDateString()}`;
    const btn  = bg.querySelector('#sm-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api.sessions.save(name);
      toast(`Saved as "${name}"`, 'success');
      bg.querySelector('#sm-save-name').value = '';
      loadList();
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Save Session';
    }
  };

  // New session button
  bg.querySelector('#sm-new-btn').onclick = async () => {
    const name       = bg.querySelector('#sm-new-name').value.trim();
    const keepResume = bg.querySelector('#sm-keep-resume').checked;
    const btn        = bg.querySelector('#sm-new-btn');
    if (!confirm('Start a new session? Your current applications will be cleared. Your data is auto-saved first.')) return;
    btn.disabled = true; btn.textContent = 'Starting…';
    try {
      await api.sessions.newSession(name || undefined, { keepResume });
      toast('New session started — reloading…', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast('Failed: ' + e.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5.5 1v9M1 5.5h9"/></svg> New Session`;
    }
  };

  // Full Reset — true from-scratch start: wipes apps, resume, profile, cover letter.
  // AI provider config (keys) is never touched. Current data auto-saves first.
  bg.querySelector('#sm-full-reset-btn').onclick = async () => {
    const btn = bg.querySelector('#sm-full-reset-btn');
    if (!confirm('Full Reset: this clears your applications, resume, profile, and cover letter to start completely from scratch.\n\nYour current data is auto-saved as a session first (restorable from Saved Sessions), and your AI API keys are kept.\n\nContinue?')) return;
    btn.disabled = true; btn.textContent = 'Resetting…';
    try {
      await api.sessions.newSession('Before Full Reset', { keepProfile: false, keepResume: false });
      toast('Full reset complete — reloading…', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast('Failed: ' + e.message, 'error');
      btn.disabled = false; btn.textContent = 'Full Reset';
    }
  };

  loadList();
  return bg;
}
