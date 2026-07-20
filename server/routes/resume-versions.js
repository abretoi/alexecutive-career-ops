import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveResume } from '../db/dataStore.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const FILE = path.join(DATA, 'resume-versions.json');

function readVersions() {
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function writeVersions(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

const router = Router();

router.get('/', (req, res) => res.json(readVersions()));

router.post('/', (req, res) => {
  try {
    const list = readVersions();
    const version = {
      id: Date.now().toString(36),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...req.body
    };
    list.push(version);
    writeVersions(list);
    res.json(version);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', (req, res) => {
  try {
    const list = readVersions();
    const idx = list.findIndex(v => v.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    list[idx] = { ...list[idx], ...req.body, updatedAt: new Date().toISOString() };
    writeVersions(list);
    res.json(list[idx]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const list = readVersions().filter(v => v.id !== req.params.id);
    writeVersions(list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/set-active', (req, res) => {
  try {
    const version = readVersions().find(v => v.id === req.params.id);
    if (!version) return res.status(404).json({ error: 'Not found' });
    saveResume(version.content);
    res.json({ ok: true, activeVersion: version.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
