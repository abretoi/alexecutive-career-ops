import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateOutreachForContact } from '../services/claude.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const FILE = path.join(DATA, 'contacts.json');

function readContacts() {
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function writeContacts(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

const router = Router();

router.get('/', (req, res) => res.json(readContacts()));

router.post('/', (req, res) => {
  try {
    const list = readContacts();
    const contact = {
      id: Date.now().toString(36),
      followUpStatus: 'none',
      createdAt: new Date().toISOString(),
      ...req.body
    };
    list.push(contact);
    writeContacts(list);
    res.json(contact);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', (req, res) => {
  try {
    const list = readContacts();
    const idx = list.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    list[idx] = { ...list[idx], ...req.body };
    writeContacts(list);
    res.json(list[idx]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const list = readContacts().filter(c => c.id !== req.params.id);
    writeContacts(list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/outreach', async (req, res) => {
  try {
    const contact = readContacts().find(c => c.id === req.params.id);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    const { job, type } = req.body;
    const result = await generateOutreachForContact(contact, job, type);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
