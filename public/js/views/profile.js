import { api } from '../api.js';
import { toast } from '../app.js';

export async function renderProfile(el, state) {
  const [profile, config, providerData] = await Promise.all([
    api.profile.get().catch(() => ({})),
    api.config.get().catch(() => ({})),
    api.config.providers().catch(() => ({ providers: {}, current: { providerKey: 'anthropic', configured: false } })),
  ]);

  const { providers = {}, current = {} } = providerData;
  const activeKey = config.aiProvider || current.providerKey || 'anthropic';

  el.innerHTML = `
  <div class="page-hdr">
    <h1>Profile & Settings</h1>
    <p>Configure your AI provider, search preferences, and personal information.</p>
  </div>

  <div class="grid-2" style="align-items:start;gap:20px">

    <!-- Left column -->
    <div>

      <!-- AI Provider card -->
      <div class="card" id="provider-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div class="section-title">AI Provider</div>
          <span id="provider-status-badge" class="chip ${current.configured ? 'chip-green' : 'chip-amber'}" style="font-size:10px">
            ${current.configured ? 'Connected' : 'Not configured'}
          </span>
        </div>

        <!-- Provider selector tabs -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px" id="provider-tabs">
          ${Object.entries(providers).map(([k, p]) => `
            <button class="provider-tab ${k === activeKey ? 'active' : ''}" data-key="${k}">
              ${p.label}
              ${p.freeOption ? '<span class="free-badge">Free</span>' : ''}
            </button>
          `).join('')}
        </div>

        <!-- Per-provider description panel -->
        <div id="provider-panel"></div>

        <button class="btn btn-primary btn-sm" id="save-provider-btn" style="margin-top:14px">Save Provider</button>
        <span id="provider-save-status" style="margin-left:10px;font-size:12px;color:var(--text3)"></span>
      </div>

      <!-- Personal Info -->
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:14px">Personal Information</div>
        <div class="field"><label>Full Name</label><input class="input" id="p-name" value="${esc(profile.name||'')}"></div>
        <div class="field"><label>Email</label><input class="input" id="p-email" type="email" value="${esc(profile.email||'')}"></div>
        <div class="field"><label>Phone</label><input class="input" id="p-phone" value="${esc(profile.phone||'')}"></div>
        <div class="field"><label>Location</label><input class="input" id="p-location" placeholder="City, State" value="${esc(profile.location||'')}"></div>
        <div class="field"><label>LinkedIn URL</label><input class="input" id="p-linkedin" placeholder="linkedin.com/in/yourname" value="${esc(profile.linkedin||'')}"></div>
        <button class="btn btn-primary btn-sm" id="save-personal-btn">Save</button>
      </div>
    </div>

    <!-- Right column -->
    <div>
      <!-- Job Search Preferences -->
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:14px">Job Search Preferences</div>

        <div class="field">
          <label>Target Job Titles <span style="font-size:10px;font-weight:400;color:var(--text3)">(press Enter to add)</span></label>
          <div class="tag-input-wrap" id="roles-wrap">
            ${(profile.targetRoles||[]).map(r=>`<span class="tag-pill">${esc(r)}<button onclick="this.parentElement.remove()">×</button></span>`).join('')}
            <input class="tag-real-input" id="roles-input" placeholder="e.g. Operations Manager">
          </div>
        </div>

        <div class="field">
          <label>Primary Industry</label>
          <select class="input" id="p-industry">
            ${['','Technology/Engineering','Finance/Accounting','Healthcare/Medical','Legal/Compliance','Creative/Marketing','Operations/Supply Chain','Sales/Business Dev','Education/Training','Executive/Leadership','Trades/Skilled Labor','Customer Success','People/HR','Government/Nonprofit','Scientific/R&D','Non-Software Engineering'].map(i=>`<option value="${i}" ${profile.primaryIndustry===i?'selected':''}>${i||'Select industry…'}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label>Seniority Level</label>
          <select class="input" id="p-seniority">
            ${['Entry','Associate','Mid','Senior','Manager','Director','VP','C-Suite'].map(s=>`<option ${profile.seniority===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label>Remote Preference</label>
          <select class="input" id="p-remote">
            ${[['any','Any'],['remote','Remote only'],['hybrid','Hybrid'],['onsite','On-site only']].map(([v,l])=>`<option value="${v}" ${profile.remotePreference===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label>Salary Target (USD/year)</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <input class="input" id="p-sal-min" type="number" placeholder="Min" value="${profile.salaryMin||''}">
            <input class="input" id="p-sal-max" type="number" placeholder="Max" value="${profile.salaryMax||''}">
          </div>
        </div>

        <button class="btn btn-primary btn-sm" id="save-prefs-btn">Save Preferences</button>
      </div>

      <!-- Career Narrative -->
      <div class="card">
        <div class="section-title" style="margin-bottom:14px">Career Narrative <span style="font-size:11px;font-weight:400;color:var(--text3)">(improves AI evaluation accuracy)</span></div>
        <div class="field"><label>Your "Superpower"</label><input class="input" id="p-super" placeholder="What you do better than most…" value="${esc(profile.superpower||'')}"></div>
        <div class="field"><label>Top Achievement</label><input class="input" id="p-achieve" placeholder="Your proudest professional result…" value="${esc(profile.narrative||'')}"></div>
        <div class="field">
          <label>Deal-Breakers <span style="font-size:10px;font-weight:400;color:var(--text3)">(press Enter to add)</span></label>
          <div class="tag-input-wrap" id="breaks-wrap">
            ${(profile.dealBreakers||[]).map(b=>`<span class="tag-pill" style="background:rgba(239,68,68,.12);color:#f87171">${esc(b)}<button onclick="this.parentElement.remove()">×</button></span>`).join('')}
            <input class="tag-real-input" id="breaks-input" placeholder="e.g. No relocation">
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="save-narrative-btn">Save Narrative</button>
      </div>

      <!-- Platform Accounts -->
      <div class="card" style="margin-top:16px" id="platform-accounts-card">
        <div class="section-title" style="margin-bottom:4px">Platform Accounts</div>
        <div style="font-size:11.5px;color:var(--text3);line-height:1.5;margin-bottom:14px">
          Connect your accounts once — a real browser window opens and you sign in yourself. Your session cookies are saved locally so Alexecutive can sync your profile and apply to jobs on your behalf. <strong style="color:var(--text2)">Your credentials are never seen or stored by this app.</strong>
        </div>
        <div id="platform-list" style="display:flex;flex-direction:column;gap:8px">
          <div style="font-size:12px;color:var(--text3);padding:12px 0;text-align:center">Loading platform status…</div>
        </div>
        <div style="margin-top:10px;padding:8px 10px;background:color-mix(in oklab,var(--acc) 8%,transparent);border-radius:var(--r-md);font-size:11px;color:var(--text3);line-height:1.5">
          <strong style="color:var(--acc)">How it works:</strong> Click <strong>Connect</strong> → a browser window opens at the platform's login page → sign in with your own credentials → session is saved automatically. Same approach used by Simplify, LazyApply, and Tsenta.
        </div>
      </div>
    </div>
  </div>`;

  // ── Provider panel renderer ───────────────────────────────────
  function renderProviderPanel(key) {
    const p   = providers[key];
    const cfg = config;
    if (!p) return;

    const isOllama  = key === 'ollama';
    const isCustom  = key === 'custom';
    // Per-provider key map first; legacy single-key fields as fallback
    const curApiKey = cfg.aiKeys?.[key]
      || (key === (cfg.aiProvider || '') ? cfg.aiApiKey : '')
      || (key === 'anthropic' ? (cfg.apiKey || '') : '');
    // Only reuse saved base URL / model names when they belong to THIS provider.
    // Carrying them across a provider switch is how wrong model IDs (e.g. a bare
    // "llama-3.3-70b-instruct" hitting NVIDIA and 404ing) end up saved.
    const isSavedProvider = key === (cfg.aiProvider || '');
    const curBase   = (isSavedProvider && cfg.aiBaseUrl)    || p.baseUrl   || '';
    const curFast   = (isSavedProvider && cfg.aiFastModel)  || p.fastModel  || '';
    const curPower  = (isSavedProvider && cfg.aiPowerModel) || p.powerModel || '';

    el.querySelector('#provider-panel').innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-md);padding:12px 14px;margin-bottom:12px">
        <div style="font-size:12px;color:var(--text2);line-height:1.55">${p.description}</div>

        ${p.setupSteps?.length ? `
        <div style="margin-top:10px">
          <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Setup Steps</div>
          ${p.setupSteps.map((s,i)=>`
            <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:4px">
              <span style="flex-shrink:0;width:18px;height:18px;border-radius:50%;background:color-mix(in oklab,var(--acc) 15%,transparent);color:var(--acc);font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</span>
              <span style="font-size:11.5px;color:var(--text2)">${s}</span>
            </div>`).join('')}
        </div>` : ''}
      </div>

      ${!isOllama ? `
      <div class="field" style="margin-bottom:10px">
        <label>${p.keyLabel || 'API Key'}</label>
        <input class="input" id="prov-api-key" type="password"
          placeholder="${curApiKey ? 'Key saved — paste a new key to replace it' : (p.keyPrefix ? p.keyPrefix + '…' : 'Enter API key')}"
          value="${curApiKey && !isCustom ? '••••••••••••' : ''}">
        ${curApiKey ? `<div style="font-size:11px;color:#34d399;margin-top:4px">✓ Full key is saved for this provider (shown masked — it is not truncated). Paste a new key only if you want to replace it.</div>` : ''}
        ${p.keyHint ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">${p.keyHint}</div>` : ''}
      </div>` : `
      <div style="background:color-mix(in oklab,var(--green) 10%,transparent);border:1px solid color-mix(in oklab,var(--green) 22%,transparent);border-radius:var(--r-md);padding:8px 12px;margin-bottom:10px;font-size:12px;color:#34d399">
        No API key required — Ollama runs entirely on your machine.
      </div>
      <div id="ollama-probe-row" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:8px 12px;background:var(--bg3);border-radius:var(--r-md);border:1px solid var(--line)">
        <div id="ollama-dot" style="width:8px;height:8px;border-radius:50%;background:var(--text4);flex-shrink:0"></div>
        <span id="ollama-probe-msg" style="font-size:12px;color:var(--text3)">Checking Ollama…</span>
        <button class="btn btn-ghost btn-sm" id="ollama-recheck-btn" style="margin-left:auto;font-size:11px">Re-check</button>
      </div>
      <div id="ollama-models-row" style="display:none;margin-bottom:10px">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:5px">Available models — click to select</div>
        <div id="ollama-model-chips" style="display:flex;flex-wrap:wrap;gap:4px"></div>
        <div style="font-size:10.5px;color:var(--text3);margin-top:6px">Click a model to set it as both Fast and Power model.</div>
      </div>`}

      ${isCustom ? `
      <div class="field" style="margin-bottom:10px">
        <label>Base URL</label>
        <input class="input" id="prov-base-url" placeholder="http://localhost:1234/v1" value="${esc(curBase)}">
      </div>` : ''}

      <div style="margin-top:2px">
        <button class="btn btn-ghost btn-sm" id="toggle-models-btn" style="font-size:11px;padding:3px 8px">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 3.5l3 3 3-3"/></svg>
          Model overrides (optional)
        </button>
        <div id="model-overrides" style="display:none;margin-top:10px">
          ${(p.models || []).length ? `<datalist id="prov-model-options">${p.models.map(m => `<option value="${esc(m)}">`).join('')}</datalist>` : ''}
          <div class="field" style="margin-bottom:8px">
            <label>Fast model <span style="font-size:10px;font-weight:400;color:var(--text3)">used for scoring, parsing, ATS — pick from the dropdown or type any model</span></label>
            <input class="input" id="prov-fast-model" ${(p.models || []).length ? 'list="prov-model-options"' : ''} placeholder="${p.fastModel || 'model-name'}" value="${esc(curFast)}" autocomplete="off">
          </div>
          <div class="field">
            <label>Power model <span style="font-size:10px;font-weight:400;color:var(--text3)">used for evaluation, tailoring, CV — pick from the dropdown or type any model</span></label>
            <input class="input" id="prov-power-model" ${(p.models || []).length ? 'list="prov-model-options"' : ''} placeholder="${p.powerModel || 'model-name'}" value="${esc(curPower)}" autocomplete="off">
          </div>
        </div>
      </div>`;

    el.querySelector('#toggle-models-btn')?.addEventListener('click', () => {
      const panel = el.querySelector('#model-overrides');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    if (isOllama) wireOllamaProbe(el);
  }

  // ── Ollama live status probe ──────────────────────────────────
  function wireOllamaProbe(root) {
    const dot     = root.querySelector('#ollama-dot');
    const msg     = root.querySelector('#ollama-probe-msg');
    const modRow  = root.querySelector('#ollama-models-row');
    const modChips = root.querySelector('#ollama-model-chips');
    if (!dot || !msg) return;

    async function probe() {
      msg.textContent = 'Checking Ollama…';
      dot.style.background = 'var(--text4)';
      try {
        const r = await api.config.ollamaStatus();
        if (r.running) {
          dot.style.background = 'var(--green)';
          msg.textContent = `Ollama is running${r.models?.length ? ` · ${r.models.length} model${r.models.length > 1 ? 's' : ''} loaded` : ''}`;
          if (r.models?.length && modRow && modChips) {
            modChips.innerHTML = r.models.map(m => `<button class="chip chip-green ollama-model-chip" data-model="${esc(m)}" style="font-size:10px;cursor:pointer;border:1px solid transparent" title="Click to use this model">${esc(m)}</button>`).join('');
            modRow.style.display = '';
            // Open model overrides panel so chips are visible next to inputs
            const overrides = root.querySelector('#model-overrides');
            if (overrides) overrides.style.display = '';
            // Wire click-to-select on each chip
            modChips.querySelectorAll('.ollama-model-chip').forEach(chip => {
              chip.addEventListener('click', () => {
                const modelName = chip.dataset.model;
                const fastEl  = root.querySelector('#prov-fast-model');
                const powerEl = root.querySelector('#prov-power-model');
                if (fastEl)  fastEl.value  = modelName;
                if (powerEl) powerEl.value = modelName;
                // Highlight selected
                modChips.querySelectorAll('.ollama-model-chip').forEach(c => {
                  c.style.border = c === chip ? '1px solid var(--green)' : '1px solid transparent';
                  c.style.background = c === chip ? 'color-mix(in oklab,var(--green) 25%,var(--bg3))' : '';
                });
                toast(`Model set to ${modelName}`, 'success');
              });
            });
            // Pre-highlight the currently configured model
            const curFast = root.querySelector('#prov-fast-model')?.value;
            if (curFast) {
              modChips.querySelectorAll('.ollama-model-chip').forEach(c => {
                if (c.dataset.model === curFast) {
                  c.style.border = '1px solid var(--green)';
                  c.style.background = 'color-mix(in oklab,var(--green) 25%,var(--bg3))';
                }
              });
            }
          }
        } else {
          dot.style.background = 'var(--rose)';
          msg.textContent = r.error || 'Ollama not detected — run: ollama serve';
          if (modRow) modRow.style.display = 'none';
        }
      } catch {
        dot.style.background = 'var(--rose)';
        msg.textContent = 'Could not reach Ollama — run: ollama serve';
      }
    }

    probe();
    root.querySelector('#ollama-recheck-btn')?.addEventListener('click', probe);
  }

  // Render initial panel
  renderProviderPanel(activeKey);
  let selectedProvider = activeKey;

  // ── Provider tab switching ────────────────────────────────────
  el.querySelectorAll('.provider-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.provider-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedProvider = btn.dataset.key;
      renderProviderPanel(selectedProvider);
    });
  });

  // ── Save provider ─────────────────────────────────────────────
  el.querySelector('#save-provider-btn').addEventListener('click', async () => {
    const p      = providers[selectedProvider];
    const keyEl  = el.querySelector('#prov-api-key');
    const baseEl = el.querySelector('#prov-base-url');
    const fastEl = el.querySelector('#prov-fast-model');
    const pwrEl  = el.querySelector('#prov-power-model');

    const rawKey = keyEl?.value.trim() || '';
    const isOllama = selectedProvider === 'ollama';

    // Don't overwrite key if placeholder bullets were left untouched — reuse the
    // key saved for THIS provider (per-provider aiKeys map, legacy fields as fallback).
    const savedKey = config.aiKeys?.[selectedProvider]
      || (selectedProvider === (config.aiProvider || '') ? config.aiApiKey : '')
      || (selectedProvider === 'anthropic' ? (config.apiKey || '') : '');
    const apiKey = rawKey && !rawKey.includes('•') ? rawKey : savedKey;

    if (!isOllama && p.needsKey && !apiKey) {
      toast(`Enter a ${p.keyLabel || 'API key'} to continue`, 'error'); return;
    }

    const payload = {
      aiProvider:   selectedProvider,
      aiApiKey:     apiKey,
      // Per-provider key map — each provider keeps its own key across switches
      aiKeys:       { [selectedProvider]: apiKey },
      aiBaseUrl:    baseEl?.value.trim() || p.baseUrl || '',
      aiFastModel:  fastEl?.value.trim() || p.fastModel || '',
      aiPowerModel: pwrEl?.value.trim()  || p.powerModel || '',
      // keep legacy apiKey for Anthropic backward-compat
      ...(selectedProvider === 'anthropic' ? { apiKey } : {}),
    };

    try {
      const r = await api.config.save(payload);
      // Refresh the local config snapshot so panel re-renders reflect what was just saved
      Object.assign(config, payload);
      const badge = el.querySelector('#provider-status-badge');
      badge.textContent = r.hasKey || isOllama ? 'Connected' : 'Saved';
      badge.className = `chip ${r.hasKey || isOllama ? 'chip-green' : 'chip-amber'}`;
      el.querySelector('#provider-save-status').textContent = '✓ Saved';
      state.hasApiKey = r.hasKey || isOllama;
      document.getElementById('api-dot')?.classList.toggle('ok', r.hasKey || isOllama);
      const modelShort = (payload.aiPowerModel || '').split('/').pop();
      const statusEl = document.getElementById('api-status');
      if (statusEl) {
        statusEl.textContent = (r.hasKey || isOllama) ? (modelShort || `${providers[selectedProvider]?.label} connected`) : 'Check key';
        statusEl.title = `${selectedProvider} · ${payload.aiPowerModel || ''}`;
      }
      toast('AI provider saved', 'success');
    } catch(e) { toast(e.message, 'error'); }
  });

  // ── Personal info ─────────────────────────────────────────────
  el.querySelector('#save-personal-btn').addEventListener('click', async () => {
    const patch = { name: v('p-name'), email: v('p-email'), phone: v('p-phone'), location: v('p-location'), linkedin: v('p-linkedin') };
    try { await api.profile.save(patch); toast('Saved', 'success'); } catch(e) { toast(e.message, 'error'); }
  });

  // ── Prefs ─────────────────────────────────────────────────────
  el.querySelector('#save-prefs-btn').addEventListener('click', async () => {
    const roles = [...el.querySelectorAll('#roles-wrap .tag-pill')].map(p => p.textContent.trim().replace('×','').trim());
    const patch = { targetRoles: roles, primaryIndustry: v('p-industry'), seniority: v('p-seniority'), remotePreference: v('p-remote'), salaryMin: parseInt(v('p-sal-min'))||0, salaryMax: parseInt(v('p-sal-max'))||0 };
    try { await api.profile.save(patch); toast('Preferences saved', 'success'); } catch(e) { toast(e.message, 'error'); }
  });

  // ── Narrative ─────────────────────────────────────────────────
  el.querySelector('#save-narrative-btn').addEventListener('click', async () => {
    const breaks = [...el.querySelectorAll('#breaks-wrap .tag-pill')].map(p => p.textContent.trim().replace('×','').trim());
    const patch = { superpower: v('p-super'), narrative: v('p-achieve'), dealBreakers: breaks };
    try { await api.profile.save(patch); toast('Narrative saved', 'success'); } catch(e) { toast(e.message, 'error'); }
  });

  wireTagInput(el, 'roles-input', 'roles-wrap', 'chip-purple');
  wireTagInput(el, 'breaks-input', 'breaks-wrap', 'chip-red', 'background:rgba(239,68,68,.12);color:#f87171');

  function v(id) { return el.querySelector(`#${id}`)?.value.trim() || ''; }

  // ── Platform Accounts ─────────────────────────────────────────────
  const PLATFORM_META = {
    linkedin:      { label: 'LinkedIn',       color: '#0a66c2', icon: 'LI', syncable: true },
    indeed:        { label: 'Indeed',         color: '#003a9b', icon: 'IN', syncable: true },
    glassdoor:     { label: 'Glassdoor',      color: '#0caa41', icon: 'GD', syncable: false },
    google:        { label: 'Google (Jobs search)', color: '#4285f4', icon: 'G',  syncable: false },
    ziprecruiter:  { label: 'ZipRecruiter',   color: '#1d6f42', icon: 'ZR', syncable: false },
    monster:       { label: 'Monster',        color: '#6e46ae', icon: 'MO', syncable: false },
    careerbuilder: { label: 'CareerBuilder',  color: '#7a5fd0', icon: 'CB', syncable: false },
    dice:          { label: 'Dice',           color: '#eb1c26', icon: 'DI', syncable: false },
    wellfound:     { label: 'Wellfound',      color: '#ec2e3a', icon: 'WF', syncable: false },
  };

  let platformPollTimer = null;

  async function loadPlatformStatus() {
    const list = el.querySelector('#platform-list');
    if (!list) return;
    try {
      const r = await api.platforms.status();
      renderPlatformList(r.platforms || []);
    } catch {
      if (list) list.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Could not load platform status.</div>';
    }
  }

  function renderPlatformList(platforms) {
    const list = el.querySelector('#platform-list');
    if (!list) return;
    list.innerHTML = platforms.map(p => {
      const meta = PLATFORM_META[p.platform] || {};
      const connectedAt = p.connectedAt ? new Date(p.connectedAt).toLocaleDateString() : '';
      const statusChip = p.connected
        ? `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:color-mix(in oklab,var(--green) 18%,transparent);color:#34d399">● Connected${connectedAt ? ' · ' + connectedAt : ''}</span>`
        : p.connecting
          ? `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:color-mix(in oklab,var(--acc) 15%,transparent);color:var(--acc)">⏳ Waiting for sign-in…</span>`
          : `<span style="font-size:10px;color:var(--text3)">Not connected</span>`;

      const actions = p.connected
        ? `${meta.syncable ? `<button class="btn btn-ghost btn-sm platform-sync-btn" data-platform="${p.platform}" style="font-size:11px">Sync Profile</button>` : ''}
           <button class="btn btn-ghost btn-sm platform-disconnect-btn" data-platform="${p.platform}" style="font-size:11px;color:var(--red)">Disconnect</button>`
        : p.connecting
          ? `<button class="btn btn-ghost btn-sm" disabled style="font-size:11px;opacity:.5">Connecting…</button>`
          : `<button class="btn btn-primary btn-sm platform-connect-btn" data-platform="${p.platform}" style="font-size:11px">Connect</button>`;

      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:var(--r-md);border:1px solid ${p.connected ? 'color-mix(in oklab,var(--green) 30%,var(--line))' : 'var(--line)'}">
        <div style="width:28px;height:28px;border-radius:6px;background:${meta.color || '#888'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:9px;font-weight:700;color:#fff;letter-spacing:-.3px">${meta.icon || '?'}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:600;color:var(--text)">${meta.label || p.platform}</div>
          <div style="margin-top:2px">${statusChip}</div>
          ${p.error ? `<div style="font-size:11px;color:var(--red);margin-top:2px">${esc(p.error)}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">${actions}</div>
      </div>`;
    }).join('');

    // Wire buttons
    list.querySelectorAll('.platform-connect-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.platform;
        btn.disabled = true;
        btn.textContent = 'Opening…';
        try {
          await api.platforms.connect(name);
          toast(`Sign in to ${PLATFORM_META[name]?.label || name} in the browser window`, 'info');
          startPlatformPoll();
        } catch(e) {
          toast(e.message, 'error');
          await loadPlatformStatus();
        }
      });
    });

    list.querySelectorAll('.platform-disconnect-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.platform;
        if (!confirm(`Disconnect ${PLATFORM_META[name]?.label || name}? You'll need to sign in again to use profile sync.`)) return;
        try {
          await api.platforms.disconnect(name);
          toast('Session cleared', 'success');
          await loadPlatformStatus();
        } catch(e) { toast(e.message, 'error'); }
      });
    });

    list.querySelectorAll('.platform-sync-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.platform;
        btn.disabled = true;
        btn.textContent = 'Syncing…';
        try {
          const r = await api.platforms.sync(name);
          showSyncDiff(name, r);
        } catch(e) {
          if (e.message.includes('expired') || e.message.includes('reconnect')) {
            toast('Session expired — please reconnect', 'error');
            await loadPlatformStatus();
          } else {
            toast(e.message, 'error');
          }
          await loadPlatformStatus();
        }
      });
    });

    // If any platform is still connecting, keep polling
    const anyConnecting = platforms.some(p => p.connecting);
    if (anyConnecting && !platformPollTimer) {
      startPlatformPoll();
    } else if (!anyConnecting && platformPollTimer) {
      clearInterval(platformPollTimer);
      platformPollTimer = null;
    }
  }

  function startPlatformPoll() {
    if (platformPollTimer) return;
    platformPollTimer = setInterval(async () => {
      if (!document.getElementById('platform-list')) {
        clearInterval(platformPollTimer);
        platformPollTimer = null;
        return;
      }
      try {
        const r = await api.platforms.status();
        const platforms = r.platforms || [];
        renderPlatformList(platforms);
        const anyConnecting = platforms.some(p => p.connecting);
        const justConnected = platforms.some(p => p.connected && !p.connecting);
        if (!anyConnecting) {
          clearInterval(platformPollTimer);
          platformPollTimer = null;
          if (justConnected) toast('Platform connected!', 'success');
        }
      } catch { /* ignore poll errors */ }
    }, 2500);
  }

  function showSyncDiff(platform, data) {
    const label = PLATFORM_META[platform]?.label || platform;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px;max-width:560px;width:100%;max-height:80vh;overflow-y:auto">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">${label} Profile Data</div>
        <div style="font-size:11.5px;color:var(--text3);margin-bottom:14px">Fetched ${new Date(data.fetchedAt).toLocaleString()}</div>
        ${data.structured ? `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          ${Object.entries(data.structured).filter(([,v]) => v && (Array.isArray(v) ? v.length : true)).map(([k, v]) => `
          <div style="background:var(--bg2);border-radius:var(--r-md);padding:8px 10px">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:var(--text3);margin-bottom:3px">${k}</div>
            <div style="font-size:12px;color:var(--text)">${Array.isArray(v) ? v.join(' · ') : esc(v)}</div>
          </div>`).join('')}
        </div>` : ''}
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Raw text preview:</div>
        <pre style="font-size:10.5px;color:var(--text2);background:var(--bg3);border-radius:var(--r-md);padding:10px;max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-word">${esc((data.rawText||'').slice(0, 2000))}</pre>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn btn-ghost btn-sm" id="sync-cancel-btn">Close</button>
          ${data.structured?.name ? `<button class="btn btn-primary btn-sm" id="sync-apply-btn">Apply to Profile</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#sync-cancel-btn').addEventListener('click', () => modal.remove());
    const applyBtn = modal.querySelector('#sync-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        const s = data.structured || {};
        const patch = {};
        if (s.name) patch.name = s.name;
        if (s.location) patch.location = s.location;
        if (s.headline) patch.headline = s.headline;
        if (s.about) patch.about = s.about;
        if (s.skills?.length) patch.skills = s.skills;
        try {
          await api.profile.save(patch);
          toast('Profile updated from ' + label, 'success');
          modal.remove();
          renderProfile(el, state);
        } catch(e) { toast(e.message, 'error'); }
      });
    }
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // Load platform status on render
  loadPlatformStatus();
}

function wireTagInput(el, inputId, wrapId, cls, style='') {
  const input = el.querySelector(`#${inputId}`);
  const wrap  = el.querySelector(`#${wrapId}`);
  if (!input || !wrap) return;
  wrap.addEventListener('click', () => input.focus());
  input.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      const tag = document.createElement('span');
      tag.className = `tag-pill ${cls}`;
      if (style) tag.style.cssText = style;
      tag.innerHTML = `${esc(input.value.trim())}<button onclick="this.parentElement.remove()">×</button>`;
      wrap.insertBefore(tag, input);
      input.value = '';
    }
  });
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
