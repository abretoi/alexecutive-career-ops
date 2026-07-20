/**
 * sessionStore.js — Named session snapshots
 *
 * A "session" is a point-in-time snapshot of the user's working state:
 *   applications, resume, profile, cover-letter, writing-style.
 *
 * Config (API keys, provider) is NEVER stored in sessions — it is global.
 *
 * Sessions live in  data/sessions/{id}/
 * Active session is data/active-session.json  →  { id, name, savedAt }
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const ROOT     = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA     = path.join(ROOT, 'data');
const SESS_DIR = path.join(DATA, 'sessions');
const ACTIVE_F = path.join(DATA, 'active-session.json');

// ── helpers ──────────────────────────────────────────────────────

function ensureDirs() {
  fs.mkdirSync(DATA,     { recursive: true });
  fs.mkdirSync(SESS_DIR, { recursive: true });
}

function readJson(fp, fallback = null) {
  if (!fs.existsSync(fp)) return fallback;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return fallback; }
}

function writeJson(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

// Files that belong to a session (relative to data/)
const SESSION_FILES = ['applications', 'resume', 'profile', 'cover-letter', 'writing-style'];

function sessionDir(id) { return path.join(SESS_DIR, id); }

function snapshotData() {
  const snap = {};
  for (const name of SESSION_FILES) {
    const fp = path.join(DATA, `${name}.json`);
    snap[name] = readJson(fp, name === 'applications' ? [] : null);
  }
  return snap;
}

function applySnapshot(snap) {
  for (const name of SESSION_FILES) {
    const fp = path.join(DATA, `${name}.json`);
    if (snap[name] !== null && snap[name] !== undefined) {
      writeJson(fp, snap[name]);
    } else if (name !== 'profile') {
      // Don't delete profile on restore — always keep the user's identity
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  }
}

// ── Active session tracking ──────────────────────────────────────

export function getActiveSession() {
  return readJson(ACTIVE_F, null);
}

function setActiveSession(id, name, savedAt = new Date().toISOString()) {
  writeJson(ACTIVE_F, { id, name, savedAt });
}

// ── Public API ───────────────────────────────────────────────────

export function listSessions() {
  ensureDirs();
  const ids = fs.existsSync(SESS_DIR)
    ? fs.readdirSync(SESS_DIR).filter(f => fs.statSync(path.join(SESS_DIR, f)).isDirectory())
    : [];

  return ids
    .map(id => {
      const meta = readJson(path.join(SESS_DIR, id, 'meta.json'), null);
      if (!meta) return null;
      return meta;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function createSession(name) {
  ensureDirs();
  const id  = randomBytes(6).toString('hex');
  const dir = sessionDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const snap = snapshotData();
  writeJson(path.join(dir, 'data.json'), snap);

  const appCount = Array.isArray(snap.applications) ? snap.applications.length : 0;
  const meta = {
    id,
    name: name || `Session ${new Date().toLocaleDateString()}`,
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    applicationCount: appCount,
  };
  writeJson(path.join(dir, 'meta.json'), meta);
  setActiveSession(id, meta.name);
  return meta;
}

export function autoSave() {
  ensureDirs();
  const active = getActiveSession();

  if (!active) {
    // No active session — create one silently
    return createSession('Auto-save');
  }

  const dir = sessionDir(active.id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const snap = snapshotData();
  writeJson(path.join(dir, 'data.json'), snap);

  const appCount = Array.isArray(snap.applications) ? snap.applications.length : 0;
  const existing = readJson(path.join(dir, 'meta.json'), {});
  const meta = {
    ...existing,
    id: active.id,
    name: active.name,
    updatedAt: new Date().toISOString(),
    applicationCount: appCount,
  };
  writeJson(path.join(dir, 'meta.json'), meta);
  setActiveSession(active.id, active.name);
  return meta;
}

export function loadSession(id) {
  ensureDirs();
  const dir  = sessionDir(id);
  const meta = readJson(path.join(dir, 'meta.json'), null);
  if (!meta) throw new Error(`Session ${id} not found`);

  const snap = readJson(path.join(dir, 'data.json'), null);
  if (!snap)  throw new Error(`Session ${id} has no data`);

  applySnapshot(snap);
  setActiveSession(id, meta.name);
  return meta;
}

export function deleteSession(id) {
  const dir = sessionDir(id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  // If deleted session was active, clear active-session pointer
  const active = getActiveSession();
  if (active?.id === id) {
    if (fs.existsSync(ACTIVE_F)) fs.unlinkSync(ACTIVE_F);
  }
  return { ok: true };
}

export function newSession(name, { keepProfile = true, keepResume = false } = {}) {
  ensureDirs();
  const id  = randomBytes(6).toString('hex');
  const dir = sessionDir(id);
  fs.mkdirSync(dir, { recursive: true });

  // Snapshot current state before clearing (so it can be restored)
  const previousSnap = snapshotData();
  writeJson(path.join(dir, 'data.json'), previousSnap);

  const appCount = Array.isArray(previousSnap.applications) ? previousSnap.applications.length : 0;
  const meta = {
    id,
    name: name || `New Session ${new Date().toLocaleDateString()}`,
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    applicationCount: appCount,
    note: 'Saved before clearing for new session',
  };
  writeJson(path.join(dir, 'meta.json'), meta);

  // Clear applications — always (that's the point of a new session)
  writeJson(path.join(DATA, 'applications.json'), []);

  // Clear resume only if explicitly requested
  if (!keepResume) {
    const resumeFp = path.join(DATA, 'resume.json');
    if (fs.existsSync(resumeFp)) fs.unlinkSync(resumeFp);
  }

  // Profile kept by default (user's permanent identity) — a Full Reset
  // (keepProfile: false) wipes it too for a true from-scratch start.
  // AI provider config (API keys) is NEVER touched by session operations.
  if (!keepProfile) {
    for (const f of ['profile.json', 'cover-letter.json']) {
      const fp = path.join(DATA, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  }

  // Create fresh active-session (new, unnamed until saved)
  const newId   = randomBytes(6).toString('hex');
  const newName = name || 'New Session';
  setActiveSession(newId, newName, new Date().toISOString());

  return { ok: true, previousSessionId: id, previousSessionName: meta.name };
}

export function renameSession(id, name) {
  const dir  = sessionDir(id);
  const meta = readJson(path.join(dir, 'meta.json'), null);
  if (!meta) throw new Error(`Session ${id} not found`);
  const updated = { ...meta, name };
  writeJson(path.join(dir, 'meta.json'), updated);

  const active = getActiveSession();
  if (active?.id === id) setActiveSession(id, name, active.savedAt);
  return updated;
}
