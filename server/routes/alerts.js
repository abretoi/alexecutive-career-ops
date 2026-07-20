import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const FILE = path.join(DATA, 'alerts.json');

function readAlerts() {
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function writeAlerts(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

const router = Router();

router.get('/', (req, res) => res.json(readAlerts()));

router.post('/', (req, res) => {
  try {
    const list = readAlerts();
    const alert = {
      id: Date.now().toString(36),
      enabled: true,
      lastRun: null,
      createdAt: new Date().toISOString(),
      ...req.body
    };
    list.push(alert);
    writeAlerts(list);
    res.json(alert);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', (req, res) => {
  try {
    const list = readAlerts();
    const idx = list.findIndex(a => a.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    list[idx] = { ...list[idx], ...req.body };
    writeAlerts(list);
    res.json(list[idx]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const list = readAlerts().filter(a => a.id !== req.params.id);
    writeAlerts(list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
