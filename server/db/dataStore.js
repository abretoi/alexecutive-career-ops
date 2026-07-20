/**
 * dataStore.js — JSON file-based persistence
 * All data lives in /data/*.json (gitignored)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA  = path.join(ROOT, 'data');

function filePath(name) { return path.join(DATA, `${name}.json`); }

function read(name, fallback = null) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return fallback;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return fallback; }
}

function write(name, data) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8');
}

// ── Profile ─────────────────────────────────────────────────
export function getProfile() {
  return read('profile', {
    name: '', email: '', phone: '', location: '',
    linkedin: '', portfolio: '',
    targetRoles: [], primaryIndustry: '', seniority: 'Mid',
    salaryMin: 0, salaryMax: 0, currency: 'USD',
    remotePreference: 'any', openToRemote: true,
    dealBreakers: [], narrative: '', superpower: '',
    apiKey: ''
  });
}

export function saveProfile(data) { write('profile', data); }

// ── Resume ───────────────────────────────────────────────────
export function getResume()       { return read('resume', null); }
export function saveResume(data)  { write('resume', data); }
export function deleteResume()    {
  const fp = filePath('resume');
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// ── Applications (Tracker) ───────────────────────────────────
export function getApplications() { return read('applications', []); }

export function saveApplications(list) { write('applications', list); }

export function addApplication(app) {
  const list = getApplications();
  const existing = list.findIndex(a =>
    a.company.toLowerCase() === app.company.toLowerCase() &&
    a.role.toLowerCase()    === app.role.toLowerCase()
  );
  if (existing >= 0) {
    list[existing] = { ...list[existing], ...app };
  } else {
    const id = Date.now().toString(36);
    const num = list.length + 1;
    list.push({ id, num, dateAdded: new Date().toISOString().slice(0,10), ...app });
  }
  write('applications', list);
  return list;
}

export function updateApplication(id, patch) {
  const list = getApplications();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) list[idx] = { ...list[idx], ...patch };
  write('applications', list);
  return list;
}

export function deleteApplication(id) {
  const list = getApplications().filter(a => a.id !== id);
  write('applications', list);
  return list;
}

// ── Cover Letter Sample ──────────────────────────────────────
export function getCoverLetterSample() { return read('cover-letter', null); }
export function saveCoverLetterSample(data) { write('cover-letter', data); }
export function deleteCoverLetterSample() {
  const fp = filePath('cover-letter');
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// ── Writing Style ─────────────────────────────────────────────
export function getWritingStyle() {
  return read('writing-style', { style: 'professional', customNote: '' });
}
export function saveWritingStyle(data) { write('writing-style', data); }

// ── Config (AI provider + legacy Anthropic key) ───────────────
const CONFIG_DEFAULTS = {
  apiKey:       '',   // kept for backward-compat (Anthropic)
  aiProvider:   'anthropic',
  aiApiKey:     '',
  aiBaseUrl:    '',
  aiFastModel:  '',
  aiPowerModel: '',
};
export function getConfig() { return read('config', CONFIG_DEFAULTS); }
export function saveConfig(data) { write('config', { ...getConfig(), ...data }); }

export function getApiKey() {
  // Legacy helper — returns Anthropic key only, used by old callers
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const cfg = getConfig();
  return cfg.apiKey || cfg.aiApiKey || '';
}
