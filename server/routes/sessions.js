/**
 * routes/sessions.js — Session management REST API
 *
 * GET  /api/sessions           → list saved sessions
 * GET  /api/sessions/active    → current active session info
 * POST /api/sessions           → save current state as a named session
 * POST /api/sessions/autosave  → auto-save to active session (no new entry)
 * POST /api/sessions/new       → start a new session (clears applications)
 * POST /api/sessions/:id/load  → restore a session
 * POST /api/sessions/:id/rename → rename a session
 * DELETE /api/sessions/:id     → delete a session
 */
import { Router } from 'express';
import {
  listSessions, createSession, autoSave, loadSession,
  deleteSession, newSession, renameSession, getActiveSession,
} from '../db/sessionStore.js';

const router = Router();

router.get('/', (_req, res) => {
  try { res.json(listSessions()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/active', (_req, res) => {
  try { res.json(getActiveSession() || { id: null, name: 'Unsaved Session', savedAt: null }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', (req, res) => {
  try { res.json(createSession(req.body.name)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/autosave', (_req, res) => {
  try { res.json(autoSave()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/new', (req, res) => {
  try {
    const { name, keepProfile = true, keepResume = false } = req.body;
    res.json(newSession(name, { keepProfile, keepResume }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/load', (req, res) => {
  try { res.json(loadSession(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/:id/rename', (req, res) => {
  try { res.json(renameSession(req.params.id, req.body.name)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try { res.json(deleteSession(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
